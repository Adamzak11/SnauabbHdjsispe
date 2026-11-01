import { codecName, formatBitrate, formatBytes, formatDuration, formatFps, formatResolution, resolutionLabel } from '../lib/format'
import type { MediaInfo, QuickMeta } from '../lib/types'
import { IconFilm } from './Icons'

interface Props {
  file: File
  url: string
  quick: QuickMeta | null
  info: MediaInfo | null
  analyzing: boolean
}

export function Stat({ label, value, accent, loading }: { label: string; value: string; accent?: boolean; loading?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10.5px] font-semibold tracking-[0.14em] text-white/40 uppercase">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-4 w-16 animate-pulse rounded bg-white/10" />
      ) : (
        <p className={`mt-0.5 truncate font-display text-[15px] font-semibold ${accent ? 'text-lime' : 'text-white'}`}>
          {value}
        </p>
      )}
    </div>
  )
}

export function SourceCard({ file, url, quick, info, analyzing }: Props) {
  const v = info?.video
  const w = v?.displayWidth ?? quick?.width
  const h = v?.displayHeight ?? quick?.height
  const duration = info?.duration || quick?.duration || 0
  const canPlay = quick ? quick.playable : true
  const portrait = w && h ? h >= w : true

  return (
    <section className="card overflow-hidden animate-fade-up" aria-label="Original video">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Original</p>
          <p className="mt-1 truncate font-display font-semibold" title={file.name}>
            {file.name}
          </p>
        </div>
        {w && h ? <span className="chip shrink-0">{resolutionLabel(w, h)}</span> : null}
      </div>

      <div className="relative grid place-items-center bg-black">
        {canPlay ? (
          <video
            src={url}
            controls
            playsInline
            muted
            preload="metadata"
            className={`w-full object-contain ${portrait ? 'max-h-[52vh] lg:max-h-[440px]' : 'max-h-[40vh]'}`}
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 p-6 text-center text-white/50">
            <IconFilm width={28} height={28} />
            <p className="text-sm">This browser can’t preview this format (common with HEVC/H.265).</p>
            <p className="text-xs text-white/35">It can still be analysed and repacked. The result will play everywhere.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
        <Stat label="Size" value={formatBytes(file.size)} />
        <Stat label="Duration" value={duration ? formatDuration(duration) : '—'} loading={!duration && (analyzing || !quick)} />
        <Stat label="Resolution" value={formatResolution(w, h)} loading={!w && (analyzing || !quick)} />
        <Stat label="Frame rate" value={formatFps(v?.fps)} loading={!v && analyzing} />
        <Stat
          label="Video"
          value={v ? `${codecName(v.codec).split(' ')[0]}${v.bitDepth > 8 ? ` ${v.bitDepth}-bit` : ''}${v.isHdr ? ' HDR' : ''}` : '—'}
          loading={!v && analyzing}
        />
        <Stat
          label="Bitrate"
          value={formatBitrate(v?.bitrate ?? info?.bitrate)}
          loading={!info && analyzing}
        />
        <Stat
          label="Audio"
          value={info ? (info.audio ? `${codecName(info.audio.codec)} ${Math.round(info.audio.sampleRate / 100) / 10}k` : 'None') : '—'}
          loading={!info && analyzing}
        />
        <Stat label="Container" value={info ? info.formatName.split(',')[0].toUpperCase() : (file.name.split('.').pop() ?? '').toUpperCase()} />
        <Stat label="Rotation" value={v ? (v.rotation ? `${v.rotation}°` : 'None') : '—'} loading={!v && analyzing} />
      </div>
    </section>
  )
}
