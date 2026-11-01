import { PRESETS } from '../lib/presets'
import type { SupportReport } from '../lib/device'
import { UploadZone } from './UploadZone'
import { IconBolt, IconCheck, IconFilm, IconShield, IconSliders, ShortVideoGlyph, StatusGlyph } from './Icons'
import { PlatformNotice } from './PlatformNotice'

interface Props {
  onFile: (f: File) => void
  uploadError: string | null
  maxBytes: number
  support: SupportReport
}

const STEPS = [
  { n: '01', t: 'Upload', d: 'Pick a clip from your gallery. It stays on your device.' },
  { n: '02', t: 'Choose platform', d: 'TikTok or WhatsApp Status, each with its own target.' },
  { n: '03', t: 'Smart analysis', d: 'We read codec, resolution, bitrate and fps, then plan the lightest fix.' },
  { n: '04', t: 'Repack & compare', d: 'Real FFmpeg encode, then a before/after check and a clean MP4 to download.' },
]

const FEATURES = [
  {
    icon: IconShield,
    t: 'Private by design',
    d: 'Processing runs locally in your browser with FFmpeg compiled to WebAssembly. Nothing is uploaded.',
  },
  {
    icon: IconSliders,
    t: 'Smart, not blind',
    d: 'Already-compliant videos are copied losslessly. We re-encode only what needs fixing.',
  },
  {
    icon: IconFilm,
    t: 'No upscaling, no stretching',
    d: 'Aspect ratio is locked and low-res clips are never inflated. Audio stays in sync.',
  },
  {
    icon: IconBolt,
    t: 'Fast-start MP4',
    d: 'H.264 High + AAC with the index up front, so the upload starts processing right away.',
  },
]

export function Landing({ onFile, uploadError, maxBytes, support }: Props) {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pt-10 pb-14 sm:pt-16 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pt-20">
        <div className="animate-fade-up">
          <span className="chip border-lime/30 bg-lime/[0.07] text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-glow" />
            On-device video engine
          </span>
          <h1 className="mt-6 font-display text-[44px] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[84px]">
            REPACK SMART.
            <br />
            <span className="text-lime lime-text-glow">POST IN HD.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            ADMZK re-encodes your video into a clean, platform-tuned MP4 before you post it to{' '}
            <span className="text-white">TikTok</span> or <span className="text-white">WhatsApp Status</span>. The
            app’s own compression then starts from a better file, so there’s less avoidable quality loss.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {['No sign-up', 'No uploads', 'No watermark', 'Free'].map((t) => (
              <li key={t} className="chip">
                <IconCheck width={13} height={13} className="text-lime" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 animate-fade-up [animation-delay:120ms] lg:mt-0">
          <div className="card relative p-3 sm:p-4">
            {support.supported ? (
              <UploadZone onFile={onFile} error={uploadError} maxBytes={maxBytes} />
            ) : (
              <div role="alert" className="rounded-[22px] border border-red-400/25 bg-red-500/10 p-6 text-sm text-red-100">
                <p className="font-display text-lg font-bold text-white">This browser can’t run the video engine</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-red-200/90">
                  {support.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="mt-4 text-white/70">
                  Try the latest Chrome, Safari (iOS 15+), Edge or Firefox. Your video is never sent to a server, so
                  there is no online fallback that would see your footage.
                </p>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['tiktok', 'whatsapp'] as const).map((id) => {
                const p = PRESETS[id]
                const Glyph = id === 'tiktok' ? ShortVideoGlyph : StatusGlyph
                return (
                  <div key={id} className="rounded-2xl border border-line bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-lime">
                      <Glyph width={18} height={18} />
                      <span className="font-display text-sm font-bold text-white">{p.name}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{p.features.slice(0, 2).join(' · ')}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-5 pb-14" aria-labelledby="how">
        <h2 id="how" className="eyebrow mb-5">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="card group p-5 transition-colors duration-300 hover:border-lime/30 animate-fade-up"
              style={{ animationDelay: `${180 + i * 70}ms` }}
            >
              <span className="font-display text-sm font-bold text-lime">{s.n}</span>
              <p className="mt-3 font-display text-lg font-bold tracking-tight">{s.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 pb-14" aria-labelledby="why">
        <h2 id="why" className="eyebrow mb-5">
          Why ADMZK
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="card flex gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-lime/25 bg-lime/[0.08] text-lime">
                <f.icon width={20} height={20} />
              </div>
              <div>
                <p className="font-display font-bold tracking-tight">{f.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/55">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <PlatformNotice />
      </section>
    </div>
  )
}
