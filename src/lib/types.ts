export type PlatformId = 'tiktok' | 'whatsapp'

export type QualityMode = 'fast' | 'balanced' | 'quality'

export interface VideoStreamInfo {
  codec: string
  codecLong?: string
  profile?: string
  /** Coded (stored) width/height. */
  width: number
  height: number
  /** Width/height as displayed: rotation and sample aspect ratio applied. */
  displayWidth: number
  displayHeight: number
  /** Rotation in degrees, normalised to 0 / 90 / 180 / 270. */
  rotation: number
  /** Sample aspect ratio (1 = square pixels). */
  sar: number
  /** Average frame rate, frames per second. */
  fps: number
  /** True when r_frame_rate and avg_frame_rate disagree noticeably. */
  variableFrameRate: boolean
  pixFmt?: string
  bitDepth: number
  /** Bits per second, when the container reports it. */
  bitrate?: number
  colorTransfer?: string
  colorPrimaries?: string
  colorSpace?: string
  isHdr: boolean
}

export interface AudioStreamInfo {
  codec: string
  profile?: string
  sampleRate: number
  channels: number
  bitrate?: number
}

export interface MediaInfo {
  formatName: string
  formatLong?: string
  /** Seconds. */
  duration: number
  /** Bytes. */
  size: number
  /** Total bits per second. */
  bitrate?: number
  video: VideoStreamInfo | null
  audio: AudioStreamInfo | null
  /** Source of the information, for diagnostics. */
  source: 'ffprobe' | 'ffmpeg-log'
}

export interface QuickMeta {
  duration: number
  width: number
  height: number
  /** Whether this browser can play the original natively. */
  playable: boolean
}

export type DecisionKind = 'keep' | 'change' | 'warn' | 'info'

export interface Decision {
  kind: DecisionKind
  label: string
  detail: string
}

export interface VideoEncodeSettings {
  copy: false
  width: number
  height: number
  /** Whether a scale filter is required (otherwise crop-to-even or none). */
  scale: boolean
  /** Crop 1px when the source has odd dimensions and no scaling happens. */
  cropToEven: boolean
  fps: number
  fpsChanged: boolean
  crf: number
  maxrateKbps: number
  bufsizeKbps: number
  preset: string
  profile: 'high' | 'main'
  level: string
  gop: number
}

export interface AudioEncodeSettings {
  copy: false
  bitrateKbps: number
  sampleRate: number
  channels: number
}

export type PlanMode = 'remux' | 'audio' | 'full'

export interface RepackPlan {
  platform: PlatformId
  quality: QualityMode
  mode: PlanMode
  video: VideoEncodeSettings | { copy: true }
  audio: AudioEncodeSettings | { copy: true } | null
  outWidth: number
  outHeight: number
  outFps: number
  decisions: Decision[]
  /** Upper bound of the output size in bytes. */
  estimatedMaxBytes: number
  args: string[]
  outputFileName: string
}

export interface RepackResult {
  blob: Blob
  url: string
  fileName: string
  info: MediaInfo | null
  elapsedMs: number
  plan: RepackPlan
}
