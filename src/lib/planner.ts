import { PRESETS, QUALITY_PROFILES } from './presets'
import { buildOutputName, codecName, formatBitrate, formatFps } from './format'
import type {
  AudioEncodeSettings,
  Decision,
  MediaInfo,
  PlatformId,
  QualityMode,
  RepackPlan,
  VideoEncodeSettings,
} from './types'

/* The Smart Repack planner: turns probe results + platform choice into a
 * concrete FFmpeg command, choosing the least destructive path:
 *
 *   remux — streams already comply: copy them losslessly, fix the container
 *           (fast-start, strip metadata). Takes seconds, zero quality loss.
 *   audio — video complies, audio doesn't: copy video, re-encode audio only.
 *   full  — video needs work (codec, size, fps, HDR, bitrate): re-encode with
 *           H.264 High + AAC, never upscaling and never changing aspect ratio. */

const STANDARD_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60]

/** Snap measured frame rates (e.g. 29.98 from a phone) to the nearest broadcast rate. */
export function snapFps(fps: number): number {
  let best = 0
  let bestErr = Infinity
  for (const r of STANDARD_RATES) {
    const err = Math.abs(fps - r) / r
    if (err < bestErr) {
      best = r
      bestErr = err
    }
  }
  return bestErr < 0.02 ? best : Math.round(fps * 1000) / 1000
}

function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2)
}

/** Fit display dimensions inside the platform box without upscaling. */
export function fitDimensions(
  w: number,
  h: number,
  maxLong: number,
  maxShort: number,
): { width: number; height: number; scale: boolean } {
  const long = Math.max(w, h)
  const short = Math.min(w, h)
  const s = Math.min(1, maxLong / long, maxShort / short)
  if (s >= 1) return { width: even(w), height: even(h), scale: false }
  return { width: even(w * s), height: even(h * s), scale: true }
}

function fpsToArg(fps: number): string {
  // Express NTSC rates exactly to avoid drift.
  if (fps === 23.976) return '24000/1001'
  if (fps === 29.97) return '30000/1001'
  if (fps === 59.94) return '60000/1001'
  return String(fps)
}

/** Peak bitrate scaled to output pixel count and frame rate. */
export function targetMaxrate(platform: PlatformId, width: number, height: number, fps: number): number {
  const p = PRESETS[platform]
  const ratio = (width * height) / (1080 * 1920)
  let kbps = p.maxrate1080p30 * Math.pow(Math.min(ratio, 1), 0.75)
  if (fps > 31) kbps *= p.highFpsBoost
  return Math.max(1500, Math.round(kbps / 100) * 100)
}

function h264Level(width: number, height: number, fps: number): string {
  const mbps = Math.ceil(width / 16) * Math.ceil(height / 16) * fps
  if (mbps <= 245_760 && width * height <= 2_097_152) return fps > 31 ? '4.2' : '4.1'
  return '5.1'
}

export interface PlanOptions {
  platform: PlatformId
  quality: QualityMode
  forceReencode: boolean
  inputPath: string
  outputPath: string
  originalName: string
}

