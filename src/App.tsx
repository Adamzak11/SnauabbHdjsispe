import { useMemo } from 'react'
import { useRepack } from './hooks/useRepack'
import { checkSupport } from './lib/device'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Landing } from './components/Landing'
import { Workspace } from './components/Workspace'

export default function App() {
  const c = useRepack()
  const support = useMemo(() => checkSupport(), [])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-lime/[0.07] blur-[120px] animate-float" />
      </div>
      <Header onReset={c.reset} showReset={c.stage !== 'empty'} />
      <main className="flex-1">
        {c.stage === 'empty' ? (
          <Landing onFile={c.selectFile} uploadError={c.uploadError} maxBytes={c.limits.maxInputBytes} support={support} />
        ) : (
          <Workspace c={c} />
        )}
      </main>
      <Footer />
    </div>
  )
}
