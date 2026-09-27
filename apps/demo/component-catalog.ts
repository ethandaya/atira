import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const manifestUrls = [
  new URL(
    './primitives.manifest.json',
    import.meta.resolve('@atira/primitives'),
  ),
  new URL('./chat.manifest.json', import.meta.resolve('@atira/components')),
  new URL('./chat.manifest.json', import.meta.resolve('@atira/blocks')),
]

type CatalogItem = {
  category: string
  id: string
  names: string[]
  states: string[]
  summary: string
}

const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.enum(['primitive', 'component', 'block']),
  version: z.string().min(1),
  items: z.array(
    z.strictObject({
      accessibility: z.array(z.string()).min(1),
      actions: z.array(z.string()).min(1),
      anatomy: z.array(z.string()).min(1),
      avoidWhen: z.array(z.string()).min(1),
      components: z.array(z.string()).min(1),
      examples: z.array(z.string()).min(1),
      id: z.string().min(1),
      nonExamples: z.array(z.string()).min(1),
      sideEffects: z.array(z.string()),
      states: z.array(z.string()).min(1),
      summary: z.string().min(1),
      useWhen: z.array(z.string()).min(1),
    }),
  ),
})
const catalogOutputSchema = z.object({
  matches: z.array(z.object({ names: z.array(z.string()) })),
})

export async function loadComponentCatalog(): Promise<CatalogItem[]> {
  const manifests = await Promise.all(
    manifestUrls.map(async (url) =>
      manifestSchema.parse(JSON.parse(await readFile(url, 'utf8'))),
    ),
  )
  const documented = manifests.flatMap((manifest) => {
    const category = manifest.kind
    return manifest.items.map((item) => ({
      category,
      id: item.id,
      names: item.components,
      states: item.states,
      summary: item.summary,
    }))
  })
  return documented
}

export function formatCatalogOutput(value: unknown): string {
  const result = catalogOutputSchema.safeParse(value)
  if (!result.success) return 'Catalog search complete.'
  const names = result.data.matches.flatMap((match) => match.names)
  return names.length > 0 ? names.join(', ') : 'No direct component matches.'
}
