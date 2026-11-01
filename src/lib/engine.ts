import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg'
import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg'
import coreJsUrl from '@ffmpeg/core?url'
import coreWasmUrl from '@ffmpeg/core/wasm?url'
import { parseFfmpegLog, parseProbeJson } from './probe'
import type { MediaInfo } from './types'

/* Thin, cancellable wrapper around FFmpeg.wasm.
 *
 * - FFmpeg itself runs inside a dedicated Web Worker (spawned by @ffmpeg/ffmpeg),
 *   so the UI stays responsive while encoding.
 * - The ~31 MB core is lazy-loaded the first time a video is chosen. It is
 *   fetched with real byte-level progress and kept as a Blob URL so a restart
 *   after cancellation does not download it again.
 * - Input files are mounted with WORKERFS: FFmpeg reads directly from the File
 *   handle instead of copying the whole video into WebAssembly memory. This is
 *   the single biggest saving on memory-constrained phones.
 * - Nothing leaves the device. */

export const INPUT_DIR = '/input'
export const OUTPUT_PATH = '/admzk-output.mp4'

export class CancelledError extends Error {
  constructor() {
    super('Processing was cancelled.')
    this.name = 'CancelledError'
  }
}

export interface LoadProgress {
  loaded: number
  total: number
}

export interface RunProgress {
  /** 0..1, derived from FFmpeg's own `time=` reports against the media duration. */
  ratio: number
  /** Seconds of media processed so far. */
  processedSec: number
  /** Encoding speed as a multiple of real-time, if reported. */
  speed?: number
  /** Frames encoded so far, if reported. */
  frame?: number
  fps?: number
}

type BlobUrls = { core: string; wasm: string }

