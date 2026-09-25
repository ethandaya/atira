import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    stylex({ useCSSLayers: true }),
    react(),
    {
      name: 'module-evidence',
      generateBundle(_, bundle) {
        const chunk = Object.values(bundle).find((value) => value.type === 'chunk' && value.facadeModuleId?.endsWith('/src/light.ts'))
        if (!chunk) throw new Error('light entry missing')
        const seen = new Set()
        const walk = (id) => {
          if (seen.has(id)) return
          seen.add(id)
          for (const child of this.getModuleInfo(id)?.importedIds ?? []) walk(child)
        }
        walk(chunk.facadeModuleId)
        this.emitFile({ type: 'asset', fileName: 'light-module-graph.json', source: JSON.stringify([...seen].sort()) })
      },
    },
  ],
  build: { rollupOptions: { input: { main: 'index.html', light: 'src/light.ts' } } },
})
