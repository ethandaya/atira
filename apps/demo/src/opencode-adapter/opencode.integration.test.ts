import { createOpencode } from '@opencode-ai/sdk/v2'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it(
  'connects to an isolated provider-free OpenCode server',
  { timeout: 30_000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'pretty-amped-opencode-'))
    const project = join(root, 'project')
    await mkdir(project, { recursive: true })
    const restoreEnvironment = isolateOpenCodeEnvironment(root)
    const app = await createOpencode({
      config: { autoupdate: false, share: 'disabled' },
      hostname: '127.0.0.1',
      port: 0,
    })

    try {
      const health = await app.client.global.health({ throwOnError: true })
      const created = await app.client.session.create(
        { directory: project, title: 'Pretty Amped integration' },
        { throwOnError: true },
      )
      const messages = await app.client.session.messages(
        { directory: project, sessionID: created.data.id },
        { throwOnError: true },
      )

      expect(health.data.healthy).toBe(true)
      expect(created.data.id).toBeTruthy()
      expect(messages.data).toEqual([])
    } finally {
      app.server.close()
      restoreEnvironment()
      await rm(root, { force: true, recursive: true })
    }
  },
)

function isolateOpenCodeEnvironment(root: string) {
  const bin = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../node_modules/.bin',
  )
  const values: Record<string, string> = {
    HOME: join(root, 'home'),
    OPENCODE_AUTH_CONTENT: '{}',
    OPENCODE_DISABLE_AUTOCOMPACT: '1',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_PROJECT_CONFIG: '1',
    OPENCODE_PURE: '1',
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
  }
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  )
  Object.assign(process.env, values)

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
