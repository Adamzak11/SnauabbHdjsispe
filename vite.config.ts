import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Exact decoded size of the FFmpeg WebAssembly binary. Used to show a real
// download percentage even when the CDN serves it compressed (Content-Length
// then reflects the compressed size, not the bytes the stream yields).
const wasmPath = fileURLToPath(
  new URL('./node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url),
)
const WASM_SIZE = statSync(wasmPath).size

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // @ffmpeg/ffmpeg spawns its own module worker via `new URL(..., import.meta.url)`;
    // pre-bundling breaks that URL resolution.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    __FFMPEG_WASM_SIZE__: JSON.stringify(WASM_SIZE),
  },
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
})
