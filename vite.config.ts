import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Accept both VITE_* and the NEXT_PUBLIC_* names used by this project.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    target: 'es2020',
    // Rolldown's bundler needs more than Node's default heap on CI machines.
    // (The build OOM previously seen on Cloudflare was exactly this.)
    chunkSizeWarningLimit: 900,
  },
})
