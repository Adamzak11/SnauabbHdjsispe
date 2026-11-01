// End-to-end test: drives the production build in headless Chromium through the
// full upload → platform → analyse → repack → compare → download flow, then
// verifies every output file with the system ffprobe.
//   npm run build && npx vite preview --port 4173 &  node scripts/e2e.mjs
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const MEDIA = path.resolve('test-media')
const OUT = path.resolve('test-results')
mkdirSync(OUT, { recursive: true })

const CASES = [
  { file: 'compliant_1080x1920_30.mp4', platform: 'tiktok', expectMode: 'Lossless repack', w: 1080, h: 1920, fps: 30, vcodec: 'h264' },
  { file: 'uhd_hevc10_60.mov', platform: 'tiktok', expectMode: 'Optimised re-encode', w: 1080, h: 1920, fps: 60, vcodec: 'h264' },
  { file: 'uhd_hevc10_60.mov', platform: 'whatsapp', expectMode: 'Optimised re-encode', w: 1080, h: 1920, fps: 30, vcodec: 'h264' },
  { file: 'landscape_vp9.webm', platform: 'whatsapp', expectMode: 'Optimised re-encode', w: 1280, h: 720, fps: 25, vcodec: 'h264' },
  { file: 'rotated_1920x1080_r90.mp4', platform: 'tiktok', expectMode: 'Lossless repack', w: 1080, h: 1920, fps: 30, vcodec: 'h264', rotated: true },
  { file: 'lowres_480x854.mp4', platform: 'whatsapp', expectMode: 'Lossless repack', w: 480, h: 854, fps: 30, vcodec: 'h264' },
  { file: 'odd_444_pcm.mov', platform: 'tiktok', expectMode: 'Optimised re-encode', w: 720, h: 1280, fps: 30, vcodec: 'h264' },
  { file: 'compliant_1080x1920_30.mp4', platform: 'whatsapp', force: true, expectMode: 'Optimised re-encode', w: 1080, h: 1920, fps: 30, vcodec: 'h264' },
]

function probe(file) {
  const j = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]).toString(),
  )
  const v = j.streams.find((s) => s.codec_type === 'video')
  const a = j.streams.find((s) => s.codec_type === 'audio')
  let rot = 0
  const sd = v.side_data_list?.find((d) => 'rotation' in d)
  if (sd) rot = Math.abs(sd.rotation)
  const [w, h] = rot === 90 ? [v.height, v.width] : [v.width, v.height]
  const [n, d] = v.avg_frame_rate.split('/').map(Number)
  return { w, h, fps: n / d, vcodec: v.codec_name, pix: v.pix_fmt, acodec: a?.codec_name, duration: Number(j.format.duration), vdur: Number(v.duration), adur: a ? Number(a.duration) : 0 }
}

function faststart(file) {
  // moov must come before mdat
  const buf = execFileSync('head', ['-c', '65536', file])
  const s = buf.toString('latin1')
  const moov = s.indexOf('moov')
  const mdat = s.indexOf('mdat')
  return moov !== -1 && (mdat === -1 || moov < mdat)
}

const browser = await chromium.launch()
let failures = 0

async function runCase(ctx, c) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE)
  await page.getByTestId('file-input').setInputFiles(path.join(MEDIA, c.file))
  await page.getByTestId(`platform-${c.platform}`).click()
  await page.getByTestId('plan').waitFor({ timeout: 120_000 })
  if (c.force) {
    await page.getByTestId('force-reencode').check()
  }
  const planText = await page.getByTestId('plan').innerText()
  if (!planText.includes(c.expectMode)) throw new Error(`Plan mode mismatch. Got:\n${planText.slice(0, 200)}`)
  const t0 = Date.now()
  const samples = []
  await page.getByTestId('start').click()
  const poll = setInterval(async () => {
    const t = await page.getByTestId('progress-pct').innerText().catch(() => null)
    if (t) samples.push(parseInt(t))
  }, 250)
  await page.getByTestId('result').waitFor({ timeout: 600_000 })
  clearInterval(poll)
  const elapsed = Date.now() - t0
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()])
  const name = dl.suggestedFilename()
  const dest = path.join(OUT, `${c.platform}-${name}`)
  await dl.saveAs(dest)
  // Play the processed video in the compare view.
  await page.getByTestId('compare-play').click()
  await page.waitForTimeout(600)
  const playing = await page.getByTestId('processed-video').evaluate((v) => v.currentTime > 0)
  const p = probe(dest)
  const fs = faststart(dest)
  const okDims = p.w === c.w && p.h === c.h
  const okFps = Math.abs(p.fps - c.fps) < 0.6
  const syncDrift = p.adur ? Math.abs(p.vdur - p.adur) : 0
  const ok = okDims && okFps && p.vcodec === c.vcodec && (p.acodec === 'aac') && fs && p.pix === 'yuv420p' && syncDrift < 0.1 && playing && errors.length === 0
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.file} → ${c.platform}${c.force ? ' (forced)' : ''}  ${elapsed}ms  out=${name}  ${p.w}x${p.h} ${p.fps.toFixed(2)}fps ${p.vcodec}/${p.pix}/${p.acodec} faststart=${fs} avDrift=${syncDrift.toFixed(3)}s played=${playing} progressSamples=${[...new Set(samples)].slice(0, 12).join(',')}`,
  )
  if (errors.length) console.log('   console errors:', errors.slice(0, 5))
  if (!ok) failures++
  await page.close()
}

const ctx = await browser.newContext({ acceptDownloads: true })
for (const c of CASES) {
  try {
    await runCase(ctx, c)
  } catch (e) {
    failures++
    console.log(`FAIL  ${c.file} → ${c.platform}: ${e.message}`)
  }
}

// Invalid file: must show an analysis error, not crash.
{
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByTestId('file-input').setInputFiles(path.join(MEDIA, 'bad.mp4'))
  const alert = page.getByRole('alert').first()
  await alert.waitFor({ timeout: 120_000 })
  console.log(`${(await alert.innerText()).includes('Analysis failed') ? 'PASS' : 'FAIL'}  bad.mp4 → ${(await alert.innerText()).replace(/\n/g, ' ').slice(0, 120)}`)
  await page.close()
}

// Cancellation: start a long re-encode, cancel mid-way, then re-run to completion.
{
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByTestId('file-input').setInputFiles(path.join(MEDIA, 'long_20s.mp4'))
  await page.getByTestId('platform-whatsapp').click()
  await page.getByTestId('plan').waitFor({ timeout: 120_000 })
  await page.getByTestId('force-reencode').check()
  await page.getByTestId('start').click()
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid=progress-pct]')
    return el && parseInt(el.textContent) >= 5
  }, null, { timeout: 120_000 })
  const at = await page.getByTestId('progress-pct').innerText()
  await page.getByTestId('cancel').click()
  await page.getByTestId('start').waitFor({ timeout: 10_000 })
  const backToReady = await page.getByTestId('start').isEnabled()
  await page.getByTestId('quality-fast').click()
  await page.getByTestId('start').click()
  await page.getByTestId('result').waitFor({ timeout: 600_000 })
  console.log(`${backToReady ? 'PASS' : 'FAIL'}  cancel at ${at.replace(/\n/g, '')} then re-run completed`)
  if (!backToReady) failures++
  await page.getByTestId('new-project').click()
  await page.getByTestId('file-input').waitFor({ state: 'attached' })
  console.log('PASS  reset returns to upload screen')
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
