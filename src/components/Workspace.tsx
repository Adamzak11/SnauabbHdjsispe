import { useState } from 'react'
import type { RepackController } from '../hooks/useRepack'
import { PRESETS } from '../lib/presets'
import { AnalysisPanel } from './AnalysisPanel'
import { IconAlert, IconBolt, IconRefresh } from './Icons'
import { PlatformPicker, QualityPicker } from './PlatformPicker'
import { PlatformNotice } from './PlatformNotice'
import { ProcessingPanel } from './ProcessingPanel'
import { ResultView } from './ResultView'
import { SourceCard } from './SourceCard'
import { Stepper } from './Stepper'

export function Workspace({ c }: { c: RepackController }) {
  const [showCmd, setShowCmd] = useState(false)
  const analyzing = c.analysis === 'engine' || c.analysis === 'probing'
  const step =
    c.stage === 'done' ? 4 : c.stage === 'processing' ? 3 : c.plan ? 2 : c.analysis === 'ready' ? 1 : 1

  if (!c.file || !c.originalUrl) return null

  const canStart = !!c.plan && !c.blocker && c.analysis === 'ready' && c.stage === 'workspace'

  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 pb-16 sm:pt-8">
      <Stepper current={step} />

      {c.stage === 'done' && c.result && c.info ? (
        <div className="mt-6">
          <ResultView
            result={c.result}
            original={c.info}
            originalUrl={c.originalUrl}
            originalPlayable={c.quick?.playable ?? true}
            device={c.device}
            onEdit={c.editSettings}
            onReset={c.reset}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <SourceCard file={c.file} url={c.originalUrl} quick={c.quick} info={c.info} analyzing={analyzing} />
          </div>

          {c.stage === 'processing' && c.processing && c.plan ? (
            <ProcessingPanel state={c.processing} plan={c.plan} duration={c.info?.duration ?? 0} onCancel={c.cancel} />
          ) : (
            <section className="card p-5 sm:p-6 animate-fade-up [animation-delay:80ms]">
              <div>
                <p className="eyebrow">Step 2 · Target</p>
                <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight">Where are you posting?</h2>
              </div>
              <div className="mt-4">
                <PlatformPicker value={c.platform} onChange={c.setPlatform} />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="eyebrow">Encoding speed</p>
                  <span className="text-[11px] text-white/35">Used only if a re-encode is needed</span>
                </div>
                <QualityPicker value={c.quality} onChange={c.setQuality} />
              </div>

              <div className="mt-6">
                <p className="eyebrow mb-2">Step 3 · Analysis</p>
                <AnalysisPanel
                  state={c.analysis}
                  engineProgress={c.engineProgress}
                  error={c.analysisError}
                  onRetry={c.retryAnalysis}
                  plan={c.plan}
                  hasPlatform={!!c.platform}
                />
              </div>

              {c.analysis === 'ready' && c.platform && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/60 select-none">
                    <input
                      type="checkbox"
                      checked={c.forceReencode}
                      onChange={(e) => c.setForceReencode(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#D6FF00]"
                      data-testid="force-reencode"
                    />
                    Always re-encode (skip lossless copy)
                  </label>
                  {c.plan && (
                    <button
                      type="button"
                      onClick={() => setShowCmd((s) => !s)}
                      className="text-[12px] font-medium text-white/40 underline-offset-4 hover:text-white hover:underline"
                    >
                      {showCmd ? 'Hide' : 'Show'} FFmpeg command
                    </button>
                  )}
                </div>
              )}
              {showCmd && c.plan && (
                <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-line bg-black/60 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/60 animate-fade-in">
                  ffmpeg {c.plan.args.map((a) => (/[\s,:=]/.test(a) ? `"${a}"` : a)).join(' ')}
                </pre>
              )}

              {(c.blocker || c.error) && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <IconAlert className="mt-0.5 shrink-0 text-red-300" width={18} height={18} />
                  <div className="min-w-0 flex-1">
                    <p>{c.blocker ?? c.error}</p>
                    {c.error && !c.blocker && c.quality !== 'fast' && c.plan?.mode === 'full' && (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-lime underline underline-offset-4"
                        onClick={() => c.setQuality('fast')}
                      >
                        Switch to Fast mode and try again
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-2.5 sm:grid-cols-[1fr_auto]">
                <button type="button" className="btn-primary w-full" disabled={!canStart} onClick={c.start} data-testid="start">
                  <IconBolt width={18} height={18} strokeWidth={2.6} />
                  {!c.platform
                    ? 'Select a platform'
                    : analyzing
                      ? 'Analysing…'
                      : c.plan?.mode === 'remux'
                        ? `Repack for ${PRESETS[c.platform].name}`
                        : `Optimise for ${PRESETS[c.platform].name}`}
                </button>
                <button type="button" className="btn-ghost" onClick={c.reset} data-testid="reset">
                  <IconRefresh width={16} height={16} /> Reset
                </button>
              </div>

              <div className="mt-5">
                <PlatformNotice compact />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
