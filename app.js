import { FFmpeg } from './vendor/ffmpeg/index.js';
import { fetchFile, toBlobURL } from './vendor/util/index.js';

const $ = (s) => document.querySelector(s);
const state = { platform: 'whatsapp', items: [], running: false };
let ffmpeg = null;
let ffLog = () => {};

// ---------- UI ----------
document.querySelectorAll('#platform button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#platform button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    state.platform = b.dataset.value;
    $('#splitWrap').style.display = state.platform === 'whatsapp' ? '' : 'none';
  });
});

const drop = $('#drop');
$('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
$('#startBtn').addEventListener('click', runQueue);

function addFiles(list) {
  for (const file of list) {
    const kind = file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('image/') ? 'image'
      : /\.(mp4|mov|mkv|webm|avi|3gp|m4v)$/i.test(file.name) ? 'video'
      : /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name) ? 'image' : null;
    if (!kind) continue;
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="item-head"><span class="name"></span><button class="remove" title="Buang">✕</button></div>
      <div class="bar"><i></i></div>
      <div class="status">Menunggu…</div>
      <div class="outputs"></div>`;
    li.querySelector('.name').textContent = `${kind === 'video' ? '🎬' : '🖼️'} ${file.name} · ${fmtSize(file.size)}`;
    const item = { file, kind, li, done: false };
    li.querySelector('.remove').addEventListener('click', () => {
      if (item.busy) return;
      state.items = state.items.filter((x) => x !== item);
      li.remove();
      if (!state.items.length) $('#queueCard').hidden = true;
    });
    state.items.push(item);
    $('#queue').appendChild(li);
  }
  $('#queueCard').hidden = state.items.length === 0;
}

function setStatus(item, text, pct, err = false) {
  const s = item.li.querySelector('.status');
  s.textContent = text;
  s.classList.toggle('err', err);
  if (pct != null) item.li.querySelector('.bar i').style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function getSettings() {
  return {
    platform: state.platform,
    res: Number($('#resolution').value),
    fps: Number($('#fps').value),
    split: state.platform === 'whatsapp' ? Number($('#split').value) : 0,
    fill: $('#fill').checked,
  };
}

async function runQueue() {
  if (state.running) return;
  state.running = true;
  $('#startBtn').disabled = true;
  const opts = getSettings();
  for (const item of state.items) {
    if (item.done) continue;
    item.busy = true;
    item.li.querySelector('.outputs').innerHTML = '';
    try {
      const outs = item.kind === 'image' ? await processImage(item, opts) : await processVideo(item, opts);
      outs.forEach((o) => addOutput(item, o));
      item.done = true;
      setStatus(item, `Siap ✓ ${outs.length > 1 ? `(${outs.length} bahagian)` : ''}`, 100);
    } catch (e) {
      console.error(e);
      setStatus(item, `Gagal: ${e.message || e}`, 0, true);
    }
    item.busy = false;
  }
  state.running = false;
  $('#startBtn').disabled = false;
}

function addOutput(item, { blob, name, width, height }) {
  const url = URL.createObjectURL(blob);
  const div = document.createElement('div');
  div.className = 'out';
  const isVid = blob.type.startsWith('video/');
  div.innerHTML = `
    ${isVid ? `<video src="${url}#t=0.1" muted playsinline controls preload="metadata"></video>` : `<img src="${url}" alt="">`}
    <div class="meta">
      <div><b></b></div>
      <div class="muted">${width}×${height} · ${fmtSize(blob.size)}</div>
      <div class="actions" style="margin-top:8px">
        <a class="btn" href="${url}" download="${name}">Muat turun</a>
      </div>
    </div>`;
  div.querySelector('b').textContent = name;
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    const btn = document.createElement('button');
    btn.className = 'btn alt';
    btn.textContent = 'Kongsi';
    btn.addEventListener('click', () => navigator.share({ files: [file] }).catch(() => {}));
    div.querySelector('.actions').appendChild(btn);
  }
  item.li.querySelector('.outputs').appendChild(div);
}

// ---------- helpers ----------
function fmtSize(b) {
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const baseName = (n) => n.replace(/\.[^.]+$/, '');

/** Fit (w,h) inside a 9:16 / 16:9 box of the chosen resolution, without upscaling. */
function fitDims(w, h, res) {
  const long = Math.round(res * 16 / 9);
  const [bw, bh] = h >= w ? [res, long] : [long, res];
  const scale = Math.min(1, bw / w, bh / h);
  return [even(w * scale), even(h * scale)];
}

// ---------- images ----------
async function processImage(item, o) {
  setStatus(item, 'Memproses gambar…', 20);
  let bmp;
  try {
    bmp = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Format gambar tidak disokong oleh browser ini (cuba tukar ke JPG/PNG).'));
      img.src = URL.createObjectURL(item.file);
    });
  }
  const sw = bmp.width, sh = bmp.height;
  let W, H;
  if (o.fill) { W = o.res; H = Math.round(o.res * 16 / 9); } else { [W, H] = fitDims(sw, sh, o.res); }

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  if (o.fill) {
    // blurred cover background
    const cs = Math.max(W / sw, H / sh);
    ctx.filter = 'blur(40px) brightness(0.8)';
    ctx.drawImage(bmp, (W - sw * cs) / 2, (H - sh * cs) / 2, sw * cs, sh * cs);
    ctx.filter = 'none';
    const fs = Math.min(W / sw, H / sh);
    const fw = Math.round(sw * fs), fh = Math.round(sh * fs);
    ctx.drawImage(stepDown(bmp, fw, fh), Math.round((W - fw) / 2), Math.round((H - fh) / 2), fw, fh);
  } else {
    ctx.drawImage(stepDown(bmp, W, H), 0, 0, W, H);
  }
  setStatus(item, 'Mengekod JPEG…', 70);

  // WhatsApp keeps photos under ~5MB best; TikTok photo mode is fine with high quality.
  const maxBytes = o.platform === 'whatsapp' ? 4.5 * 1048576 : 8 * 1048576;
  let q = 0.93, blob;
  do {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    q -= 0.05;
  } while (blob.size > maxBytes && q > 0.6);

  return [{ blob, name: `${baseName(item.file.name)}_HD.jpg`, width: W, height: H }];
}

/** Halve repeatedly for big downscales — sharper result than one big drawImage. */
function stepDown(src, tw, th) {
  let cur = src, cw = src.width, ch = src.height;
  while (cw / 2 > tw && ch / 2 > th) {
    const c = document.createElement('canvas');
    c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  return cur;
}

// ---------- video ----------
async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;
  const st = $('#engineStatus');
  st.textContent = 'Memuatkan enjin video (~32MB, sekali sahaja)…';
  const f = new FFmpeg();
  f.on('log', ({ message }) => ffLog(message));
  const base = new URL('./vendor/core/', import.meta.url).href;
  await f.load({
    coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
  });
  st.textContent = 'Enjin video sedia.';
  ffmpeg = f;
  return f;
}

async function probe(f, input) {
  const lines = [];
  ffLog = (m) => lines.push(m);
  await f.exec(['-hide_banner', '-i', input]).catch(() => {});
  ffLog = () => {};
  const text = lines.join('\n');
  const d = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = text.match(/Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/);
  const fps = text.match(/(\d+(?:\.\d+)?)\s*fps/);
  const rot = text.match(/rotation of (-?\d+(?:\.\d+)?) degrees/) || text.match(/rotate\s*:\s*(-?\d+)/);
  if (!v) throw new Error('Tiada trek video dijumpai dalam fail ini.');
  let w = +v[1], h = +v[2];
  if (rot && Math.abs(Math.round(+rot[1])) % 180 === 90) [w, h] = [h, w];
  return {
    duration: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0,
    width: w,
    height: h,
    fps: fps ? parseFloat(fps[1]) : 30,
    hasAudio: /Stream #.*Audio:/.test(text),
  };
}

async function processVideo(item, o) {
  setStatus(item, 'Memuatkan enjin video…', 2);
  const f = await loadFFmpeg();
  const ext = (item.file.name.match(/\.[^.]+$/) || ['.mp4'])[0].toLowerCase();
  const input = `in${ext}`;
  setStatus(item, 'Membaca video…', 4);
  await f.writeFile(input, await fetchFile(item.file));

  try {
    const info = await probe(f, input);
    const fps = Math.min(o.fps, Math.round(info.fps) || 30);
    let W, H;
    if (o.fill) { W = o.res; H = even(o.res * 16 / 9); } else { [W, H] = fitDims(info.width, info.height, o.res); }

    const total = info.duration || 1;
    const segLen = o.split > 0 ? o.split : total;
    const segCount = Math.max(1, Math.ceil(total / segLen - 0.05));
    const outs = [];

    for (let i = 0; i < segCount; i++) {
      const start = i * segLen;
      const dur = Math.min(segLen, total - start);
      const out = `out_${i}.mp4`;
      const label = segCount > 1 ? `Bahagian ${i + 1}/${segCount}: ` : '';

      const vf = o.fill
        ? `[0:v]split[a][b];` +
          `[a]scale=${W / 4}:${H / 4}:force_original_aspect_ratio=increase,crop=${W / 4}:${H / 4},boxblur=8:2,scale=${W}:${H},eq=brightness=-0.06[bg];` +
          `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[fg];` +
          `[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${fps},setsar=1,format=yuv420p[v]`
        : `[0:v]scale=${W}:${H}:flags=lanczos,fps=${fps},setsar=1,format=yuv420p[v]`;

      const rate = [];
      if (o.platform === 'whatsapp') {
        // aim each clip under ~15.5MB so WhatsApp does minimal re-compression
        const audioK = info.hasAudio ? 128 : 0;
        // scale the bitrate cap with actual output pixels (5 Mbps for full 1080x1920)
        const cap = Math.max(1000, Math.round(5000 * (W * H) / (1080 * 1920)));
        const vK = Math.max(600, Math.min(cap, Math.floor((15.5 * 8 * 1024 / Math.max(dur, 1)) * 0.93 - audioK)));
        rate.push('-b:v', `${vK}k`, '-maxrate', `${Math.round(vK * 1.3)}k`, '-bufsize', `${vK * 2}k`);
      } else {
        const max = Math.max(2000, Math.round(10000 * (W * H) / (1080 * 1920)));
        rate.push('-crf', '19', '-maxrate', `${max}k`, '-bufsize', `${max * 2}k`);
      }

      const args = [
        '-hide_banner', '-y',
        ...(segCount > 1 ? ['-ss', `${start}`, '-t', `${dur}`] : []),
        '-i', input,
        '-filter_complex', vf,
        '-map', '[v]', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-level', '4.1',
        ...rate,
        '-g', `${fps * 2}`,
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
        '-movflags', '+faststart',
        out,
      ];

      ffLog = (m) => {
        const t = m.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!t) return;
        const sec = (+t[1]) * 3600 + (+t[2]) * 60 + parseFloat(t[3]);
        const p = Math.min(1, sec / dur);
        setStatus(item, `${label}Compress ${Math.round(p * 100)}%`, ((i + p) / segCount) * 100);
      };
      setStatus(item, `${label}Compress 0%`, (i / segCount) * 100);
      const code = await f.exec(args);
      ffLog = () => {};
      if (code !== 0) throw new Error('ffmpeg gagal memproses video (mungkin fail terlalu besar untuk browser).');

      const data = await f.readFile(out);
      await f.deleteFile(out).catch(() => {});
      outs.push({
        blob: new Blob([data.buffer], { type: 'video/mp4' }),
        name: `${baseName(item.file.name)}_HD${segCount > 1 ? `_bhg${i + 1}` : ''}.mp4`,
        width: W,
        height: H,
      });
    }
    return outs;
  } finally {
    await f.deleteFile(input).catch(() => {});
  }
}
