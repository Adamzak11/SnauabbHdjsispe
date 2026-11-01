import { PRESETS, QUALITY_PROFILES } from '../lib/presets'
import type { PlatformId, QualityMode } from '../lib/types'
import { IconCheck, ShortVideoGlyph, StatusGlyph } from './Icons'

interface Props {
  value: PlatformId | null
  onChange: (p: PlatformId) => void
  disabled?: boolean
}

export function PlatformPicker({ value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="Target platform" className="grid gap-3 sm:grid-cols-2">
      {(['tiktok', 'whatsapp'] as const).map((id) => {
        const p = PRESETS[id]
        const active = value === id
        const Glyph = id === 'tiktok' ? ShortVideoGlyph : StatusGlyph
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            data-testid={`platform-${id}`}
            className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 sm:p-5 ${
              active
                ? 'border-lime bg-lime/[0.07] shadow-[0_0_0_4px_rgba(214,255,0,0.08),0_20px_50px_-25px_rgba(214,255,0,0.6)]'
                : 'border-line bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${
                  active ? 'bg-lime text-ink' : 'bg-white/[0.06] text-white/80 group-hover:text-lime'
                }`}
              >
                <Glyph width={22} height={22} />
              </div>
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border transition-all ${
                  active ? 'scale-100 border-lime bg-lime text-ink' : 'scale-90 border-white/20 text-transparent'
                }`}
              >
                <IconCheck width={14} height={14} strokeWidth={3.2} />
              </span>
            </div>
            <p className="mt-4 font-display text-lg font-bold tracking-tight">{p.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/55">{p.description}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {p.features.map((f) => (
                <li
                  key={f}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    active ? 'bg-lime/15 text-lime' : 'bg-white/[0.05] text-white/55'
                  }`}
                >
                  {f}
                </li>
              ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}

interface QualityProps {
  value: QualityMode
  onChange: (q: QualityMode) => void
  disabled?: boolean
}

export function QualityPicker({ value, onChange, disabled }: QualityProps) {
  return (
    <div role="radiogroup" aria-label="Encoding speed" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white/[0.02] p-1">
      {(Object.keys(QUALITY_PROFILES) as QualityMode[]).map((q) => {
        const qp = QUALITY_PROFILES[q]
        const active = q === value
        return (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(q)}
            data-testid={`quality-${q}`}
            className={`rounded-xl px-2 py-2.5 text-center transition-all duration-200 disabled:opacity-50 ${
              active ? 'bg-white text-ink shadow-lg' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <span className="block font-display text-[13px] font-bold">{qp.label}</span>
            <span className={`mt-0.5 block text-[10.5px] leading-tight ${active ? 'text-ink/60' : 'text-white/35'}`}>
              {qp.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
