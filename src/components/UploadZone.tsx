import { useCallback, useRef, useState } from 'react'
import { ACCEPT_ATTR } from '../lib/device'
import { formatBytes } from '../lib/format'
import { IconAlert, IconUpload } from './Icons'

interface Props {
  onFile: (f: File) => void
  error?: string | null
  maxBytes: number
  disabled?: boolean
}

export function UploadZone({ onFile, error, maxBytes, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const depth = useRef(0)

  const pick = useCallback(() => inputRef.current?.click(), [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setDrag(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a video to repack"
        aria-disabled={disabled}
        onClick={() => !disabled && pick()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            pick()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current++
          setDrag(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (depth.current === 0) setDrag(false)
        }}
        onDrop={onDrop}
        className={`group relative isolate cursor-pointer overflow-hidden rounded-[28px] border-2 border-dashed p-7 text-center transition-all duration-300 sm:p-10 ${
          drag
            ? 'scale-[1.01] border-lime bg-lime/[0.06]'
            : 'border-white/12 bg-white/[0.02] hover:border-lime/60 hover:bg-white/[0.035]'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-lime/25 blur-3xl transition-opacity duration-500 ${
            drag ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
        />
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-lime text-ink shadow-[0_12px_40px_-10px_rgba(214,255,0,0.7)] transition-transform duration-300 group-hover:-translate-y-1">
          <IconUpload width={28} height={28} strokeWidth={2.4} />
        </div>
        <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {drag ? 'Drop it. We’ll take it from here.' : 'Choose a video'}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
          <span className="hidden sm:inline">Drag & drop a file here, or click to browse. </span>
          <span className="sm:hidden">Tap to pick from your gallery or files. </span>
          MP4, MOV or WebM, up to {formatBytes(maxBytes, 0)}.
        </p>
        <div className="mt-6 flex justify-center">
          <span className="btn-primary pointer-events-none !px-7 !py-3.5">
            <IconUpload width={18} height={18} strokeWidth={2.6} />
            Upload video
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 animate-fade-in"
        >
          <IconAlert className="mt-0.5 shrink-0" width={18} height={18} />
          {error}
        </div>
      )}
    </div>
  )
}
