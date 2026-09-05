import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ฟังทุก network interface ไม่ใช่แค่ 127.0.0.1 — เครื่องอื่นในวง ZeroTier/LAN
    // จึงเปิด http://<ip ของ Pi>:5173 ได้ (ค่าเริ่มต้นของ Vite ผูกแค่ localhost)
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // React and the router change only when a dependency is bumped, so keeping them
        // in their own chunk lets the browser reuse them across builds while the app
        // chunks churn. Route-level splitting itself lives in App.tsx (lazy imports).
        // The function form is the only one this Rollup build types; the object form
        // (`{ vendor: [...] }`) no longer type-checks under Vite 8.
        manualChunks: (id: string) =>
          id.includes('node_modules') ? 'vendor' : undefined,
      },
    },
  },
})
