interface LogoProps {
  className?: string
  /** Show the "VIDEO REPACK" product line next to the wordmark. */
  product?: boolean
}

/** ADMZK monogram: a heavy "Z" cut through a lime tile, the diagonal standing
 *  in for the repack arrow. Pairs with a custom-tracked wordmark. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="admzk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E6FF4D" />
          <stop offset="1" stopColor="#D6FF00" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#admzk-g)" />
      <path d="M16 16h32v8L29 40h19v8H16v-8l19-16H16z" fill="#080808" />
    </svg>
  )
}

export function Logo({ className = '', product = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="ADMZK Video Repack">
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="font-display text-[22px] font-bold tracking-[-0.04em] text-white">
          ADM<span className="text-lime">Z</span>K
        </span>
        {product && (
          <span className="mt-1 font-display text-[9.5px] font-semibold tracking-[0.34em] text-white/50">
            VIDEO REPACK
          </span>
        )}
      </div>
    </div>
  )
}