export function buildPlan(info: MediaInfo, opts: PlanOptions): RepackPlan {
  const preset = PRESETS[opts.platform]
  const qp = QUALITY_PROFILES[opts.quality]
  const v = info.video
  if (!v) throw new Error('No video stream was found in this file.')

  const decisions: Decision[] = []
  const reasons: string[] = []

  // ---------- Geometry ----------
  const fit = fitDimensions(v.displayWidth, v.displayHeight, preset.maxLong, preset.maxShort)
  const oddDims = v.displayWidth % 2 !== 0 || v.displayHeight % 2 !== 0
  const anamorphic = Math.abs(v.sar - 1) > 0.01
  if (fit.scale) {
    reasons.push('resolution')
    decisions.push({
      kind: 'change',
      label: 'Resolution',
      detail: `${v.displayWidth}×${v.displayHeight} → ${fit.width}×${fit.height}. Scaled down to the platform maximum, aspect ratio kept.`,
    })
  } else {
    decisions.push({
      kind: 'keep',
      label: 'Resolution',
      detail: `${v.displayWidth}×${v.displayHeight} kept. Already within ${preset.maxShort}×${preset.maxLong}; never upscaled.`,
    })
  }
  if (anamorphic) reasons.push('non-square pixels')

  // ---------- Frame rate ----------
  const srcFps = snapFps(v.fps)
  const outFps = srcFps > preset.fpsCap + 0.5 ? preset.fpsCap : srcFps
  const fpsChanged = outFps !== srcFps
  if (fpsChanged) {
    reasons.push('frame rate')
    decisions.push({
      kind: 'change',
      label: 'Frame rate',
      detail: `${formatFps(v.fps)} → ${formatFps(outFps)}. ${preset.name} plays back at ${preset.fpsCap} fps at most.`,
    })
  } else {
    decisions.push({ kind: 'keep', label: 'Frame rate', detail: `${formatFps(srcFps)} kept.` })
  }

  // ---------- Codec / pixel format / HDR ----------
  const isH264 = v.codec === 'h264'
  const pixOk = !v.pixFmt || v.pixFmt === 'yuv420p' || v.pixFmt === 'yuvj420p'
  const eightBit = v.bitDepth <= 8
  if (!isH264) {
    reasons.push('codec')
    decisions.push({
      kind: 'change',
      label: 'Video codec',
      detail: `${codecName(v.codec)} → H.264 High. H.264 is the most widely supported upload format.`,
    })
  } else if (!pixOk || !eightBit) {
    reasons.push('pixel format')
    decisions.push({
      kind: 'change',
      label: 'Video codec',
      detail: `H.264 ${v.pixFmt ?? ''} (${v.bitDepth}-bit) → H.264 High 8-bit 4:2:0 for full compatibility.`,
    })
  } else {
    decisions.push({ kind: 'keep', label: 'Video codec', detail: 'H.264 8-bit 4:2:0. Already compatible.' })
  }
  if (v.isHdr) {
    reasons.push('HDR')
    decisions.push({
      kind: 'warn',
      label: 'HDR source',
      detail:
        'This is an HDR video. It will be converted to standard 8-bit video, and colours can look slightly flatter than on your phone.',
    })
  }
  if (v.variableFrameRate && !fpsChanged) {
    decisions.push({
      kind: 'info',
      label: 'Variable frame rate',
      detail: 'Variable frame rate source. If re-encoded, the output uses a constant frame rate with audio kept in sync.',
    })
  }

  // ---------- Bitrate ----------
  const maxrate = targetMaxrate(opts.platform, fit.width, fit.height, outFps)
  const srcVideoKbps = v.bitrate ? v.bitrate / 1000 : undefined
  const bitrateTooHigh = srcVideoKbps !== undefined && srcVideoKbps > maxrate * preset.copyBitrateTolerance
  if (bitrateTooHigh) reasons.push('bitrate')

  const container = info.formatName
  const containerCopyable = /mov|mp4|m4a|3gp|matroska|webm|mpegts/.test(container)

  const needsVideoEncode =
    opts.forceReencode ||
    !isH264 ||
    !pixOk ||
    !eightBit ||
    v.isHdr ||
    fit.scale ||
    oddDims ||
    anamorphic ||
    fpsChanged ||
    bitrateTooHigh ||
    !containerCopyable

  // ---------- Audio ----------
  const a = info.audio
  let audio: RepackPlan['audio'] = null
  if (a) {
    const audioOk =
      a.codec === 'aac' &&
      (!a.profile || /LC/i.test(a.profile)) &&
      a.channels <= 2 &&
      (a.sampleRate === 44100 || a.sampleRate === 48000)
    if (audioOk && !opts.forceReencode) {
      audio = { copy: true }
      decisions.push({
        kind: 'keep',
        label: 'Audio',
        detail: `AAC ${a.sampleRate / 1000} kHz ${a.channels === 1 ? 'mono' : 'stereo'} copied as-is.`,
      })
    } else {
      const sampleRate = a.sampleRate === 44100 ? 44100 : 48000
      const channels = Math.min(2, Math.max(1, a.channels))
      const settings: AudioEncodeSettings = { copy: false, bitrateKbps: preset.audioKbps, sampleRate, channels }
      audio = settings
      decisions.push({
        kind: 'change',
        label: 'Audio',
        detail: `${codecName(a.codec)}${a.channels > 2 ? ` ${a.channels}ch` : ''} → AAC-LC ${preset.audioKbps} kbps ${channels === 1 ? 'mono' : 'stereo'}, ${sampleRate / 1000} kHz, kept in sync.`,
      })
    }
  } else {
    decisions.push({ kind: 'info', label: 'Audio', detail: 'No audio track. Output will be silent.' })
  }

  // ---------- Video settings ----------
  let video: RepackPlan['video']
  let mode: RepackPlan['mode']
  if (needsVideoEncode) {
    mode = 'full'
    const crf = preset.crf + qp.crfOffset
    const vs: VideoEncodeSettings = {
      copy: false,
      width: fit.width,
      height: fit.height,
      scale: fit.scale || anamorphic,
      cropToEven: !fit.scale && !anamorphic && oddDims,
      fps: outFps,
      fpsChanged,
      crf,
      maxrateKbps: maxrate,
      bufsizeKbps: maxrate * 2,
      preset: qp.preset,
      profile: 'high',
      level: h264Level(fit.width, fit.height, outFps),
      gop: Math.max(1, Math.round(outFps * 2)),
    }
    video = vs
    decisions.push({
      kind: 'change',
      label: 'Encoding',
      detail: `H.264 High, CRF ${crf} with a ${formatBitrate(maxrate * 1000)} peak${
        srcVideoKbps ? ` (source ${formatBitrate(srcVideoKbps * 1000)})` : ''
      }, x264 “${qp.preset}”, 2 s keyframes.`,
    })
    if (opts.forceReencode && reasons.length === 0) reasons.push('forced re-encode')
  } else {
    video = { copy: true }
    mode = audio && !audio.copy ? 'audio' : 'remux'
    decisions.push({
      kind: 'keep',
      label: 'Encoding',
      detail: `Video stream copied bit-for-bit${
        srcVideoKbps ? ` (${formatBitrate(srcVideoKbps * 1000)})` : ''
      }. Re-encoding would only lose quality.`,
    })
  }

  decisions.push({
    kind: 'change',
    label: 'Container',
    detail: 'MP4 with fast-start (index at the front) and personal metadata (GPS, device tags) removed.',
  })

  if (preset.durationHint && info.duration > preset.durationHint.seconds) {
    decisions.push({ kind: 'warn', label: 'Length', detail: preset.durationHint.message })
  }

  // ---------- Size estimate ----------
  const audioKbps = audio ? (audio.copy ? (a?.bitrate ?? 128_000) / 1000 : audio.bitrateKbps) : 0
  const videoKbps = needsVideoEncode ? maxrate : (srcVideoKbps ?? (info.bitrate ?? 0) / 1000)
  const estimatedMaxBytes = Math.round(((videoKbps + audioKbps) * 1000 * info.duration) / 8 * 1.03 + 64_000)

  const platformTag = opts.platform === 'tiktok' ? 'TikTok' : 'WAStatus'
  const outW = needsVideoEncode ? fit.width : v.displayWidth
  const outH = needsVideoEncode ? fit.height : v.displayHeight
  const outputFileName = buildOutputName(opts.originalName, platformTag, outW, outH, outFps)

  const plan: RepackPlan = {
    platform: opts.platform,
    quality: opts.quality,
    mode,
    video,
    audio,
    outWidth: outW,
    outHeight: outH,
    outFps,
    decisions,
    estimatedMaxBytes,
    args: [],
    outputFileName,
  }
  plan.args = buildArgs(plan, opts.inputPath, opts.outputPath)
  return plan
}

