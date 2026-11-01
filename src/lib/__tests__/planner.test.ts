import { describe, expect, it } from 'vitest'
import { buildPlan, fitDimensions, snapFps, targetMaxrate } from '../planner'
import { parseFfmpegLog, parseProbeJson } from '../probe'
import { buildOutputName } from '../format'
import type { MediaInfo } from '../types'

const opts = (platform: 'tiktok' | 'whatsapp', extra = {}) => ({
  platform,
  quality: 'balanced' as const,
  forceReencode: false,
  inputPath: '/input/in.mp4',
  outputPath: '/out.mp4',
  originalName: 'My Clip (final).MOV',
  ...extra,
})

function media(v: Partial<NonNullable<MediaInfo['video']>> = {}, a: MediaInfo['audio'] | null = undefined as never): MediaInfo {
  return {
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    duration: 10,
    size: 10_000_000,
    bitrate: 8_000_000,
    source: 'ffprobe',
    video: {
      codec: 'h264',
      width: 1080,
      height: 1920,
      displayWidth: 1080,
      displayHeight: 1920,
      rotation: 0,
      sar: 1,
      fps: 30,
      variableFrameRate: false,
      pixFmt: 'yuv420p',
      bitDepth: 8,
      bitrate: 7_800_000,
      isHdr: false,
      ...v,
    },
    audio: a === undefined ? { codec: 'aac', profile: 'LC', sampleRate: 48000, channels: 2, bitrate: 128000 } : a,
  }
}

describe('fitDimensions', () => {
  it('never upscales', () => {
    expect(fitDimensions(480, 854, 1920, 1080)).toEqual({ width: 480, height: 854, scale: false })
  })
  it('downscales 4K portrait preserving aspect', () => {
    expect(fitDimensions(2160, 3840, 1920, 1080)).toEqual({ width: 1080, height: 1920, scale: true })
  })
  it('handles landscape 4K', () => {
    expect(fitDimensions(3840, 2160, 1920, 1080)).toEqual({ width: 1920, height: 1080, scale: true })
  })
  it('keeps aspect ratio within rounding for odd ratios', () => {
    const r = fitDimensions(1440, 3200, 1920, 1080)
    expect(r.height).toBeLessThanOrEqual(1920)
    expect(Math.abs(r.width / r.height - 1440 / 3200)).toBeLessThan(0.003)
    expect(r.width % 2).toBe(0)
  })
})

describe('snapFps', () => {
  it('snaps phone frame rates', () => {
    expect(snapFps(29.97)).toBe(29.97)
    expect(snapFps(30.02)).toBe(30)
    expect(snapFps(59.88)).toBe(59.94)
  })
})

describe('buildPlan', () => {
  it('remuxes a compliant TikTok video losslessly', () => {
    const p = buildPlan(media(), opts('tiktok'))
    expect(p.mode).toBe('remux')
    expect(p.args).toContain('copy')
    expect(p.args).toContain('+faststart')
  })
  it('re-encodes HEVC 10-bit 4K60 to 1080p H.264, keeping 60 fps on TikTok', () => {
    const p = buildPlan(
      media({ codec: 'hevc', width: 2160, height: 3840, displayWidth: 2160, displayHeight: 3840, fps: 60, pixFmt: 'yuv420p10le', bitDepth: 10 }),
      opts('tiktok'),
    )
    expect(p.mode).toBe('full')
    expect(p.outWidth).toBe(1080)
    expect(p.outHeight).toBe(1920)
    expect(p.outFps).toBe(60)
    expect(p.args.join(' ')).toContain('scale=1080:1920')
    expect(p.args).toContain('libx264')
  })
  it('caps WhatsApp at 30 fps', () => {
    const p = buildPlan(media({ fps: 60 }), opts('whatsapp'))
    expect(p.outFps).toBe(30)
    expect(p.mode).toBe('full')
  })
  it('re-encodes only audio when audio is incompatible', () => {
    const p = buildPlan(media({}, { codec: 'pcm_s16le', sampleRate: 48000, channels: 2 }), opts('tiktok'))
    expect(p.mode).toBe('audio')
    expect(p.args.join(' ')).toContain('-c:v copy')
    expect(p.args.join(' ')).toContain('-c:a aac')
  })
  it('handles silent video', () => {
    const p = buildPlan(media({}, null), opts('tiktok'))
    expect(p.args).not.toContain('0:a:0')
  })
  it('re-encodes when bitrate is far above the platform ceiling', () => {
    const p = buildPlan(media({ bitrate: 60_000_000 }), opts('whatsapp'))
    expect(p.mode).toBe('full')
  })
  it('respects forced re-encode', () => {
    expect(buildPlan(media(), opts('tiktok', { forceReencode: true })).mode).toBe('full')
  })
  it('generates meaningful filenames', () => {
    const p = buildPlan(media(), opts('whatsapp'))
    expect(p.outputFileName).toBe('My-Clip-final_ADMZK-WAStatus_1080x1920_30fps.mp4')
  })
  it('scales maxrate with resolution', () => {
    expect(targetMaxrate('tiktok', 720, 1280, 30)).toBeLessThan(targetMaxrate('tiktok', 1080, 1920, 30))
    expect(targetMaxrate('tiktok', 1080, 1920, 60)).toBeGreaterThan(targetMaxrate('tiktok', 1080, 1920, 30))
  })
})

describe('probe parsing', () => {
  it('parses ffprobe JSON with rotation', () => {
    const info = parseProbeJson(
      JSON.stringify({
        streams: [
          {
            codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p',
            r_frame_rate: '30/1', avg_frame_rate: '30/1', bit_rate: '5000000',
            side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }],
          },
          { codec_type: 'audio', codec_name: 'aac', sample_rate: '44100', channels: 2 },
        ],
        format: { format_name: 'mov,mp4', duration: '3.0', size: '2000000', bit_rate: '5300000' },
      }),
      2000000,
    )
    expect(info.video?.displayWidth).toBe(1080)
    expect(info.video?.displayHeight).toBe(1920)
    expect(info.audio?.sampleRate).toBe(44100)
  })
  it('detects HDR', () => {
    const info = parseProbeJson(
      JSON.stringify({
        streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1080, height: 1920, pix_fmt: 'yuv420p10le', avg_frame_rate: '30/1', color_transfer: 'arib-std-b67' }],
        format: { duration: '1' },
      }),
      1,
    )
    expect(info.video?.isHdr).toBe(true)
    expect(info.video?.bitDepth).toBe(10)
  })
  it('parses ffmpeg -i log fallback', () => {
    const log = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/input/a.mov':
  Duration: 00:00:12.50, start: 0.000000, bitrate: 9000 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main 10) (hvc1 / 0x31637668), yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67), 1920x1080, 8800 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)
      Side data:
        displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 160 kb/s (default)`
    const info = parseFfmpegLog(log, 1000)
    expect(info.duration).toBeCloseTo(12.5)
    expect(info.video?.codec).toBe('hevc')
    expect(info.video?.displayWidth).toBe(1080)
    expect(info.video?.fps).toBeCloseTo(29.97)
    expect(info.video?.isHdr).toBe(true)
    expect(info.audio?.channels).toBe(2)
  })
})

describe('buildOutputName', () => {
  it('sanitises names', () => {
    expect(buildOutputName('été à Paris!!.mov', 'TikTok', 1080, 1920, 29.97)).toBe('ete-a-Paris_ADMZK-TikTok_1080x1920_30fps.mp4')
  })
})
