import { Logo } from './Logo'
import { IconRefresh, IconShield } from './Icons'

export function Header({ onReset, showReset }: { onReset: () => void; showReset: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <button type="button" onClick={onReset} className="rounded-lg" aria-label="ADMZK home">
          <Logo />
        </button>
        <div className="flex items-center gap-2">
          <span className="chip hidden sm:inline-flex">
            <IconShield width={13} height={13} className="text-lime" />
            100% on-device · nothing uploaded
          </span>
          {showReset && (
            <button type="button" onClick={onReset} className="btn-ghost !rounded-xl !px-3.5 !py-2 text-xs">
              <IconRefresh width={14} height={14} />
              <span>New<span className="hidden sm:inline"> project</span></span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
