# StatusHD

Webapp untuk compress video & gambar supaya kekal HD bila pos di **Status WhatsApp** dan **TikTok**.
Semua proses berlaku dalam browser (ffmpeg.wasm + canvas) — tiada fail dimuat naik ke server.

## Ciri
- **Status WhatsApp**: video 1080p H.264, setiap klip disasarkan ≤ ~15.5MB, dan boleh dipotong automatik setiap 30/60/90 saat.
- **TikTok**: 1080p H.264 bitrate tinggi (CRF 19, maks 10 Mbps).
- Gambar: diubah saiz ke 1080p (tanpa besarkan), JPEG kualiti tinggi, orientasi EXIF dibetulkan.
- Pilihan **9:16 latar kabur** untuk video/gambar landscape.
- Butang **Kongsi** (di telefon) untuk terus hantar ke WhatsApp / TikTok.

## Cara jalankan
Ia laman statik. Hos di mana-mana (GitHub Pages, Netlify, Vercel) atau jalankan secara lokal:

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

> Perlu dibuka melalui `http(s)://`, bukan `file://`.

`vendor/` mengandungi `@ffmpeg/ffmpeg` 0.12.15, `@ffmpeg/util` 0.12.2 dan `@ffmpeg/core` 0.12.10 (single-thread, jadi tidak perlu header COOP/COEP).
