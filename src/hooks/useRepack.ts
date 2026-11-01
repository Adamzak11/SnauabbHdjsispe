import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LoadProgress } from '../lib/engine'
import { buildPlan } from '../lib/planner'
import { getDevice, getLimits, validateFile } from '../lib/device'
import { formatBytes, formatDuration } from '../lib/format'
import type { MediaInfo, PlatformId, QualityMode, QuickMeta, RepackPlan, RepackResult } from '../lib/types'

/* FFmpeg (wrapper + worker + 31 MB core) is code-split and only fetched once
 * the user picks a video. */
type Engine = (typeof import('../lib/engine'))['engine']
let enginePromise: Promise<Engine> | null = null
let engineInstance: Engine | null = null
function getEngine(): Promise<Engine> {
  enginePromise ??= import('../lib/engine')
    .then((m) => (engineInstance = m.engine))
    .catch((e) => {
      enginePromise = null
      throw e
    })
  return enginePromise
}

export type Stage = 'empty' | 'workspace' | 'processing' | 'done'
export type AnalysisState = 'idle' | 'engine' | 'probing' | 'ready' | 'error'

export interface ProcessingState {
  ratio: number
  startedAt: number
  elapsedMs: number
  etaMs: number | null
  speed?: number
  fps?: number
  frame?: number
  phase: 'starting' | 'encoding' | 'finalizing'
}

function readQuickMeta(url: string): Promise<QuickMeta> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    let settled = false
    const finish = (meta: QuickMeta) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      v.removeAttribute('src')
      v.load()
      resolve(meta)
    }
    const timer = setTimeout(() => finish({ duration: 0, width: 0, height: 0, playable: false }), 8000)
    v.onloadedmetadata = () =>
      finish({
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
        playable: v.videoWidth > 0,
      })
    v.onerror = () => finish({ duration: 0, width: 0, height: 0, playable: false })
    v.src = url
  })
}

