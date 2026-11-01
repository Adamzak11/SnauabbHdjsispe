import type { AudioStreamInfo, MediaInfo, VideoStreamInfo } from './types'

/* Pure parsing helpers for ffprobe JSON output and, as a fallback, the stream
 * summary that `ffmpeg -i` prints. Kept free of FFmpeg/browser dependencies so
 * they can be unit tested. */

interface ProbeStream {
  codec_type?: string
  codec_name?: string
  codec_long_name?: string
  profile?: string
  width?: number
  height?: number
  sample_aspect_ratio?: string
  pix_fmt?: string
  bits_per_raw_sample?: string
  r_frame_rate?: string
  avg_frame_rate?: string
  bit_rate?: string
  color_transfer?: string
  color_primaries?: string
  color_space?: string
  sample_rate?: string
  channels?: number
  tags?: Record<string, string>
  side_data_list?: Array<{ side_data_type?: string; rotation?: number }>
  disposition?: { attached_pic?: number }
}

interface ProbeJson {
  streams?: ProbeStream[]
  format?: {
    format_name?: string
    format_long_name?: string
    duration?: string
    size?: string
    bit_rate?: string
  }
}

export function parseRate(rate?: string): number {
  if (!rate) return 0
  const [n, d] = rate.split('/').map(Number)
  if (!d) return Number.isFinite(n) ? n : 0
  const v = n / d
  return Number.isFinite(v) ? v : 0
}

function parseRatio(r?: string): number {
  if (!r || r === '0:1' || r === 'N/A') return 1
  const [n, d] = r.split(':').map(Number)
  if (!n || !d) return 1
  return n / d
}

export function normaliseRotation(deg: number): number {
  const r = ((Math.round(deg / 90) * 90) % 360 + 360) % 360
  return r
}

function bitDepthFromPixFmt(pixFmt?: string, raw?: string): number {
  const fromRaw = Number(raw)
  if (fromRaw > 0) return fromRaw
  if (!pixFmt) return 8
  const m = pixFmt.match(/p(9|10|12|14|16)(le|be)?$/)
  return m ? Number(m[1]) : 8
}

const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67'])

export function buildVideoInfo(input: {
  codec: string
  codecLong?: string
  profile?: string
  width: number
  height: number
  sar: number
  rotation: number
  rFps: number
  avgFps: number
  pixFmt?: string
  bitDepth?: number
  bitrate?: number
  colorTransfer?: string
  colorPrimaries?: string
  colorSpace?: string
}): VideoStreamInfo {
  const rotation = normaliseRotation(input.rotation)
  const sar = input.sar > 0 ? input.sar : 1
  let dw = Math.round(input.width * sar)
  let dh = input.height
  if (rotation === 90 || rotation === 270) [dw, dh] = [dh, dw]

  // avg_frame_rate reflects real playback; r_frame_rate is the timebase guess.
  let fps = input.avgFps > 0 && input.avgFps < 1000 ? input.avgFps : input.rFps
  if (!(fps > 0 && fps < 1000)) fps = 30
  const variableFrameRate =
    input.rFps > 0 && input.avgFps > 0 && Math.abs(input.rFps - input.avgFps) / input.rFps > 0.05

  return {
    codec: input.codec,
    codecLong: input.codecLong,
    profile: input.profile,
    width: input.width,
    height: input.height,
    displayWidth: dw,
    displayHeight: dh,
    rotation,
    sar,
    fps,
    variableFrameRate,
    pixFmt: input.pixFmt,
    bitDepth: input.bitDepth ?? bitDepthFromPixFmt(input.pixFmt),
    bitrate: input.bitrate,
    colorTransfer: input.colorTransfer,
    colorPrimaries: input.colorPrimaries,
    colorSpace: input.colorSpace,
    isHdr: !!input.colorTransfer && HDR_TRANSFERS.has(input.colorTransfer),
  }
}