export function buildArgs(plan: RepackPlan, input: string, output: string): string[] {
  const args: string[] = ['-hide_banner', '-i', input, '-map', '0:v:0']
  if (plan.audio) args.push('-map', '0:a:0')
  args.push('-map_metadata', '-1', '-map_chapters', '-1', '-sn', '-dn')

  if (plan.video.copy) {
    args.push('-c:v', 'copy')
  } else {
    const vs = plan.video
    const filters: string[] = []
    if (vs.scale) filters.push(`scale=${vs.width}:${vs.height}:flags=lanczos`)
    else if (vs.cropToEven) filters.push('crop=trunc(iw/2)*2:trunc(ih/2)*2')
    filters.push(`fps=${fpsToArg(vs.fps)}`)
    filters.push('format=yuv420p', 'setsar=1')
    args.push(
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-preset', vs.preset,
      '-crf', String(vs.crf),
      '-maxrate', `${vs.maxrateKbps}k`,
      '-bufsize', `${vs.bufsizeKbps}k`,
      '-profile:v', vs.profile,
      '-level:v', vs.level,
      '-g', String(vs.gop),
      '-keyint_min', String(Math.max(1, Math.round(vs.fps))),
      '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-colorspace', 'bt709',
    )
  }

  if (plan.audio) {
    if (plan.audio.copy) {
      args.push('-c:a', 'copy')
    } else {
      args.push(
        '-c:a', 'aac',
        '-b:a', `${plan.audio.bitrateKbps}k`,
        '-ar', String(plan.audio.sampleRate),
        '-ac', String(plan.audio.channels),
        // Fill timestamp gaps so audio stays locked to video.
        '-af', 'aresample=async=1:first_pts=0',
      )
    }
  }

  args.push('-movflags', '+faststart', '-f', 'mp4', output)
  return args
}
