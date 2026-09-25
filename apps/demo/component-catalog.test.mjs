import { describe, expect, it } from 'vitest'

import { formatCatalogOutput, loadComponentCatalog } from './component-catalog.mjs'

describe('component catalog', () => {
  it('uses the package manifests as its canonical inventory', async () => {
    const catalog = await loadComponentCatalog()
    expect(catalog.map((item) => item.id)).toEqual(expect.arrayContaining([
      'chat-composer', 'chat-coding-tools', 'chat-requests', 'chat-session', 'chat-timeline',
    ]))
    expect(catalog.flatMap((item) => item.names)).toEqual(expect.arrayContaining([
      'Button', 'ChatComposer', 'GeneratedImage', 'PermissionPrompt', 'TextField', 'Timeline', 'WebTool',
    ]))
    expect(catalog.find((item) => item.names.includes('GeneratedImage'))).toMatchObject({ category: 'component', states: [] })
  })

  it('formats catalog matches from their canonical names arrays', () => {
    expect(formatCatalogOutput({ matches: [{ names: ['Markdown', 'Response'] }, { names: ['Tool'] }] }))
      .toBe('Markdown, Response, Tool')
    expect(formatCatalogOutput({ matches: [] })).toBe('No direct component matches.')
    expect(formatCatalogOutput(undefined)).toBe('Catalog search complete.')
  })
})