export function parseProbeJson(text: string, fileSize: number): MediaInfo {
  const json = JSON.parse(text) as ProbeJson
  const streams = json.streams ?? []
  const vs = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic)
  const as = streams.find((s) => s.codec_type === 'audio')

  let video: VideoStreamInfo | null = null
  if (vs && vs.width && vs.height) {
    let rotation = 0
    const sd = vs.side_data_list?.find((d) => typeof d.rotation === 'number')
    if (sd?.rotation !== undefined) {
      // ffprobe reports the display-matrix rotation counter-clockwise; ffmpeg's
      // autorotate treats -90 as "rotate 90° clockwise". Only the axis swap matters for sizing.
      rotation = -sd.rotation
    } else if (vs.tags?.rotate) {
      rotation = Number(vs.tags.rotate) || 0
    }
    video = buildVideoInfo({
      codec: vs.codec_name ?? 'unknown',
      codecLong: vs.codec_long_name,
      profile: vs.profile,
      width: vs.width,
      height: vs.height,
      sar: parseRatio(vs.sample_aspect_ratio),
      rotation,
      rFps: parseRate(vs.r_frame_rate),
      avgFps: parseRate(vs.avg_frame_rate),
      pixFmt: vs.pix_fmt,
      bitDepth: bitDepthFromPixFmt(vs.pix_fmt, vs.bits_per_raw_sample),
      bitrate: vs.bit_rate ? Number(vs.bit_rate) || undefined : undefined,
      colorTransfer: vs.color_transfer,
      colorPrimaries: vs.color_primaries,
      colorSpace: vs.color_space,
    })
  }

  let audio: AudioStreamInfo | null = null
  if (as) {
    audio = {
      codec: as.codec_name ?? 'unknown',
      profile: as.profile,
      sampleRate: Number(as.sample_rate) || 48000,
      channels: as.channels ?? 2,
      bitrate: as.bit_rate ? Number(as.bit_rate) || undefined : undefined,
    }
  }

  const fmt = json.format ?? {}
  const duration = Number(fmt.duration) || 0
  const size = Number(fmt.size) || fileSize
  const bitrate = Number(fmt.bit_rate) || (duration > 0 ? (size * 8) / duration : undefined)

  // Estimate the video bitrate when the container doesn't report it per-stream (MKV/WebM).
  if (video && !video.bitrate && bitrate) {
    const audioBits = audio?.bitrate ?? (audio ? 128_000 : 0)
    video.bitrate = Math.max(0, bitrate - audioBits)
  }

  return {
    formatName: fmt.format_name ?? 'unknown',
    formatLong: fmt.format_long_name,
    duration,
    size,
    bitrate,
    video,
    audio,
    source: 'ffprobe',
  }
}

/** Parse the human-readable stream summary printed by `ffmpeg -i file`. */
export function parseFfmpegLog(log: string, fileSize: number): MediaInfo {
  const formatMatch = log.match(/Input #0, ([^,]+(?:,[^,\s]+)*), from/)
  const durMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  const brMatch = log.match(/bitrate:\s*(\d+)\s*kb\/s/)
  const duration = durMatch ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]) : 0

  let video: VideoStreamInfo | null = null
  const vLine = log.split('\n').find((l) => /Stream #0:\d+.*Video:/.test(l) && !/attached pic/.test(l))
  if (vLine) {
    const codec = vLine.match(/Video:\s*([a-z0-9_]+)/i)?.[1] ?? 'unknown'
    const profile = vLine.match(/Video:\s*[a-z0-9_]+\s*\(([^)]+)\)/i)?.[1]
    const dims = vLine.match(/,\s*(\d{2,5})x(\d{2,5})/)
    const sar = vLine.match(/SAR (\d+):(\d+)/)
    const fps = vLine.match(/([\d.]+)\s*fps/)
    const tbr = vLine.match(/([\d.]+)\s*tbr/)
    const vbr = vLine.match(/(\d+)\s*kb\/s/)
    const pix = vLine.match(/Video:[^,]+,\s*([a-z0-9_]+)/i)?.[1]
    const colorM = vLine.match(/\(([a-z]+)?,?\s*([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\)/i)
    const rot = log.match(/rotation of (-?[\d.]+) degrees/)
    if (dims) {
      video = buildVideoInfo({
        codec,
        profile,
        width: Number(dims[1]),
        height: Number(dims[2]),
        sar: sar ? Number(sar[1]) / Number(sar[2]) || 1 : 1,
        rotation: rot ? -Number(rot[1]) : 0,
        rFps: tbr ? Number(tbr[1]) : 0,
        avgFps: fps ? Number(fps[1]) : 0,
        pixFmt: pix,
        bitrate: vbr ? Number(vbr[1]) * 1000 : undefined,
        colorSpace: colorM?.[2],
        colorPrimaries: colorM?.[3],
        colorTransfer: colorM?.[4],
      })
    }
  }

  let audio: AudioStreamInfo | null = null
  const aLine = log.split('\n').find((l) => /Stream #0:\d+.*Audio:/.test(l))
  if (aLine) {
    const codec = aLine.match(/Audio:\s*([a-z0-9_]+)/i)?.[1] ?? 'unknown'
    const profile = aLine.match(/Audio:\s*[a-z0-9_]+\s*\(([^)]+)\)/i)?.[1]
    const sr = aLine.match(/(\d+)\s*Hz/)
    const ch = /mono/.test(aLine) ? 1 : /stereo/.test(aLine) ? 2 : /5\.1/.test(aLine) ? 6 : 2
    const abr = aLine.match(/(\d+)\s*kb\/s/)
    audio = {
      codec,
      profile,
      sampleRate: sr ? Number(sr[1]) : 48000,
      channels: ch,
      bitrate: abr ? Number(abr[1]) * 1000 : undefined,
    }
  }

  const bitrate = brMatch ? Number(brMatch[1]) * 1000 : duration > 0 ? (fileSize * 8) / duration : undefined
  if (video && !video.bitrate && bitrate) {
    video.bitrate = Math.max(0, bitrate - (audio?.bitrate ?? (audio ? 128_000 : 0)))
  }

  return {
    formatName: formatMatch?.[1] ?? 'unknown',
    duration,
    size: fileSize,
    bitrate,
    video,
    audio,
    source: 'ffmpeg-log',
  }
}
