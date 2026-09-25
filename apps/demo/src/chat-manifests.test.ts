import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

type ManifestItem = Readonly<{
  accessibility: readonly string[]
  actions: readonly string[]
  anatomy: readonly string[]
  components: readonly string[]
  examples: readonly string[]
  id: string
  nonExamples: readonly string[]
  sideEffects: readonly string[]
  states: readonly string[]
  summary: string
}>

type Manifest = Readonly<{
  items: readonly ManifestItem[]
  kind: 'component' | 'block'
  schemaVersion: number
  version: string
}>

const manifests = [
  new URL(
    '../../../packages/components/src/chat.manifest.json',
    import.meta.url,
  ),
  new URL('../../../packages/blocks/src/chat.manifest.json', import.meta.url),
]

describe('chat component manifests', () => {
  it('keeps every chat item explicit and machine-readable', async () => {
    const parsed = await Promise.all(
      manifests.map(
        async (url) => JSON.parse(await readFile(url, 'utf8')) as Manifest,
      ),
    )
    const items = parsed.flatMap((manifest) => manifest.items)

    expect(parsed.map((manifest) => manifest.schemaVersion)).toEqual([1, 1])
    expect(items.map((item) => item.id)).toEqual([
      'chat-turn',
      'chat-markdown-reasoning',
      'chat-tool-activity',
      'chat-coding-tools',
      'chat-requests',
      'chat-composer',
      'chat-recovery',
      'chat-timeline',
      'chat-session',
    ])
    for (const item of items) {
      expect(item.summary.length, `${item.id} summary`).toBeGreaterThan(20)
      for (const field of [
        'accessibility',
        'actions',
        'anatomy',
        'components',
        'examples',
        'nonExamples',
        'states',
      ] as const) {
        expect(item[field].length, `${item.id}.${field}`).toBeGreaterThan(0)
      }
      expect(Array.isArray(item.sideEffects), `${item.id}.sideEffects`).toBe(
        true,
      )
    }
  })
})
