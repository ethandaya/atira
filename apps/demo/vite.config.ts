import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    stylex.vite({
      dev: mode === 'development',
      runtimeInjection: false,
      unstable_moduleResolution: {
        type: 'commonJS',
        rootDir: workspaceRoot,
      },
      useCSSLayers: true,
    }),
    react(),
  ],
  server: {
    allowedHosts: ['.onamp.dev'],
  },
}))
