import { LogoMark } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-6 w-6" />
          <span className="font-display font-semibold tracking-[0.2em] text-white/60">ADMZK VIDEO REPACK</span>
        </div>
        <p className="max-w-md leading-relaxed sm:text-right">
          Videos are processed locally with FFmpeg (WebAssembly) and never uploaded. TikTok and WhatsApp are trademarks
          of their respective owners. ADMZK is not affiliated with them.
        </p>
      </div>
    </footer>
  )
}