async function fetchWithProgress(
  url: string,
  mime: string,
  expectedBytes: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Could not download the video engine (HTTP ${res.status}).`)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  const total = expectedBytes || Number(res.headers.get('content-length')) || 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress?.(loaded, Math.max(total, loaded))
  }
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: mime }))
}

function parseTime(t: string): number {
  const m = t.match(/(-?\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return NaN
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

export function humaniseFfmpegError(logTail: string, raw?: unknown): string {
  const text = `${logTail}\n${raw instanceof Error ? raw.message : String(raw ?? '')}`
  if (/memory access out of bounds|out of memory|Cannot enlarge memory|OOM/i.test(text)) {
    return 'Your browser ran out of memory while processing. Try “Fast” mode, a shorter clip, or a desktop browser.'
  }
  if (/Invalid data found|moov atom not found|could not find codec parameters/i.test(text)) {
    return 'This file looks damaged or incomplete, so it can’t be read.'
  }
  if (/Decoder .* not found|Unknown decoder|unsupported codec/i.test(text)) {
    return 'This video uses a codec the in-browser engine can’t decode.'
  }
  if (/No such file|ENOENT/i.test(text)) {
    return 'The selected file could not be read. Pick it again from your gallery.'
  }
  const last = logTail
    .trim()
    .split('\n')
    .filter((l) => l && !/^Aborted\(\)/.test(l))
    .slice(-2)
    .join(' ')
  return last ? `Processing failed: ${last}` : 'Processing failed for an unknown reason.'
}

class RepackEngine {
  private ffmpeg: FFmpeg | null = null
  private loading: Promise<FFmpeg> | null = null
  private blobUrls: BlobUrls | null = null
  private busy = false
  private cancelRequested = false
  private logBuffer: string[] = []

  get isLoaded() {
    return !!this.ffmpeg?.loaded
  }

  /** Lazy-load the FFmpeg core. Safe to call repeatedly. */
  load(onProgress?: (p: LoadProgress) => void): Promise<FFmpeg> {
    if (this.ffmpeg?.loaded) return Promise.resolve(this.ffmpeg)
    if (this.loading) return this.loading
    this.loading = (async () => {
      if (!this.blobUrls) {
        const wasmSize = typeof __FFMPEG_WASM_SIZE__ === 'number' ? __FFMPEG_WASM_SIZE__ : 0
        const core = await fetchWithProgress(coreJsUrl, 'text/javascript', 0)
        const wasm = await fetchWithProgress(coreWasmUrl, 'application/wasm', wasmSize, (loaded, total) =>
          onProgress?.({ loaded, total }),
        )
        this.blobUrls = { core, wasm }
      } else {
        onProgress?.({ loaded: 1, total: 1 })
      }
      const ff = new FFmpeg()
      ff.on('log', this.onLog)
      await ff.load({ coreURL: this.blobUrls.core, wasmURL: this.blobUrls.wasm })
      this.ffmpeg = ff
      return ff
    })()
    this.loading.catch(() => {}).finally(() => {
      this.loading = null
    })
    return this.loading
  }

  private onLog = ({ message }: LogEvent) => {
    if (import.meta.env.VITE_ADMZK_DEBUG) console.debug('[ffmpeg]', message)
    this.logBuffer.push(message)
    if (this.logBuffer.length > 400) this.logBuffer.splice(0, this.logBuffer.length - 400)
  }

  private logTail(n = 30) {
    return this.logBuffer.slice(-n).join('\n')
  }

  private async mountInput(ff: FFmpeg, file: File): Promise<string> {
    await this.safeUnmount(ff)
    try {
      await ff.createDir(INPUT_DIR)
    } catch {
      /* exists */
    }
    await ff.mount(FFFSType.WORKERFS, { files: [file] }, INPUT_DIR)
    return `${INPUT_DIR}/${file.name}`
  }

  private async safeUnmount(ff: FFmpeg) {
    try {
      await ff.unmount(INPUT_DIR)
    } catch {
      /* not mounted */
    }
  }

  private async safeDelete(ff: FFmpeg, path: string) {
    try {
      await ff.deleteFile(path)
    } catch {
      /* missing */
    }
  }

  /** Inspect a media file with ffprobe (falls back to parsing `ffmpeg -i`). */
  async probe(file: File): Promise<MediaInfo> {
    const ff = await this.load()
    const path = await this.mountInput(ff, file)
    return this.probePath(ff, path, file.size, true)
  }

  private async probePath(ff: FFmpeg, path: string, size: number, unmountAfter: boolean): Promise<MediaInfo> {
    const jsonPath = '/probe.json'
    try {
      try {
        await this.safeDelete(ff, jsonPath)
        // Note: in @ffmpeg/core 0.12.x ffprobe returns a non-zero code even on
        // success, so the presence of valid JSON is the success signal.
        await ff.ffprobe([
          '-v', 'error',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          path,
          '-o', jsonPath,
        ])
        const text = (await ff.readFile(jsonPath, 'utf8')) as string
        const info = parseProbeJson(text, size)
        if (info.video && info.duration > 0) return info
      } catch (e) {
        console.warn('[admzk] ffprobe unavailable, falling back to ffmpeg log parsing', e)
      }
      this.logBuffer = []
      // FFmpeg 6+ only dumps input info when an output exists: use a null sink.
      await ff.exec(['-hide_banner', '-i', path, '-t', '0', '-f', 'null', '-'])
      const info = parseFfmpegLog(this.logBuffer.join('\n'), size)
      if (!info.video) {
        console.warn('[admzk] probe log:', this.logTail())
        throw new Error(humaniseFfmpegError(this.logTail(), 'No video stream found'))
      }
      return info
    } finally {
      await this.safeDelete(ff, jsonPath)
      if (unmountAfter) await this.safeUnmount(ff)
    }
  }

  /**
   * Run a repack. `args` must reference the mounted input path, which this
   * method returns via `buildArgs(inputPath)` so the caller never guesses it.
   */
  async run(
    file: File,
    buildArgs: (inputPath: string, outputPath: string) => string[],
    duration: number,
    onProgress: (p: RunProgress) => void,
  ): Promise<{ data: Uint8Array; info: MediaInfo | null }> {
    if (this.busy) throw new Error('A video is already being processed.')
    this.busy = true
    this.cancelRequested = false
    let ff: FFmpeg | null = null
    let lastRatio = 0
    const report = (p: RunProgress) => {
      lastRatio = Math.max(lastRatio, Math.min(0.995, p.ratio))
      onProgress({ ...p, ratio: lastRatio })
    }
    const onStatLog = ({ message }: LogEvent) => {
      if (!message.includes('time=')) return
      const t = parseTime(message.match(/time=\s*(\S+)/)?.[1] ?? '')
      if (!Number.isFinite(t) || duration <= 0) return
      const speed = Number(message.match(/speed=\s*([\d.]+)x/)?.[1])
      const frame = Number(message.match(/frame=\s*(\d+)/)?.[1])
      const fps = Number(message.match(/fps=\s*([\d.]+)/)?.[1])
      report({
        ratio: t / duration,
        processedSec: t,
        speed: Number.isFinite(speed) ? speed : undefined,
        frame: Number.isFinite(frame) ? frame : undefined,
        fps: Number.isFinite(fps) ? fps : undefined,
      })
    }
    const onProg = ({ progress, time }: ProgressEvent) => {
      // `time` is in microseconds. Only trust it when it is sane.
      const sec = time / 1_000_000
      if (duration > 0 && sec > 0 && sec <= duration * 1.05) {
        report({ ratio: sec / duration, processedSec: sec })
      } else if (progress > 0 && progress <= 1) {
        report({ ratio: progress, processedSec: progress * duration })
      }
    }
    try {
      ff = await this.load()
      if (this.cancelRequested) throw new CancelledError()
      await this.safeDelete(ff, OUTPUT_PATH)
      const inputPath = await this.mountInput(ff, file)
      const args = buildArgs(inputPath, OUTPUT_PATH)
      this.logBuffer = []
      ff.on('log', onStatLog)
      ff.on('progress', onProg)
      let code: number
      try {
        code = await ff.exec(args)
      } catch (e) {
        if (this.cancelRequested) throw new CancelledError()
        throw new Error(humaniseFfmpegError(this.logTail(), e))
      } finally {
        ff.off('log', onStatLog)
        ff.off('progress', onProg)
      }
      if (this.cancelRequested) throw new CancelledError()
      if (code !== 0) throw new Error(humaniseFfmpegError(this.logTail()))

      // Verify the output by probing it before handing it over.
      let info: MediaInfo | null = null
      try {
        info = await this.probePath(ff, OUTPUT_PATH, 0, false)
      } catch {
        info = null
      }
      const data = (await ff.readFile(OUTPUT_PATH)) as Uint8Array
      if (!data || data.byteLength < 1024) throw new Error('The engine produced an empty file.')
      if (info) info.size = data.byteLength
      report({ ratio: 1, processedSec: duration })
      onProgress({ ratio: 1, processedSec: duration })
      return { data, info }
    } catch (e) {
      if (this.cancelRequested || e instanceof CancelledError) throw new CancelledError()
      // A crashed/OOM'd wasm instance is not reusable: start fresh next time.
      if (e instanceof Error && /memory|RuntimeError/i.test(e.message)) this.hardReset()
      throw e
    } finally {
      if (this.ffmpeg && ff === this.ffmpeg) {
        await this.safeDelete(ff, OUTPUT_PATH)
        await this.safeUnmount(ff)
      }
      this.busy = false
    }
  }

  /**
   * Cancel the running job. FFmpeg.wasm cannot interrupt exec() cooperatively,
   * so the worker is terminated; memory is released with it, and the next run
   * re-instantiates the (already downloaded) core.
   */
  cancel() {
    this.cancelRequested = true
    this.hardReset()
  }

  private hardReset() {
    if (this.ffmpeg) {
      try {
        this.ffmpeg.terminate()
      } catch {
        /* ignore */
      }
    }
    this.ffmpeg = null
    this.loading = null
  }

  /** Free worker memory between projects (keeps the downloaded core). */
  release() {
    if (this.busy) return
    this.hardReset()
  }
}

export const engine = new RepackEngine()

if (import.meta.env.VITE_ADMZK_DEBUG) {
  ;(window as unknown as { __admzk: unknown }).__admzk = engine
}
