export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : digits)} ${units[i]}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Precise duration for small clips, e.g. "12.4s". */
export function formatSecondsShort(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return formatDuration(seconds)
}

export function formatBitrate(bps?: number): string {
  if (!bps || !Number.isFinite(bps)) return '—'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bps / 1000)} kbps`
}

export function formatFps(fps?: number): string {
  if (!fps || !Number.isFinite(fps)) return '—'
  const rounded = Math.round(fps * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} fps`
}

export function formatResolution(w?: number, h?: number): string {
  if (!w || !h) return '—'
  return `${w}×${h}`
}

export function resolutionLabel(w: number, h: number): string {
  const short = Math.min(w, h)
  if (short >= 2160) return '4K'
  if (short >= 1440) return '1440p'
  if (short >= 1080) return '1080p'
  if (short >= 720) return '720p'
  if (short >= 480) return '480p'
  return `${short}p`
}

export function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

const CODEC_NAMES: Record<string, string> = {
  h264: 'H.264 / AVC',
  hevc: 'H.265 / HEVC',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
  mpeg4: 'MPEG-4 Part 2',
  prores: 'Apple ProRes',
  aac: 'AAC',
  opus: 'Opus',
  vorbis: 'Vorbis',
  mp3: 'MP3',
  ac3: 'Dolby AC-3',
  eac3: 'Dolby E-AC-3',
  alac: 'Apple Lossless',
}

export function codecName(codec?: string): string {
  if (!codec) return '—'
  if (codec.startsWith('pcm_')) return 'PCM'
  return CODEC_NAMES[codec] ?? codec.toUpperCase()
}

/** Build a descriptive, filesystem-safe output name. */
export function buildOutputName(
  original: string,
  platformTag: string,
  width: number,
  height: number,
  fps: number,
): string {
  const base = original.replace(/\.[^.]+$/, '')
  const safe =
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'video'
  const fpsTag = `${Math.round(fps)}fps`
  return `${safe}_ADMZK-${platformTag}_${width}x${height}_${fpsTag}.mp4`
}
