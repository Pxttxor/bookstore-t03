import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
