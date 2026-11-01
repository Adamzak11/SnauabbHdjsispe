import type { PlatformId, QualityMode } from './types'

export interface PlatformPreset {
  id: PlatformId
  name: string
  short: string
  description: string
  /** Max long edge / short edge of the output, in display orientation. */
  maxLong: number
  maxShort: number
  /** Highest frame rate we keep. Anything above is reduced to this. */
  fpsCap: number
  /** Base CRF for H.264 (lower = higher quality). */
  crf: number
  /** Peak video bitrate for 1080x1920 @ ≤30 fps, kbit/s. */
  maxrate1080p30: number
  /** Multiplier applied to the peak bitrate above 30 fps. */
  highFpsBoost: number
  /** We keep a compliant source untouched while its video bitrate is ≤ this × the cap. */
  copyBitrateTolerance: number
  audioKbps: number
  /** Platform-specific notes shown to the user. */
  notes: string[]
  /** Soft duration hint (seconds) after which we warn. */
  durationHint?: { seconds: number; message: string }
  features: string[]
}

export const PRESETS: Record<PlatformId, PlatformPreset> = {
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    short: 'TT',
    description: 'Clean 1080p H.264 master that holds up under TikTok’s own encoding.',
    maxLong: 1920,
    maxShort: 1080,
    fpsCap: 60,
    crf: 18,
    maxrate1080p30: 12000,
    highFpsBoost: 1.4,
    copyBitrateTolerance: 1.5,
    audioKbps: 192,
    notes: [
      'Upload the file from your gallery in the TikTok app, and turn on “Upload HD” / high-quality upload in the app settings where available.',
    ],
    features: ['Up to 1080×1920', 'Keeps up to 60 fps', 'H.264 High + AAC 192k', 'Fast-start MP4'],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Status',
    short: 'WA',
    description: 'Leaner bitrate with frame rate capped at 30 fps, so WhatsApp has less to squeeze.',
    maxLong: 1920,
    maxShort: 1080,
    fpsCap: 30,
    crf: 20,
    maxrate1080p30: 8000,
    highFpsBoost: 1,
    copyBitrateTolerance: 1.25,
    audioKbps: 128,
    notes: [
      'In WhatsApp, pick the “HD” option when posting the Status where it is offered.',
    ],
    durationHint: {
      seconds: 60,
      message: 'WhatsApp may trim or split Status videos longer than about 60 seconds.',
    },
    features: ['Up to 1080×1920', 'Capped at 30 fps', 'H.264 High + AAC 128k', 'Fast-start MP4'],
  },
}

export interface QualityProfile {
  id: QualityMode
  label: string
  hint: string
  /** x264 preset. */
  preset: string
  /** Added to the platform CRF. */
  crfOffset: number
}

export const QUALITY_PROFILES: Record<QualityMode, QualityProfile> = {
  fast: { id: 'fast', label: 'Fast', hint: 'Quickest, lighter on memory', preset: 'superfast', crfOffset: 1 },
  balanced: { id: 'balanced', label: 'Balanced', hint: 'Best speed/quality mix', preset: 'veryfast', crfOffset: 0 },
  quality: { id: 'quality', label: 'Max quality', hint: 'Slowest, best detail', preset: 'medium', crfOffset: 0 },
}
