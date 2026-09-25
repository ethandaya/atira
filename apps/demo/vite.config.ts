import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))
const require = createRequire(import.meta.url)

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'optional-lapse',
      resolveId(id) {
        if (id !== 'virtual:optional-lapse') return
        return '\0virtual:optional-lapse'
      },
      load(id) {
        if (id !== '\0virtual:optional-lapse') return
        try {
          const panel = require.resolve('@aiforui/lapse/panel')
          return `export { mountLapse } from ${JSON.stringify(panel)}`
        } catch {
          return `export function mountLapse() { console.warn('Lapse is not installed. See the optional inspector instructions in README.md.') }`
        }
      },
    },
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
