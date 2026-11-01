import { IconInfo } from './Icons'

/** The honest disclaimer: we improve the input, we can't control the platform. */
export function PlatformNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-2xl border border-line bg-white/[0.025] ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <IconInfo className="mt-0.5 shrink-0 text-lime" width={18} height={18} />
      <div className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-white/60`}>
        <p className="font-semibold text-white/85">TikTok and WhatsApp will still recompress your upload.</p>
        <p className="mt-1">
          Every platform re-encodes videos on its own servers, and ADMZK can’t switch that off. What it does is hand
          them a clean, standards-friendly file at the right size and frame rate, which cuts avoidable artefacts.
          It can’t guarantee HD after upload. Final quality also depends on the app’s settings (such as “Upload HD”),
          your connection and the platform’s current policies.
        </p>
      </div>
    </div>
  )
}
