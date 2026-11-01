import { useEffect, useRef } from 'react'

const STEPS = ['Upload', 'Platform', 'Analyse', 'Repack', 'Download']

export function Stepper({ current }: { current: number }) {
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = nav.current
    const active = el?.querySelector<HTMLElement>('[aria-current=step]')
    if (el && active) el.scrollTo({ left: active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
  }, [current])
  return (
    <nav ref={nav} aria-label="Progress" className="relative overflow-x-auto [scrollbar-width:none]">
      <ol className="flex min-w-max items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  active
                    ? 'border-lime bg-lime text-ink'
                    : done
                      ? 'border-lime/30 bg-lime/[0.07] text-lime'
                      : 'border-line text-white/40'
                }`}
              >
                <span className="font-display tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`h-px w-5 sm:w-8 ${done ? 'bg-lime/50' : 'bg-white/10'}`} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
