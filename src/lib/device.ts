/* Capability detection and processing limits. Mobile browsers cap a tab's
 * memory far below desktop, and FFmpeg.wasm keeps the output file in memory,
 * so limits are tighter there. */

export interface DeviceProfile {
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  isSafari: boolean
  /** navigator.deviceMemory (GB) when exposed, otherwise undefined. */
  memoryGB?: number
  cores: number
  canShareFiles: boolean
}

export interface SupportReport {
  supported: boolean
  problems: string[]
}

export interface Limits {
  maxInputBytes: number
  maxDurationSec: number
  /** Ceiling for the in-memory output file. */
  maxOutputBytes: number
}

const GB = 1024 ** 3
const MB = 1024 ** 2

let cached: DeviceProfile | null = null

export function getDevice(): DeviceProfile {
  if (cached) return cached
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(ua)
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)
  const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  let canShareFiles = false
  try {
    canShareFiles =
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([new Uint8Array(1)], 'probe.mp4', { type: 'video/mp4' })] })
  } catch {
    canShareFiles = false
  }
  cached = {
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid || /Mobi/i.test(ua),
    isSafari,
    memoryGB,
    cores: navigator.hardwareConcurrency || 2,
    canShareFiles,
  }
  return cached
}

export function checkSupport(): SupportReport {
  const problems: string[] = []
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
    problems.push('WebAssembly is not available in this browser.')
  }
  if (typeof Worker === 'undefined') {
    problems.push('Web Workers are not available in this browser.')
  }
  if (typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') {
    problems.push('This browser cannot create local file downloads.')
  }
  if (typeof ReadableStream === 'undefined') {
    problems.push('Streaming downloads are not supported by this browser.')
  }
  // Module workers: Safari 15+, Chrome 80+, Firefox 114+.
  let moduleWorkers = false
  try {
    const url = URL.createObjectURL(new Blob([''], { type: 'text/javascript' }))
    const w = new Worker(url, {
      get type() {
        moduleWorkers = true
        return 'module' as const
      },
    })
    w.terminate()
    URL.revokeObjectURL(url)
  } catch {
    /* ignore */
  }
  if (!moduleWorkers) problems.push('Module Web Workers are not supported. Please update your browser.')
  return { supported: problems.length === 0, problems }
}

export function getLimits(): Limits {
  const d = getDevice()
  const lowMemory = d.memoryGB !== undefined && d.memoryGB <= 2
  if (d.isMobile) {
    return {
      maxInputBytes: lowMemory ? 1 * GB : 2 * GB,
      maxDurationSec: lowMemory ? 5 * 60 : 10 * 60,
      maxOutputBytes: lowMemory ? 250 * MB : 450 * MB,
    }
  }
  return {
    maxInputBytes: 4 * GB,
    maxDurationSec: 30 * 60,
    maxOutputBytes: lowMemory ? 600 * MB : 1400 * MB,
  }
}

export const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', '3gp']
export const ACCEPT_ATTR = 'video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,video/3gpp,.mp4,.mov,.m4v,.webm,.mkv,.3gp'

export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const typeOk = file.type.startsWith('video/')
  if (!typeOk && !ACCEPTED_EXTENSIONS.includes(ext)) {
    return 'Unsupported file. Choose an MP4, MOV or WebM video.'
  }
  if (file.size === 0) return 'This file is empty.'
  const limits = getLimits()
  if (file.size > limits.maxInputBytes) {
    return `This file is ${(file.size / GB).toFixed(1)} GB. The limit on this device is ${(limits.maxInputBytes / GB).toFixed(0)} GB.`
  }
  return null
}
