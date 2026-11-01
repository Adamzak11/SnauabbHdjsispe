# ADMZK VIDEO REPACK

**REPACK SMART. POST IN HD.**

ADMZK VIDEO REPACK re-encodes and optimises videos *in the browser* before you post them to **TikTok** or
**WhatsApp Status**. It analyses the original, picks the least destructive way to make it platform-friendly, runs a
real FFmpeg job on the device, shows a before/after comparison, and gives you a clean fast-start MP4.

> **Honest scope:** TikTok and WhatsApp *always* re-encode uploads on their servers. ADMZK can't turn that off and
> does not guarantee HD after upload. It hands the platform a clean, correctly sized, standards-friendly file, which
> cuts *avoidable* quality loss (wrong size, odd frame rates, HDR/10-bit, exotic codecs, bloated or starved bitrates).

---

## Features

| Area | What it does |
| --- | --- |
| Upload | Drag & drop, or the mobile gallery/file picker. MP4, MOV, M4V, WebM, MKV, 3GP. Type, size and duration limits are validated per device. |
| Analysis | `ffprobe` (inside FFmpeg.wasm) reads codec, profile, resolution, SAR, rotation, fps (avg vs. real), bit depth, HDR transfer, bitrate and audio format. If ffprobe fails it falls back to parsing `ffmpeg -i` output. |
| Smart Repack engine | Chooses one of three paths: **lossless remux** (streams already compliant: copy them and fix the container), **audio-only** (copy video, re-encode audio to AAC), or **full re-encode** (H.264 High + AAC). It never upscales, never stretches (aspect is locked, SAR normalised), keeps the original fps up to the platform cap, snaps phone frame rates to broadcast rates, and keeps audio in sync (`aresample=async`, CFR output). |
| Presets | **TikTok**: up to 1080×1920, ≤60 fps, CRF 18, ~12 Mbps peak at 1080p30 (×1.4 above 30 fps), AAC 192k. **WhatsApp Status**: up to 1080×1920, ≤30 fps, CRF 20, ~8 Mbps peak, AAC 128k. Both: MP4, `+faststart`, BT.709 tags, 2 s GOP, personal metadata (GPS/device) stripped. |
| Speed modes | Fast (`superfast`), Balanced (`veryfast`), Max quality (`medium`). They only apply when a re-encode is needed. |
| Progress | Real progress parsed from FFmpeg's own `time=` / `frame=` / `fps=` stats against the probed duration, plus an ETA. Nothing is simulated. |
| Cancel / errors | Cancel terminates the FFmpeg worker immediately and frees its memory. The downloaded core is kept, so the next run doesn't download it again. Out-of-memory, corrupt-file and codec errors get readable messages and a one-tap “switch to Fast” retry. |
| Compare | Synchronised **wipe** (drag the divider) or **side-by-side** player, plus a table of size, resolution, fps, codec/profile, bitrate, audio and container. Output values come from probing the actual output file. |
| Download | Descriptive file name (`clip_ADMZK-TikTok_1080x1920_30fps.mp4`), a standard download, and a **Share / Save to Photos** button through the Web Share API on phones that support it. |
| Privacy | 100% client-side. No uploads, analytics or third-party requests. Fonts and the FFmpeg core are self-hosted. A strict CSP is set in `netlify.toml`. |

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`)
- `@ffmpeg/ffmpeg` 0.12 + `@ffmpeg/core` 0.12.10 (single-threaded WebAssembly build, with libx264, AAC, HEVC/VP9/AV1 decoders and ffprobe)
- Vitest for unit tests, plus a Playwright end-to-end script

## Architecture

```
src/
  lib/
    engine.ts     FFmpeg.wasm wrapper: lazy load with byte progress, WORKERFS input mount,
                  probe, run with real progress, cancel (worker terminate), cleanup
    planner.ts    Smart Repack decision engine → RepackPlan + exact FFmpeg args
    probe.ts      ffprobe JSON parser + `ffmpeg -i` log fallback parser (pure, unit tested)
    presets.ts    TikTok / WhatsApp Status targets and speed profiles
    device.ts     capability detection, per-device memory/size/duration limits, file validation
    format.ts     formatting + output file naming
  hooks/useRepack.ts   app state machine (upload → analyse → plan → process → result)
  components/          Landing, UploadZone, SourceCard, PlatformPicker, AnalysisPanel,
                       ProcessingPanel, Compare, ResultView, Stepper, Header, Footer, Logo