export function useRepack() {
  const device = useMemo(() => getDevice(), [])
  const limits = useMemo(() => getLimits(), [])

  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [quick, setQuick] = useState<QuickMeta | null>(null)
  const [platform, setPlatform] = useState<PlatformId | null>(null)
  const [quality, setQuality] = useState<QualityMode>(
    device.isMobile && (device.memoryGB ?? 4) <= 3 ? 'fast' : 'balanced',
  )
  const [forceReencode, setForceReencode] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisState>('idle')
  const [engineProgress, setEngineProgress] = useState<LoadProgress | null>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [processing, setProcessing] = useState<ProcessingState | null>(null)
  const [result, setResult] = useState<RepackResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const sessionRef = useRef(0)
  const urlsRef = useRef<string[]>([])

  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current = []
  }, [])

  useEffect(() => () => revokeAll(), [revokeAll])

  const analyze = useCallback(async (f: File, session: number) => {
    setAnalysis(engineInstance?.isLoaded ? 'probing' : 'engine')
    setAnalysisError(null)
    try {
      const engine = await getEngine()
      await engine.load((p) => {
        if (sessionRef.current === session) setEngineProgress(p)
      })
      if (sessionRef.current !== session) return
      setAnalysis('probing')
      const probed = await engine.probe(f)
      if (sessionRef.current !== session) return
      setInfo(probed)
      setAnalysis('ready')
    } catch (e) {
      if (sessionRef.current !== session) return
      setAnalysis('error')
      setAnalysisError(
        e instanceof Error
          ? e.message
          : 'The video engine could not start in this browser.',
      )
    }
  }, [])

  const selectFile = useCallback(
    async (f: File) => {
      setUploadError(null)
      const problem = validateFile(f)
      if (problem) {
        setUploadError(problem)
        return
      }
      const session = ++sessionRef.current
      revokeAll()
      const url = URL.createObjectURL(f)
      urlsRef.current.push(url)
      setFile(f)
      setOriginalUrl(url)
      setQuick(null)
      setInfo(null)
      setResult(null)
      setError(null)
      setProcessing(null)
      setStage('workspace')
      readQuickMeta(url).then((m) => {
        if (sessionRef.current === session) setQuick(m)
      })
      analyze(f, session)
    },
    [analyze, revokeAll],
  )

  const retryAnalysis = useCallback(() => {
    if (file) analyze(file, sessionRef.current)
  }, [analyze, file])

  const plan: RepackPlan | null = useMemo(() => {
    if (!info || !platform || !file) return null
    try {
      return buildPlan(info, {
        platform,
        quality,
        forceReencode,
        inputPath: '/input/' + file.name,
        outputPath: '/admzk-output.mp4',
        originalName: file.name,
      })
    } catch {
      return null
    }
  }, [info, platform, quality, forceReencode, file])

  /** Blocking issues that prevent processing on this device. */
  const blocker: string | null = useMemo(() => {
    if (!info) return null
    if (!info.video) return 'No video track was found in this file.'
    if (info.duration > limits.maxDurationSec) {
      return `This video is ${formatDuration(info.duration)} long. On this device the limit is ${formatDuration(
        limits.maxDurationSec,
      )}. Trim it first, or use a desktop browser.`
    }
    if (plan && plan.estimatedMaxBytes > limits.maxOutputBytes) {
      return `The output could reach ${formatBytes(plan.estimatedMaxBytes)}, which is more than this browser can safely hold in memory (${formatBytes(
        limits.maxOutputBytes,
      )}). Try a shorter clip.`
    }
    return null
  }, [info, limits, plan])

  const start = useCallback(async () => {
    if (!file || !info || !plan || !platform) return
    const session = sessionRef.current
    const startedAt = performance.now()
    setError(null)
    setStage('processing')
    setProcessing({ ratio: 0, startedAt, elapsedMs: 0, etaMs: null, phase: 'starting' })
    try {
      const engine = await getEngine()
      const { data, info: outInfo } = await engine.run(
        file,
        (inputPath, outputPath) =>
          buildPlan(info, { platform, quality, forceReencode, inputPath, outputPath, originalName: file.name }).args,
        info.duration,
        (p) => {
          if (sessionRef.current !== session) return
          const now = performance.now()
          const elapsedMs = now - startedAt
          const etaMs = p.ratio > 0.02 && p.ratio < 1 ? (elapsedMs / p.ratio) * (1 - p.ratio) : null
          setProcessing({
            ratio: p.ratio,
            startedAt,
            elapsedMs,
            etaMs,
            speed: p.speed,
            fps: p.fps,
            frame: p.frame,
            phase: p.ratio >= 0.995 ? 'finalizing' : 'encoding',
          })
        },
      )
      if (sessionRef.current !== session) return
      const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      urlsRef.current.push(url)
      setResult({
        blob,
        url,
        fileName: plan.outputFileName,
        info: outInfo,
        elapsedMs: performance.now() - startedAt,
        plan,
      })
      setStage('done')
      setProcessing(null)
    } catch (e) {
      if (sessionRef.current !== session) return
      setProcessing(null)
      setStage('workspace')
      if (e instanceof Error && e.name === 'CancelledError') {
        setError(null)
      } else {
        setError(e instanceof Error ? e.message : 'Processing failed.')
      }
    }
  }, [file, info, plan, platform, quality, forceReencode])

  const cancel = useCallback(() => {
    engineInstance?.cancel()
  }, [])

  /** Go back from the result to tweak settings, keeping the file. */
  const editSettings = useCallback(() => {
    if (result) {
      URL.revokeObjectURL(result.url)
      urlsRef.current = urlsRef.current.filter((u) => u !== result.url)
    }
    setResult(null)
    setStage('workspace')
  }, [result])

  const reset = useCallback(() => {
    if (stage === 'processing') engineInstance?.cancel()
    sessionRef.current++
    revokeAll()
    engineInstance?.release()
    setStage('empty')
    setFile(null)
    setOriginalUrl(null)
    setQuick(null)
    setInfo(null)
    setAnalysis('idle')
    setAnalysisError(null)
    setEngineProgress(null)
    setPlatform(null)
    setForceReencode(false)
    setProcessing(null)
    setResult(null)
    setError(null)
    setUploadError(null)
  }, [revokeAll, stage])

  return {
    device,
    limits,
    stage,
    file,
    originalUrl,
    quick,
    platform,
    setPlatform,
    quality,
    setQuality,
    forceReencode,
    setForceReencode,
    analysis,
    engineProgress,
    info,
    analysisError,
    retryAnalysis,
    plan,
    blocker,
    processing,
    result,
    error,
    uploadError,
    selectFile,
    start,
    cancel,
    editSettings,
    reset,
  }
}

export type RepackController = ReturnType<typeof useRepack>
