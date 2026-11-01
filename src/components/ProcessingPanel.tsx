import { useEffect, useRef } from 'react'
import type { ProcessingState } from '../hooks/useRepack'
import { formatEta, formatSecondsShort } from '../lib/format'
import { PRESETS } from '../lib/presets'
import type { RepackPlan } from '../lib/types'
import { IconX } from './Icons'

interface Props {
  state: ProcessingState
  plan: RepackPlan
  duration: number
  onCancel: () => void
}

export function ProcessingPanel({ state, plan, duration, onCancel }: Props) {
  const ref = useRef<HTMLElement>(null)
  // On phones the panel sits below the source card: bring it into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])
  const pct = Math.floor(state.ratio * 100)
  const R = 88
  const C = 2 * Math.PI * R
  const label =
    state.phase === 'starting'
      ? 'Starting engine'
      : state.phase === 'finalizing'
        ? 'Finalising MP4'
        : plan.mode === 'full'
          ? 'Re-encoding video'
          : plan.mode === 'audio'
            ? 'Converting audio'
            : 'Repacking streams'

  return (
    <section
      ref={ref}
      className="card relative overflow-hidden p-6 text-center sm:p-10 animate-fade-up"
      aria-live="polite"
      aria-busy="true"
      data-testid="processing"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl animate-pulse-glow" />
      <p className="eyebrow relative">Repacking for {PRESETS[plan.platform].name}</p>

      <div className="relative mx-auto mt-6 h-52 w-52 sm:h-60 sm:w-60">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="#D6FF00"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - state.ratio)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
            style={{ filter: 'drop-shadow(0 0 10px rgba(214,255,0,0.55))' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <p className="font-display text-6xl font-bold tracking-tighter tabular-nums sm:text-7xl" data-testid="progress-pct">
              {pct}
              <span className="text-2xl text-white/40">%</span>
            </p>
            <p className="mt-1 text-xs font-medium tracking-wide text-lime">{label}</p>
          </div>
        </div>
        <div className="absolute inset-3 rounded-full border border-dashed border-white/[0.06] animate-spin-slow" />
      </div>

      <dl className="relative mx-auto mt-8 grid max-w-md grid-cols-3 gap-2 text-left">
        <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">Processed</dt>
          <dd className="mt-0.5 font-display text-sm font-semibold tabular-nums">
            {formatSecondsShort(state.ratio * duration)}
            <span className="text-white/35"> / {formatSecondsShort(duration)}</span>
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">Speed</dt>
          <dd className="mt-0.5 font-display text-sm font-semibold tabular-nums">
            {state.fps ? `${Math.round(state.fps)} fps` : state.speed ? `${state.speed.toFixed(2)}×` : '—'}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">Remaining</dt>
          <dd className="mt-0.5 font-display text-sm font-semibold tabular-nums">
            {state.etaMs !== null ? formatEta(state.etaMs) : 'Estimating…'}
          </dd>
        </div>
      </dl>

      <p className="relative mx-auto mt-6 max-w-sm text-xs leading-relaxed text-white/40">
        Processing happens on this device. Keep this tab open and in the foreground. On phones, locking the screen or
        switching apps can pause or stop the job.
      </p>

      <button type="button" onClick={onCancel} className="btn-ghost relative mt-6" data-testid="cancel">
        <IconX width={16} height={16} /> Cancel
      </button>
    </section>
  )
}
