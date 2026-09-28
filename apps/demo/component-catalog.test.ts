import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import {
  formatCatalogOutput,
  loadComponentCatalog,
} from './component-catalog.ts'

describe('component catalog', () => {
  it('uses the package manifests as its canonical inventory', async () => {
    const catalog = await loadComponentCatalog()
    expect(catalog.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'chat-composer',
        'chat-coding-tools',
        'chat-requests',
        'chat-session',
        'chat-timeline',
      ]),
    )
    expect(catalog.flatMap((item) => item.names)).toEqual(
      expect.arrayContaining([
        'Activity',
        'Artifact',
        'Button',
        'ChatComposer',
        'CodeBlock',
        'Composer',
        'GeneratedImage',
        'ImageGenerationTool',
        'Message',
        'PermissionPrompt',
        'QuestionAnswerSummary',
        'Response',
        'TextField',
        'Timeline',
        'WebTool',
      ]),
    )
    const catalogNames = new Set(catalog.flatMap((item) => item.names))
    const publicComponents = (
      await Promise.all(
        ['components', 'primitives'].map(async (packageName) =>
          exportedRuntimeNames(
            await readFile(
              new URL(
                `../../packages/${packageName}/src/index.ts`,
                import.meta.url,
              ),
              'utf8',
            ),
          ),
        ),
      )
    ).flat()
    expect(publicComponents.filter((name) => !catalogNames.has(name))).toEqual(
      [],
    )
  })

  it('formats catalog matches from their canonical names arrays', () => {
    expect(
      formatCatalogOutput({
        matches: [{ names: ['Markdown', 'Response'] }, { names: ['Tool'] }],
      }),
    ).toBe('Markdown, Response, Tool')
    expect(formatCatalogOutput({ matches: [] })).toBe(
      'No direct component matches.',
    )
    expect(formatCatalogOutput(undefined)).toBe('Catalog search complete.')
  })
})

function exportedRuntimeNames(source: string) {
  return [...source.matchAll(/export\s*{([^}]+)}\s*from/g)]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((entry) =>
      entry
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim(),
    )
    .filter(
      (name): name is string =>
        typeof name === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(name),
    )
}
