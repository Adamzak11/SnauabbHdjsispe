import { useEffect, useState } from 'react'
import { codecName, formatBitrate, formatBytes, formatFps, formatResolution, formatSecondsShort } from '../lib/format'
import { PRESETS } from '../lib/presets'
import type { DeviceProfile } from '../lib/device'
import type { MediaInfo, RepackResult } from '../lib/types'
import { Compare } from './Compare'
import { IconArrowLeft, IconCheck, IconDownload, IconRefresh, IconShare } from './Icons'
import { PlatformNotice } from './PlatformNotice'

interface Props {
  result: RepackResult
  original: MediaInfo
  originalUrl: string
  originalPlayable: boolean
  device: DeviceProfile
  onEdit: () => void
  onReset: () => void
}

function Row({ label, a, b, highlight }: { label: string; a: string; b: string; highlight?: boolean }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2.5 pr-3 text-left text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">
        {label}
      </th>
      <td className="py-2.5 pr-3 text-sm text-white/70 tabular-nums">{a}</td>
      <td className={`py-2.5 text-sm font-semibold tabular-nums ${highlight ? 'text-lime' : 'text-white'}`}>{b}</td>
    </tr>
  )
}

export function ResultView({ result, original, originalUrl, originalPlayable, device, onEdit, onReset }: Props) {
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'error'>('idle')
  const [downloaded, setDownloaded] = useState(false)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const out = result.info
  const ov = original.video
  const pv = out?.video
  const aspect = result.plan.outWidth / result.plan.outHeight
  const delta = result.blob.size - original.size
  const deltaPct = original.size > 0 ? (delta / original.size) * 100 : 0
  const preset = PRESETS[result.plan.platform]

  const download = () => {
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.fileName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setDownloaded(true)
  }

  const share = async () => {
    setShareState('sharing')
    try {
      const f = new File([result.blob], result.fileName, { type: 'video/mp4' })
      await navigator.share({ files: [f], title: 'ADMZK Repack' })
      setShareState('idle')
    } catch (e) {
      // AbortError = user closed the share sheet; not an error.
      setShareState(e instanceof DOMException && e.name === 'AbortError' ? 'idle' : 'error')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start" data-testid="result">
      <section className="card p-4 sm:p-5 animate-fade-up">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Before / after</p>
            <p className="mt-1 font-display text-lg font-bold tracking-tight">Compare the result</p>
          </div>
          <span className="chip border-lime/30 text-lime">{preset.name}</span>
        </div>
        <Compare
          originalUrl={originalUrl}
          processedUrl={result.url}
          originalPlayable={originalPlayable}
          aspect={aspect}
        />
      </section>

      <div className="grid gap-5">
        <section className="card relative overflow-hidden p-5 sm:p-6 animate-fade-up [animation-delay:80ms]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-lime/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-ink">
              <IconCheck width={20} height={20} strokeWidth={3} />
            </span>
            <div>
              <p className="font-display text-xl font-bold tracking-tight">Repack complete</p>
              <p className="text-[13px] text-white/50">
                {result.plan.mode === 'full'
                  ? 'Re-encoded'
                  : result.plan.mode === 'audio'
                    ? 'Video copied losslessly, audio converted'
                    : 'Lossless repack'}{' '}
                in {formatSecondsShort(result.elapsedMs / 1000)}
              </p>
            </div>
          </div>

          <p className="relative mt-5 truncate rounded-xl border border-line bg-black/40 px-3 py-2 font-mono text-[12px] text-white/70" title={result.fileName}>
            {result.fileName}
          </p>

          <div className="relative mt-4 grid gap-2.5">
            <button type="button" onClick={download} className="btn-primary w-full" data-testid="download">
              <IconDownload width={18} height={18} strokeWidth={2.6} />
              Download MP4 · {formatBytes(result.blob.size)}
            </button>
            {device.canShareFiles && (
              <button type="button" onClick={share} className="btn-ghost w-full" disabled={shareState === 'sharing'}>
                <IconShare width={17} height={17} />
                {device.isIOS ? 'Share / Save to Photos' : 'Share to app'}
              </button>
            )}
            {shareState === 'error' && (
              <p className="text-center text-xs text-red-300">Sharing failed. Use Download instead.</p>
            )}
            {downloaded && device.isIOS && (
              <p className="text-center text-xs text-white/45 animate-fade-in">
                On iPhone the file goes to the Files app (Downloads). To post from your gallery, use “Save to Photos” via
                Share.
              </p>
            )}
            {downloaded && !device.isIOS && (
              <p className="text-center text-xs text-white/45 animate-fade-in">Saved to your Downloads folder.</p>
            )}
          </div>
        </section>

        <section className="card p-5 sm:p-6 animate-fade-up [animation-delay:140ms]">
          <p className="eyebrow">Details</p>
          <table className="mt-3 w-full">
            <thead>
              <tr>
                <th />
                <th className="pb-2 text-left text-[11px] font-semibold text-white/40">Original</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-lime">ADMZK</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Size"
                a={formatBytes(original.size)}
                b={`${formatBytes(result.blob.size)} (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%)`}
                highlight
              />
              <Row
                label="Resolution"
                a={formatResolution(ov?.displayWidth, ov?.displayHeight)}
                b={formatResolution(pv?.displayWidth ?? result.plan.outWidth, pv?.displayHeight ?? result.plan.outHeight)}
              />
              <Row label="Frame rate" a={formatFps(ov?.fps)} b={formatFps(pv?.fps ?? result.plan.outFps)} />
              <Row
                label="Video"
                a={`${codecName(ov?.codec)}${ov?.profile ? ` ${ov.profile}` : ''}`}
                b={pv ? `${codecName(pv.codec)}${pv.profile ? ` ${pv.profile}` : ''}` : 'H.264 / AVC'}
              />
              <Row label="Bitrate" a={formatBitrate(ov?.bitrate)} b={formatBitrate(pv?.bitrate ?? out?.bitrate)} />
              <Row
                label="Audio"
                a={original.audio ? codecName(original.audio.codec) : 'None'}
                b={out ? (out.audio ? `${codecName(out.audio.codec)} ${formatBitrate(out.audio.bitrate)}` : 'None') : '—'}
              />
              <Row label="Container" a={original.formatName.split(',')[0].toUpperCase()} b="MP4 · fast-start" />
            </tbody>
          </table>
          {delta > 0 && result.plan.mode === 'full' && (
            <p className="mt-3 text-[12px] leading-relaxed text-white/45">
              The output is larger than the original because ADMZK uses a generous bitrate ceiling so it doesn’t add
              compression artefacts of its own before the platform re-encodes the video.
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onEdit} className="btn-ghost">
            <IconArrowLeft width={16} height={16} /> <span className="whitespace-nowrap">Adjust<span className="hidden sm:inline"> settings</span></span>
          </button>
          <button type="button" onClick={onReset} className="btn-ghost" data-testid="new-project">
            <IconRefresh width={16} height={16} /> New video
          </button>
        </div>

        <div className="rounded-2xl border border-lime/20 bg-lime/[0.04] p-4 text-[13px] leading-relaxed text-white/65">
          <p className="font-semibold text-white">Posting tips for {preset.name}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {preset.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>Upload over Wi-Fi when you can. Some apps lower quality on slow or metered connections.</li>
          </ul>
        </div>
        <PlatformNotice compact />
      </div>
    </div>
  )
}
