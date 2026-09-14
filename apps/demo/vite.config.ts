import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'thread-review-save',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__thread-review/save', async (request, response) => {
          response.setHeader('Content-Type', 'application/json')
          if (request.method !== 'POST' || request.headers['content-type'] !== 'application/json' || request.headers['sec-fetch-site'] === 'cross-site') {
            response.statusCode = 403
            response.end(JSON.stringify({ error: 'Use Save review in the prototype.' }))
            return
          }
          try {
            const chunks: Buffer[] = []
            let bytes = 0
            for await (const chunk of request) {
              bytes += chunk.length
              if (bytes > 25 * 1024 * 1024) {
                response.statusCode = 413
                response.end(JSON.stringify({ error: 'Recording exceeds 25 MB. Keep this tab open; the review has not been saved.' }))
                return
              }
              chunks.push(chunk)
            }
            const body = Buffer.concat(chunks).toString('utf8')
            const review = JSON.parse(body)
            if (review.version !== 1 || !Array.isArray(review.frames) || !Array.isArray(review.notes)) {
              response.statusCode = 400
              response.end(JSON.stringify({ error: 'Invalid review recording.' }))
              return
            }
            const directory = '.amp/in/artifacts'
            const path = `${directory}/thread-review-${randomUUID()}.json`
            await mkdir(`${workspaceRoot}/${directory}`, { recursive: true })
            await writeFile(`${workspaceRoot}/${path}`, body, { flag: 'wx' })
            response.end(JSON.stringify({ path }))
          } catch {
            response.statusCode = 500
            response.end(JSON.stringify({ error: 'Could not save review. Keep this tab open and try again.' }))
          }
        })
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
