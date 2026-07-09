import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bundled Capacitor app: assets are loaded from the APK over the capacitor:// scheme,
// so use relative asset paths.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Single, fixed-name index.js + index.css so the hosted page can reference
    // them statically and the deploy step can cache-bust with a version query.
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  server: {
    // Dev-only convenience so `npm run dev` in a browser can hit the live backend
    // without CORS. In the APK, requests go through Capacitor's native HTTP instead.
    proxy: {
      '/api': { target: 'https://uwmerp.duxdigitech.in', changeOrigin: true, secure: true },
      '/files': { target: 'https://uwmerp.duxdigitech.in', changeOrigin: true, secure: true },
    },
  },
})
