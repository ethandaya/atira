import {
  formatCatalogOutput,
  loadComponentCatalog,
} from './component-catalog.ts'
import { searchWeb } from './web-search.ts'
import { z } from 'zod'

const catalogQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(200),
})
const webQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(500),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function catalogInput(value: unknown) {
  const result = catalogQuerySchema.safeParse(value)
  return result.success ? result.data.query : ''
}

function webInput(value: unknown) {
  const result = webQuerySchema.safeParse(value)
  return result.success ? result.data.query : ''
}

function webOutput(value: unknown) {
  if (!isRecord(value)) return 'Web search complete.'

  const answer = typeof value.answer === 'string' ? value.answer.trim() : ''
  const sources = Array.isArray(value.sources)
    ? value.sources
        .filter(
          (source) =>
            isRecord(source) &&
            typeof source.title === 'string' &&
            typeof source.url === 'string' &&
            /^https?:\/\//i.test(source.url),
        )
        .map((source) => `- ${source.title}: ${source.url}`)
    : []

  return [
    answer || 'Web search complete.',
    ...(sources.length > 0 ? ['', 'Sources', ...sources] : []),
  ].join('\n')
}

export async function createDemoTools({
  apiKey,
  model,
}: {
  apiKey: string | undefined
  model: string
}) {
  const componentCatalog = await loadComponentCatalog()
  const inspectComponentCatalog = {
    completedSummary: 'Searched component catalog',
    description:
      'Search the current Atira React component catalog by responsibility, state, or name. Use this before answering questions about interface components or design patterns in Atira.',
    failedSummary: 'Component catalog search failed',
    formatInput: catalogInput,
    formatOutput: formatCatalogOutput,
    parameters: z.toJSONSchema(catalogQuerySchema),
    handler(input: unknown) {
      const { query } = catalogQuerySchema.parse(input)
      const terms = query.toLowerCase().match(/[a-z0-9-]+/g) ?? []
      const ranked = componentCatalog
        .map((component) => {
          const searchable = [
            ...component.names,
            component.category,
            component.summary,
            ...component.states,
          ]
            .join(' ')
            .toLowerCase()
          const score = terms.reduce(
            (total, term) => total + (searchable.includes(term) ? 1 : 0),
            0,
          )
          return { component, score }
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
      const matches = (
        ranked.length > 0
          ? ranked.map(({ component }) => component)
          : componentCatalog.slice(0, 6)
      ).slice(0, 8)

      return { matches, query }
    },
    startedSummary: 'Searching component catalog',
  }
  const searchWebTool = {
    completedSummary: 'Searched the web',
    description:
      'Search and read the public web for current or external information. Use this whenever the user asks to search, browse, look something up, verify a web source, or answer with up-to-date information. The result includes source URLs for citation.',
    failedSummary: 'Web search failed',
    formatInput: webInput,
    formatOutput: webOutput,
    parameters: z.toJSONSchema(webQuerySchema),
    handler(input: unknown, { signal }: { signal?: AbortSignal } = {}) {
      const { query } = webQuerySchema.parse(input)
      return searchWeb({
        ...(apiKey === undefined ? {} : { apiKey }),
        model,
        query,
        ...(signal === undefined ? {} : { signal }),
      })
    },
    startedSummary: 'Searching the web',
  }

  return {
    inspect_component_catalog: inspectComponentCatalog,
    ...(apiKey ? { search_web: searchWebTool } : {}),
  }
}

export function presentToolEvent(payload: Record<string, unknown>) {
  const eventType = stringValue(payload, 'type')
  if (eventType !== 'tool.call' && eventType !== 'tool.result') return undefined

  const tool = stringValue(payload, 'tool')
  const id = stringValue(payload, 'call_id')
  if (eventType === 'tool.call' && tool === 'inspect_component_catalog') {
    return {
      id,
      input: catalogInput(payload.arguments),
      summary: 'Searching component catalog',
      tool,
      type: 'tool-started',
    }
  }
  if (eventType === 'tool.call' && tool === 'search_web') {
    return {
      id,
      input: webInput(payload.arguments),
      summary: 'Searching the web',
      tool,
      type: 'tool-started',
    }
  }
  if (eventType === 'tool.call') {
    return {
      id,
      input: JSON.stringify(payload.arguments),
      summary: tool,
      tool,
      type: 'tool-started',
    }
  }

  const failed = ['error', 'failed'].includes(stringValue(payload, 'status'))
  if (tool === 'inspect_component_catalog') {
    return {
      ...(failed
        ? { error: 'The component catalog search failed.' }
        : { output: formatCatalogOutput(payload.structured_result) }),
      id,
      status: failed ? 'failed' : 'succeeded',
      summary: 'Searched component catalog',
      tool,
      type: 'tool-completed',
    }
  }
  if (tool === 'search_web') {
    return {
      ...(failed
        ? { error: 'The web search failed.' }
        : { output: webOutput(payload.structured_result) }),
      id,
      status: failed ? 'failed' : 'succeeded',
      summary: 'Searched the web',
      tool,
      type: 'tool-completed',
    }
  }
  return {
    ...(failed
      ? { error: 'The tool failed.' }
      : { output: JSON.stringify(payload.structured_result) }),
    id,
    status: failed ? 'failed' : 'succeeded',
    summary: tool,
    tool,
    type: 'tool-completed',
  }
}

function stringValue(value: Record<string, unknown>, key: string) {
  const result = value[key]
  return typeof result === 'string' ? result : ''
}
