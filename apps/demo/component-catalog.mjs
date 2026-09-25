// @ts-check
import { readFile } from 'node:fs/promises'

const manifestUrls = [
  new URL('../../packages/components/src/chat.manifest.json', import.meta.url),
  new URL('../../packages/blocks/src/chat.manifest.json', import.meta.url),
]
/** @type {[string, URL][]} */
const publicIndexUrls = [
  ['component', new URL('../../packages/components/src/index.ts', import.meta.url)],
  ['block', new URL('../../packages/blocks/src/index.ts', import.meta.url)],
  ['primitive', new URL('../../packages/primitives/src/index.ts', import.meta.url)],
]

/** @typedef {{category: string, id: string, names: string[], states: string[], summary: string}} CatalogItem */

/** @returns {Promise<CatalogItem[]>} */
export async function loadComponentCatalog() {
  /** @type {unknown[]} */
  const manifests = await Promise.all(manifestUrls.map(async (url) => JSON.parse(await readFile(url, 'utf8'))))
  const documented = manifests.flatMap((manifest) => {
    if (!isRecord(manifest) || (manifest.kind !== 'component' && manifest.kind !== 'block') || !Array.isArray(manifest.items)) {
      throw new Error('Invalid component catalog manifest.')
    }
    const category = manifest.kind
    return manifest.items.map((/** @type {unknown} */ item) => {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.summary !== 'string' ||
          !Array.isArray(item.components) || !item.components.every((/** @type {unknown} */ value) => typeof value === 'string') ||
          !Array.isArray(item.states) || !item.states.every((/** @type {unknown} */ value) => typeof value === 'string')) {
        throw new Error('Invalid component catalog item.')
      }
      return { category, id: item.id, names: item.components, states: item.states, summary: item.summary }
    })
  })
  const documentedNames = new Set(documented.flatMap((item) => item.names))
  const publicLeaves = (await Promise.all(publicIndexUrls.map(async ([category, url]) => {
    const source = await readFile(url, 'utf8')
    return exportedRuntimeNames(source).filter((name) => !documentedNames.has(name)).map((name) => ({
      category,
      id: `public-${name.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`,
      names: [name],
      states: [],
      summary: `Public ${category} export.`,
    }))
  }))).flat()
  return [...documented, ...publicLeaves]
}

/** @param {unknown} value @returns {string} */
export function formatCatalogOutput(value) {
  if (!isRecord(value) || !Array.isArray(value.matches)) {
    return 'Catalog search complete.'
  }
  const names = value.matches.flatMap((match) =>
    isRecord(match) && Array.isArray(match.names)
      ? match.names.filter((name) => typeof name === 'string')
      : [],
  )
  return names.length > 0 ? names.join(', ') : 'No direct component matches.'
}

/** @param {string} source @returns {string[]} */
function exportedRuntimeNames(source) {
  return [...source.matchAll(/export\s*{([^}]+)}\s*from/g)]
    .flatMap((match) => (match[1] ?? '').split(','))
    .map((entry) => entry.trim().split(/\s+as\s+/).at(-1)?.trim())
    .flatMap((name) => name !== undefined && /^[A-Z][A-Za-z0-9]*$/.test(name) ? [name] : [])
}

/** @returns {value is Record<string, unknown>} */
function isRecord(/** @type {unknown} */ value) {
  return typeof value === 'object' && value !== null
}