```

### Mobile memory strategy

- **Lazy loading:** the ~31 MB WASM core (≈10 MB gzipped over the network) is fetched only after a video is chosen.
  It's cached immutably, so later visits load it from the browser cache.
- **No input copy:** the source file is mounted with Emscripten **WORKERFS**, so FFmpeg reads straight from the `File`
  handle instead of copying the whole video into WebAssembly memory. This is the biggest saving on iPhones.
- **Lossless first:** compliant videos are remuxed, which takes seconds and almost no memory.
- **Per-device limits** (`device.ts`): phones get tighter caps on input size (1–2 GB), duration (5–10 min) and
  estimated output size (250–450 MB). Desktops allow 4 GB / 30 min / 1.4 GB. If a job would exceed them, the app says
  why before it starts.
- **Cleanup:** temporary files are deleted and WORKERFS is unmounted after every job. Object URLs are revoked on reset,
  and the worker is terminated on cancel, reset or a crash.
- **Workers:** FFmpeg runs in a dedicated module Web Worker, so the UI never blocks.

### Fallbacks

- If the browser lacks WebAssembly, module workers, Blob URLs or streams, the upload card is replaced by a clear
  explanation. The app never falls back to a server, because that would mean uploading private footage.
- If the browser can't *preview* the original (for example HEVC on some Android/desktop browsers), it still analyses
  and repacks it, and the comparison switches to side-by-side with a notice.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve dist/ on http://localhost:4173
npm test           # unit tests (planner, probe parsing, naming)
```

### End-to-end test

`scripts/e2e.mjs` drives the production build in headless Chromium through upload → platform → analysis → repack →
compare playback → download for several clips (compliant 1080p, 4K HEVC 10-bit 60 fps, VP9/Opus WebM, rotated phone
video, low-res, 4:4:4 + PCM, forced re-encode). It verifies each downloaded file with the system `ffprobe`: dimensions,
fps, codecs, `yuv420p`, AAC, fast-start atom order and A/V duration drift. It also tests a corrupt file, mid-job
cancellation and reset. You need system `ffmpeg`/`ffprobe` and Playwright with Chromium.

```bash
npm run test:media     # generates sample clips into test-media/ (needs system ffmpeg)
npm run build && npm run preview &
npm run test:e2e
```

## Deploying to Netlify

The repo is ready to deploy as is:

1. Push to GitHub/GitLab and click **“Add new site → Import an existing project”** in Netlify, *or* run
   `npx netlify deploy --prod` (it will use `netlify.toml`).
2. Build command `npm run build`, publish directory `dist` (both already set in `netlify.toml`).

`netlify.toml` sets SPA fallback, a strict Content-Security-Policy (self-hosted only, with `wasm-unsafe-eval`
and `blob:` for the engine), immutable caching for hashed assets, and the `application/wasm` MIME type.

## Browser support

| Browser | Status |
| --- | --- |
| Chrome / Edge (desktop & Android) 90+ | Full support |
| Safari 15+ (macOS, iPhone, iPad) | Supported (module workers, WORKERFS via `FileReaderSync`, `canShare` for Save to Photos) |
| Firefox 114+ | Supported |
| Samsung Internet 15+ | Supported (Chromium based) |

Encoding speed depends on the device. Remuxing a compliant clip takes seconds everywhere. Re-encoding a 1080p clip
with the single-threaded WASM x264 typically runs a few to ~20 fps, depending on the CPU and speed mode. Keep the
tab in the foreground on phones: iOS and Android may suspend background tabs.

## Notes & limitations

- HDR (HLG/PQ) sources are converted to 8-bit BT.709. The WASM build has no `zscale` for tone mapping, so colours can
  look slightly flatter. The app warns about this.
- WhatsApp may trim or split Status videos longer than about 60 s. The app shows a note.
- The multi-threaded FFmpeg core would be faster, but it needs cross-origin isolation (COOP/COEP) and is less stable
  on mobile Safari. The single-threaded core was chosen for reliability.

---

© ADMZK. TikTok and WhatsApp are trademarks of their respective owners. ADMZK is not affiliated with them.
