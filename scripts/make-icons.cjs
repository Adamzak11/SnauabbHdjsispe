// Renders PNG app icons and the social preview image from SVG/HTML using the
// preinstalled Chromium. Run: node scripts/make-icons.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const svg = fs.readFileSync('public/favicon.svg', 'utf8')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  for (const [name, size, pad] of [['apple-touch-icon.png', 180, 0], ['icon-512.png', 512, 0]]) {
    await p.setViewportSize({ width: size, height: size })
    await p.setContent(`<body style="margin:0;background:#080808"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
    await p.screenshot({ path: `public/${name}`, omitBackground: false })
  }
  await p.setViewportSize({ width: 1200, height: 630 })
  await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:#080808;font-family:system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:80px;box-sizing:border-box;position:relative;overflow:hidden">
    <div style="position:absolute;top:-200px;left:300px;width:800px;height:500px;border-radius:50%;background:rgba(214,255,0,.12);filter:blur(100px)"></div>
    <div style="display:flex;align-items:center;gap:22px;position:relative">
      <div style="width:84px;height:84px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
      <div style="font-weight:800;font-size:54px;letter-spacing:-2px">ADM<span style="color:#D6FF00">Z</span>K <span style="font-weight:600;font-size:22px;letter-spacing:8px;color:rgba(255,255,255,.55);margin-left:10px">VIDEO REPACK</span></div>
    </div>
    <div style="margin-top:46px;font-weight:800;font-size:96px;line-height:.95;letter-spacing:-4px;position:relative">REPACK SMART.<br><span style="color:#D6FF00">POST IN HD.</span></div>
    <div style="margin-top:30px;font-size:26px;color:rgba(255,255,255,.6);position:relative">On-device video optimizer for TikTok &amp; WhatsApp Status</div>
  </body>`)
  await p.screenshot({ path: 'public/og.png' })
  await b.close()
  console.log('icons written')
})()
