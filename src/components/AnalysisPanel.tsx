import type { LoadProgress } from '../lib/engine'
import { formatBytes, formatBitrate } from '../lib/format'
import type { AnalysisState } from '../hooks/useRepack'
import type { Decision, RepackPlan } from '../lib/types'
import { IconAlert, IconCheck, IconInfo, IconRefresh, IconSpark } from './Icons'

interface Props {
  state: AnalysisState
  engineProgress: LoadProgress | null
  error: string | null
  onRetry: () => void
  plan: RepackPlan | null
  hasPlatform: boolean
}

const MODE_COPY: Record<RepackPlan['mode'], { title: string; body: string }> = {
  remux: {
    title: 'Lossless repack',
    body: 'Your video already meets the target. Streams are copied bit-for-bit into an optimised MP4. Zero quality loss, done in seconds.',
  },
  audio: {
    title: 'Video copied, audio re-encoded',
    body: 'Video stays bit-for-bit identical. Only the audio track is converted to AAC for compatibility.',
  },
  full: {
    title: 'Optimised re-encode',
    body: 'The video needs changes for this platform, so it will be re-encoded with tuned H.264 settings.',
  },
}

function DecisionRow({ d }: { d: Decision }) {
  const styles = {
    keep: { icon: IconCheck, cls: 'bg-white/[0.06] text-white/70', tag: 'Kept' },
    change: { icon: IconSpark, cls: 'bg-lime/15 text-lime', tag: 'Optimised' },
    warn: { icon: IconAlert, cls: 'bg-amber-400/15 text-amber-300', tag: 'Note' },
    info: { icon: IconInfo, cls: 'bg-sky-400/10 text-sky-300', tag: 'Info' },
  }[d.kind]
  const Icon = styles.icon
  return (
    <li className="flex gap-3 py-3">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${styles.cls}`}>
        <Icon width={15} height={15} strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          {d.label}
          <span className="text-[10px] font-semibold tracking-[0.12em] text-white/35 uppercase">{styles.tag}</span>
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{d.detail}</p>
      </div>
    </li>
  )
}

export function AnalysisPanel({ state, engineProgress, error, onRetry, plan, hasPlatform }: Props) {
  if (state === 'engine' || state === 'probing') {
    const pct =
      state === 'engine' && engineProgress && engineProgress.total > 0
        ? Math.min(100, Math.round((engineProgress.loaded / engineProgress.total) * 100))
        : null
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white/[0.02] p-5" aria-live="polite">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-lime/[0.07] to-transparent animate-scan" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="relative h-10 w-10 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">
              {state === 'engine' ? 'Loading the on-device video engine' : 'Analysing your video'}
            </p>
            <p className="mt-0.5 text-[13px] text-white/50">
              {state === 'engine'
                ? engineProgress
                  ? `${formatBytes(engineProgress.loaded)} of ${formatBytes(engineProgress.total)}. One-time download, cached afterwards.`
                  : 'Preparing FFmpeg…'
                : 'Reading codecs, resolution, bitrate, frame rate and rotation…'}
            </p>
          </div>
          {pct !== null && <span className="font-display text-lg font-bold text-lime tabular-nums">{pct}%</span>}
        </div>
        {state === 'engine' && (
          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full shimmer-bar animate-shimmer transition-[width] duration-300"
              style={{ width: `${pct ?? 4}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <IconAlert className="mt-0.5 shrink-0 text-red-300" width={18} height={18} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">Analysis failed</p>
            <p className="mt-1 text-sm text-red-100/80">{error}</p>
            <button type="button" onClick={onRetry} className="btn-ghost mt-4 !py-2.5">
              <IconRefresh width={16} height={16} /> Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasPlatform) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 p-5 text-sm text-white/50">
        <p className="flex items-center gap-2 font-medium text-white/80">
          <IconCheck className="text-lime" width={16} height={16} strokeWidth={3} /> Analysis complete
        </p>
        <p className="mt-1">Choose a platform above to see your Smart Repack plan.</p>
      </div>
    )
  }

  if (!plan) return null
  const mode = MODE_COPY[plan.mode]
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] animate-fade-in" data-testid="plan">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div className="min-w-0">
          <p className="eyebrow">Smart Repack plan</p>
          <p className="mt-1.5 font-display text-lg font-bold tracking-tight">{mode.title}</p>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-white/55">{mode.body}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="chip border-lime/30 text-lime">
            {plan.outWidth}×{plan.outHeight} · {Math.round(plan.outFps * 100) / 100} fps
          </span>
          <span className="text-[11px] text-white/40">
            {plan.video.copy ? 'Size ≈ original' : `Up to ~${formatBytes(plan.estimatedMaxBytes)} · peak ${formatBitrate(plan.video.maxrateKbps * 1000)}`}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-line px-5">
        {plan.decisions.map((d) => (
          <DecisionRow key={d.label + d.detail} d={d} />
        ))}
      </ul>
    </div>
  )
}
