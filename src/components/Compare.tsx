import { useCallback, useEffect, useRef, useState } from 'react'
import { IconPause, IconPlay } from './Icons'

interface Props {
  originalUrl: string
  processedUrl: string
  originalPlayable: boolean
  aspect: number // width / height of output
}

type Mode = 'wipe' | 'side'

/** Synchronised before/after player: a draggable wipe or side-by-side view.
 *  The processed video is the master clock and the original follows it. */
export function Compare({ originalUrl, processedUrl, originalPlayable, aspect }: Props) {
  const [mode, setMode] = useState<Mode>(originalPlayable ? 'wipe' : 'side')
  const [split, setSplit] = useState(50)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [origError, setOrigError] = useState(!originalPlayable)
  const master = useRef<HTMLVideoElement>(null)
  const slave = useRef<HTMLVideoElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const sync = useCallback(() => {
    const m = master.current
    const s = slave.current
    if (!m || !s || origError) return
    if (Math.abs(s.currentTime - m.currentTime) > 0.08) s.currentTime = m.currentTime
  }, [origError])

  useEffect(() => {
    const m = master.current
    if (!m) return
    let raf = 0
    const tick = () => {
      setTime(m.currentTime)
      if (!m.paused) {
        sync()
        raf = requestAnimationFrame(tick)
      }
    }
    const onPlay = () => {
      setPlaying(true)
      if (!origError) slave.current?.play().catch(() => {})
      raf = requestAnimationFrame(tick)
    }
    const onPause = () => {
      setPlaying(false)
      slave.current?.pause()
      sync()
      cancelAnimationFrame(raf)
    }
    const onSeek = () => {
      sync()
      setTime(m.currentTime)
    }
    const onMeta = () => setDuration(m.duration || 0)
    m.addEventListener('play', onPlay)
    m.addEventListener('pause', onPause)
    m.addEventListener('ended', onPause)
    m.addEventListener('seeked', onSeek)
    m.addEventListener('loadedmetadata', onMeta)
    if (m.readyState >= 1) onMeta()
    return () => {
      cancelAnimationFrame(raf)
      m.removeEventListener('play', onPlay)
      m.removeEventListener('pause', onPause)
      m.removeEventListener('ended', onPause)
      m.removeEventListener('seeked', onSeek)
      m.removeEventListener('loadedmetadata', onMeta)
    }
  }, [sync, origError, mode])

  const toggle = () => {
    const m = master.current
    if (!m) return
    if (m.paused) m.play().catch(() => {})
    else m.pause()
  }

  const setFromPointer = (clientX: number) => {
    const el = frame.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSplit(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  const videoCls = 'absolute inset-0 h-full w-full object-contain'
  const portrait = aspect < 1

  const OrigVideo = (
    <video
      ref={slave}
      src={originalUrl}
      muted
      playsInline
      preload="auto"
      onError={() => setOrigError(true)}
      className={videoCls}
    />
  )
  const ProcVideo = (
    <video ref={master} src={processedUrl} playsInline preload="auto" className={videoCls} data-testid="processed-video" />
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Comparison mode" className="inline-flex rounded-xl border border-line bg-white/[0.02] p-1">
          {(
            [
              ['wipe', 'Wipe'],
              ['side', 'Side by side'],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              disabled={m === 'wipe' && origError}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
                mode === m ? 'bg-white text-ink' : 'text-white/60 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {origError && <span className="text-right text-[11px] leading-tight text-white/40">Original preview unavailable here</span>}
      </div>

      {mode === 'wipe' ? (
        <div
          ref={frame}
          className="relative mx-auto w-full touch-none overflow-hidden rounded-2xl bg-black select-none"
          style={{ aspectRatio: String(aspect), maxHeight: portrait ? '62vh' : undefined, maxWidth: portrait ? `calc(62vh * ${aspect})` : undefined }}
          onPointerDown={(e) => {
            dragging.current = true
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            setFromPointer(e.clientX)
          }}
          onPointerMove={(e) => dragging.current && setFromPointer(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {ProcVideo}
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            {OrigVideo}
          </div>
          <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
            <div className="absolute inset-y-0 -left-px w-0.5 bg-lime shadow-[0_0_14px_rgba(214,255,0,0.8)]" />
            <div className="absolute top-1/2 -left-5 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-lime text-ink shadow-xl">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
              </svg>
            </div>
          </div>
          <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase backdrop-blur">
            Original
          </span>
          <span className="pointer-events-none absolute top-3 right-3 rounded-md bg-lime px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-ink uppercase">
            ADMZK
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {[
            { label: 'Original', node: origError ? null : OrigVideo, lime: false },
            { label: 'ADMZK', node: ProcVideo, lime: true },
          ].map((p) => (
            <div key={p.label}>
              <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: String(aspect) }}>
                {p.node ?? (
                  <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/40">
                    Preview not supported in this browser
                  </div>
                )}
              </div>
              <p className={`mt-2 text-center text-[10px] font-bold tracking-[0.16em] uppercase ${p.lime ? 'text-lime' : 'text-white/50'}`}>
                {p.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink transition-transform active:scale-95"
          data-testid="compare-play"
        >
          {playing ? <IconPause width={18} height={18} /> : <IconPlay width={18} height={18} />}
        </button>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            const m = master.current
            if (m) m.currentTime = Number(e.target.value)
          }}
          className="h-1.5 flex-1 cursor-pointer"
        />
        <span className="w-20 text-right font-display text-xs text-white/50 tabular-nums">
          {time.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>
      {mode === 'wipe' && (
        <p className="mt-2 text-center text-[11px] text-white/35">Drag across the video to wipe between original and repacked.</p>
      )}
    </div>
  )
}
