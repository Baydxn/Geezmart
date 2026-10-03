import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Guards against a silently half-configured backend.
 *
 * A UTF-8 BOM at the start of `.env` (common on Windows editors) makes the
 * FIRST variable unparseable, so the key loads but the URL does not and the
 * app quietly falls back to local mode. Failing loudly here is much better.
 */
function supabaseEnvCheck(): Plugin {
  return {
    name: 'geezmart:supabase-env-check',
    configResolved(config) {
      const url = config.env.NEXT_PUBLIC_SUPABASE_URL
      const key = config.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

      if (key && !url) {
        throw new Error(
          '[geezmart] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing.\n' +
            'This usually means the first line of .env has a UTF-8 BOM. Save .env as UTF-8 WITHOUT BOM.',
        )
      }

      if (url && !key) {
        throw new Error(
          '[geezmart] NEXT_PUBLIC_SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.',
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), supabaseEnvCheck()],
  // Accept both VITE_* and the NEXT_PUBLIC_* names used by this project.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    target: 'es2020',
    // Rolldown's bundler needs more than Node's default heap on CI machines.
    // (The build OOM previously seen on Cloudflare was exactly this.)
    chunkSizeWarningLimit: 900,
  },
})
