// Responsive screenshots of each app stage (mobile + desktop).
const { chromium, devices } = require('playwright')
const fs = require('fs')
fs.mkdirSync('screenshots', { recursive: true })
;(async () => {
  const b = await chromium.launch()
  for (const [name, opts] of [
    ['iphone', { ...devices['iPhone 13'] }],
    ['android', { ...devices['Pixel 7'] }],
    ['desktop', { viewport: { width: 1440, height: 900 } }],
  ]) {
    delete opts.defaultBrowserType
    const ctx = await b.newContext(opts)
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.goto('http://localhost:4173/')
    await p.waitForTimeout(700)
    await p.screenshot({ path: `screenshots/${name}-1-landing.png`, fullPage: true })
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    await p.getByTestId('file-input').setInputFiles('test-media/uhd_hevc10_60.mov')
    await p.getByTestId('platform-tiktok').click()
    await p.getByTestId('plan').waitFor({ timeout: 120000 })
    await p.waitForTimeout(400)
    await p.screenshot({ path: `screenshots/${name}-2-plan.png`, fullPage: true })
    const overflow2 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    await p.getByTestId('start').click()
    await p.waitForFunction(() => parseInt(document.querySelector('[data-testid=progress-pct]')?.textContent || '0') >= 30, null, { timeout: 120000 })
    await p.screenshot({ path: `screenshots/${name}-3-processing.png` })
    await p.getByTestId('result').waitFor({ timeout: 300000 })
    await p.waitForTimeout(800)
    await p.screenshot({ path: `screenshots/${name}-4-result.png`, fullPage: true })
    const overflow3 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    console.log(name, 'horizontal overflow:', overflow, overflow2, overflow3, 'errors:', errs)
    await ctx.close()
  }
  await b.close()
})()
