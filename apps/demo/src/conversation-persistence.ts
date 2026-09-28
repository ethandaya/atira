import type { ChatTurn, ComposerDraft } from '@atiraui/foundations/chat'
import { z } from 'zod'

const identifier = z.string().min(1)
const timestamp = z.number().nonnegative()
const error = z.strictObject({
  code: z.string().optional(),
  kind: z.enum([
    'provider',
    'tool',
    'connection',
    'mutation',
    'validation',
    'unknown',
  ]),
  message: z.string(),
  retryable: z.boolean(),
})
const partState = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('streaming') }),
  z.strictObject({ status: z.literal('complete') }),
  z.strictObject({ status: z.literal('interrupted') }),
  z.strictObject({ error, status: z.literal('failed') }),
])
const model = z.strictObject({
  description: z.string().optional(),
  label: z.string(),
  modelId: identifier,
  providerId: identifier,
})
const agent = z.strictObject({ id: identifier, label: z.string() })
const toolState = z.discriminatedUnion('status', [
  z.strictObject({
    input: z.json(),
    progress: z
      .strictObject({
        current: z.number().optional(),
        label: z.string().optional(),
        total: z.number().optional(),
      })
      .optional(),
    startedAt: timestamp,
    status: z.literal('running'),
  }),
  z.strictObject({
    endedAt: timestamp,
    input: z.json(),
    output: z.json().optional(),
    status: z.literal('succeeded'),
  }),
  z.strictObject({
    endedAt: timestamp,
    error,
    input: z.json().optional(),
    status: z.literal('failed'),
  }),
  z.strictObject({
    endedAt: timestamp,
    input: z.json().optional(),
    reason: z.string().optional(),
    status: z.literal('cancelled'),
  }),
])
const toolPresentation = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('context'),
    operation: z.enum(['read', 'list', 'glob', 'grep']),
    target: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal('web'),
    operation: z.enum(['fetch', 'search']),
    target: z.string().optional(),
  }),
  z.strictObject({ kind: z.literal('generic') }),
])
const messagePart = z.discriminatedUnion('type', [
  z.strictObject({
    id: identifier,
    markdown: z.string(),
    state: partState,
    type: z.literal('text'),
  }),
  z.strictObject({
    endedAt: timestamp.optional(),
    id: identifier,
    startedAt: timestamp.optional(),
    state: partState,
    text: z.string(),
    type: z.literal('reasoning'),
  }),
  z.strictObject({
    callId: identifier,
    id: identifier,
    presentation: toolPresentation,
    state: toolState,
    toolName: z.string(),
    type: z.literal('tool'),
  }),
])
const delivery = z.discriminatedUnion('status', [
  z.strictObject({ clientId: identifier, status: z.literal('optimistic') }),
  z.strictObject({ status: z.literal('confirmed') }),
  z.strictObject({
    error,
    retryable: z.boolean(),
    status: z.literal('failed'),
  }),
])
const message = z.strictObject({
  createdAt: timestamp,
  delivery,
  id: identifier,
  parts: z.array(messagePart),
  role: z.enum(['user', 'assistant']),
  turnId: identifier,
})
const turnState = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('queued') }),
  z.strictObject({ startedAt: timestamp, status: z.literal('running') }),
  z.strictObject({
    endedAt: timestamp,
    startedAt: timestamp,
    status: z.literal('complete'),
    stopReason: z.string().optional(),
  }),
  z.strictObject({
    endedAt: timestamp,
    reason: z.string().optional(),
    startedAt: timestamp,
    status: z.literal('interrupted'),
  }),
  z.strictObject({
    endedAt: timestamp,
    error,
    startedAt: timestamp.optional(),
    status: z.literal('failed'),
  }),
])
const turn = z
  .strictObject({
    agent: agent.optional(),
    assistant: z.array(message),
    id: identifier,
    model: model.optional(),
    state: turnState,
    user: message,
  })
  .transform((value) => value as ChatTurn)
const segment = z.strictObject({
  id: identifier,
  text: z.string(),
  type: z.literal('text'),
})
const point = z.strictObject({
  offset: z.number().int().nonnegative(),
  segmentId: identifier,
})
const draft = z
  .strictObject({
    attachments: z.tuple([]),
    mode: z.literal('prompt'),
    model: model.optional(),
    revision: z.number().int().nonnegative(),
    segments: z.array(segment).min(1),
    selection: z.strictObject({ anchor: point, focus: point }),
  })
  .refine((value) => {
    const segments = new Map(value.segments.map((item) => [item.id, item]))
    return (
      segments.size === value.segments.length &&
      [value.selection.anchor, value.selection.focus].every((selection) => {
        const selected = segments.get(selection.segmentId)
        return selected && selection.offset <= selected.text.length
      })
    )
  }, 'Invalid draft selection or segments')
  .transform((value) => value as ComposerDraft)
const savedHistorySchema = z.strictObject({
  activeId: identifier,
  conversations: z.array(
    z.strictObject({
      composer: draft,
      hasContext: z.boolean(),
      id: z.string().uuid(),
      title: z.string(),
      turns: z.array(turn).readonly(),
    }),
  ),
})

export type SavedHistory = z.infer<typeof savedHistorySchema>
export type SavedConversation = SavedHistory['conversations'][number]

export function readSavedHistory(value: string): SavedHistory {
  return savedHistorySchema.parse(JSON.parse(value))
}

export function writeSavedHistory(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  history: SavedHistory,
) {
  storage.setItem(key, JSON.stringify(savedHistorySchema.parse(history)))
}
