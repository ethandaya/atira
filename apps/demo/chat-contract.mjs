// @ts-check
import { z } from 'zod'

const timestamp = z.number().nonnegative()
const agent = z.object({ id: z.string(), label: z.string() })
export const modelSchema = z
  .object({
    defaultReasoningEffort: z.string().optional(),
    description: z.string().optional(),
    label: z.string(),
    modelId: z.string(),
    providerId: z.string(),
    reasoningEfforts: z.array(z.string()).optional(),
  })
  .transform(
    ({ defaultReasoningEffort, description, reasoningEfforts, ...model }) => ({
      ...model,
      ...(defaultReasoningEffort === undefined
        ? {}
        : { defaultReasoningEffort }),
      ...(description === undefined ? {} : { description }),
      ...(reasoningEfforts === undefined ? {} : { reasoningEfforts }),
    }),
  )

// Requests identify a catalog entry; display metadata is optional for older clients.
const requestedModelSchema = z.strictObject({
  label: z.string().optional(),
  modelId: z.string(),
  providerId: z.string(),
})

export const authStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('signed_out') }),
  z.object({ state: z.literal('expired') }),
  z.object({ state: z.literal('authenticated') }),
  z.object({
    state: z.literal('pending'),
    verificationUrl: z
      .url()
      .refine((value) => new URL(value).origin === 'https://auth.openai.com'),
    userCode: z.string().min(1),
    expiresAt: z.number(),
    pollAfterMs: z.number().nonnegative(),
  }),
])

export const runtimeResponseSchema = z
  .object({
    available: z.boolean(),
    conversationSessions: z.literal(true),
    message: z.string().optional(),
    model: z.string(),
    models: z
      .array(z.unknown())
      .default([])
      .transform((models) =>
        models.flatMap((model) => {
          const result = modelSchema.safeParse(model)
          return result.success ? [result.data] : []
        }),
      ),
    retryTurns: z.boolean().default(false),
    runtime: z.string(),
  })
  .transform(({ message, ...runtime }) => ({
    ...runtime,
    ...(message === undefined ? {} : { message }),
  }))

const turnId = z.string().regex(/^[a-z0-9:-]{1,100}$/i, 'Invalid turn ID.')
export const cancelRequestSchema = z.strictObject({ turnId })
export const chatRequestSchema = z.strictObject({
  input: z
    .string()
    .trim()
    .min(1, 'Enter a message to continue.')
    .max(8_000, 'Messages are limited to 8,000 characters.'),
  model: requestedModelSchema.optional(),
  reasoningEffort: z.string().optional(),
  resume: z.boolean().optional().default(false),
  retry: z.boolean().optional().default(false),
  turnId: turnId.optional(),
})

export const apiErrorSchema = z.strictObject({ error: z.string().min(1) })
export const cancelResponseSchema = z.strictObject({ cancelled: z.boolean() })
const error = z.object({
  kind: z.enum([
    'provider',
    'tool',
    'connection',
    'mutation',
    'validation',
    'unknown',
  ]),
  code: z.string().optional(),
  message: z.string(),
  retryable: z.boolean(),
})
const activity = z
  .object({
    summary: z.string(),
    detail: z.string().optional(),
    tool: z.string().optional(),
  })
  .transform(({ summary, detail, tool }) => ({
    summary,
    ...(detail === undefined ? {} : { detail }),
    ...(tool === undefined ? {} : { tool }),
  }))
const transcriptStep = z
  .object({
    id: z.string(),
    summary: z.string(),
    tool: z.string(),
    status: z.enum(['succeeded', 'failed']),
    error: z.string().optional(),
    input: z.string().optional(),
    output: z.string().optional(),
  })
  .transform(({ error, input, output, ...step }) => ({
    ...step,
    ...(error === undefined ? {} : { error }),
    ...(input === undefined ? {} : { input }),
    ...(output === undefined ? {} : { output }),
  }))
const transcript = z
  .object({
    result: z.string(),
    reasoning: z.string().optional(),
    steps: z.array(transcriptStep),
  })
  .transform(({ reasoning, ...value }) => ({
    ...value,
    ...(reasoning === undefined ? {} : { reasoning }),
  }))
const image = z
  .object({
    id: z.string(),
    url: z.string().regex(/^\/api\/images\/[a-zA-Z0-9-]+$/),
    downloadUrl: z
      .string()
      .regex(/^\/api\/images\/[a-zA-Z0-9-]+\?download=1$/)
      .optional(),
    alt: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .transform(({ downloadUrl, ...image }) => ({
    ...image,
    ...(downloadUrl === undefined ? {} : { downloadUrl }),
  }))

const streamTool = z.object({
  id: z.string(),
  summary: z.string(),
  tool: z.string(),
})

// Both the runtime writer and browser reader use this transport contract.
export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started') }),
  z.object({ type: z.literal('assistant-delta'), text: z.string() }),
  z.object({ type: z.literal('assistant-message'), text: z.string() }),
  z.object({ type: z.literal('reasoning-delta'), text: z.string() }),
  streamTool.extend({
    type: z.literal('tool-started'),
    input: z.string().optional(),
  }),
  streamTool.extend({
    type: z.literal('tool-completed'),
    status: z.enum(['succeeded', 'failed']),
    output: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('completed'),
    durationMs: timestamp,
    message: z.string(),
    usage: z.object({ outputTokens: timestamp, totalTokens: timestamp }),
  }),
  z.object({ type: z.literal('cancelled') }),
  z.object({ type: z.literal('error'), message: z.string() }),
])

/** @typedef {z.infer<typeof streamEventSchema>} StreamEvent */

const attachment = z.object({
  id: z.string(),
  kind: z.enum(['file', 'image']),
  name: z.string(),
  mediaType: z.string().optional(),
  previewUrl: z.string().optional(),
  size: timestamp.optional(),
})
const point = z.object({
  offset: z.number().int().nonnegative(),
  segmentId: z.string(),
})
const draft = z
  .object({
    agent: agent.optional(),
    model: modelSchema.optional(),
    reasoningEffort: z.string().optional(),
    variant: z.string().optional(),
    mode: z.enum(['prompt', 'shell']),
    revision: z.number().int().nonnegative(),
    selection: z.object({ anchor: point, focus: point }),
    segments: z.array(
      z.discriminatedUnion('type', [
        z.object({ id: z.string(), text: z.string(), type: z.literal('text') }),
        z.object({
          id: z.string(),
          label: z.string(),
          value: z.string(),
          type: z.literal('reference'),
          referenceType: z.enum(['file', 'range', 'resource', 'agent']),
        }),
      ]),
    ),
    attachments: z.array(
      z.discriminatedUnion('state', [
        z.object({ attachment, state: z.literal('reading') }),
        z.object({
          attachment,
          state: z.literal('ready'),
          sourceId: z.string(),
        }),
        z.object({ attachment, state: z.literal('failed'), error }),
      ]),
    ),
  })
  .refine((value) => {
    const segments = new Map(
      value.segments.map((segment) => [segment.id, segment]),
    )
    return (
      segments.size === value.segments.length &&
      value.segments.some((segment) => segment.type === 'text') &&
      [value.selection.anchor, value.selection.focus].every((point) => {
        const segment = segments.get(point.segmentId)
        return (
          segment &&
          point.offset <= (segment.type === 'text' ? segment.text.length : 1)
        )
      })
    )
  }, 'Invalid draft selection or segments')

const partState = z.discriminatedUnion('status', [
  z.object({ status: z.literal('streaming') }),
  z.object({ status: z.literal('complete') }),
  z.object({ status: z.literal('interrupted') }),
  z.object({ status: z.literal('failed'), error }),
])
const toolState = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('receiving-input'),
    rawInput: z.string(),
    partialInput: z.json().optional(),
  }),
  z.object({ status: z.literal('queued'), input: z.json() }),
  z.object({
    status: z.literal('running'),
    input: z.json(),
    startedAt: timestamp,
    progress: z
      .object({
        current: timestamp.optional(),
        total: timestamp.optional(),
        label: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    status: z.literal('awaiting-permission'),
    input: z.json(),
    requestId: z.string(),
  }),
  z.object({
    status: z.literal('succeeded'),
    input: z.json(),
    output: z.json().optional(),
    endedAt: timestamp,
  }),
  z.object({
    status: z.literal('failed'),
    input: z.json().optional(),
    error,
    endedAt: timestamp,
  }),
  z.object({
    status: z.literal('cancelled'),
    input: z.json().optional(),
    reason: z.string().optional(),
    endedAt: timestamp,
  }),
])
const presentation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), image: image.optional() }),
  z.object({
    kind: z.literal('task'),
    description: z.string().optional(),
    agent: agent.optional(),
    activity: activity.optional(),
    childSessionId: z.string().optional(),
    blockers: z.array(z.string()).optional(),
    transcript: transcript.optional(),
  }),
  z.object({
    kind: z.literal('context'),
    operation: z.enum(['read', 'list', 'glob', 'grep']),
    target: z.string().optional(),
  }),
  z.object({
    kind: z.literal('web'),
    operation: z.enum(['fetch', 'search']),
    target: z.string().optional(),
  }),
  z.object({
    kind: z.literal('file-change'),
    operation: z.enum(['edit', 'write', 'patch']),
    path: z.string().optional(),
    content: z.string().optional(),
    files: z.array(
      z.object({
        id: z.string(),
        path: z.string(),
        previousPath: z.string().optional(),
        status: z.enum(['added', 'removed', 'modified', 'moved']),
        additions: timestamp.optional(),
        deletions: timestamp.optional(),
        hunks: z.array(
          z.object({
            id: z.string(),
            header: z.string(),
            lines: z.array(
              z.object({
                id: z.string(),
                content: z.string(),
                kind: z.enum(['context', 'addition', 'deletion']),
                newLine: timestamp.optional(),
                oldLine: timestamp.optional(),
              }),
            ),
          }),
        ),
      }),
    ),
    diagnostics: z.array(
      z.object({
        id: z.string(),
        path: z.string(),
        line: timestamp,
        column: timestamp,
        message: z.string(),
        severity: z.enum(['error', 'warning', 'information', 'hint']),
      }),
    ),
  }),
  z.object({
    kind: z.literal('shell'),
    command: z.string().optional(),
    workingDirectory: z.string().optional(),
    exitCode: z.number().optional(),
    durationMs: timestamp.optional(),
    outputTruncated: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('todo') }),
  z.object({ kind: z.literal('skill'), name: z.string().optional() }),
  z.object({ kind: z.literal('generic') }),
])
const part = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    id: z.string(),
    markdown: z.string(),
    state: partState,
  }),
  z.object({
    type: z.literal('reasoning'),
    id: z.string(),
    text: z.string(),
    state: partState,
    startedAt: timestamp.optional(),
    endedAt: timestamp.optional(),
  }),
  z.object({
    type: z.literal('tool'),
    id: z.string(),
    callId: z.string(),
    toolName: z.string(),
    state: toolState,
    presentation,
    metadata: z.record(z.string(), z.json()).optional(),
  }),
  z.object({
    type: z.literal('attachment'),
    id: z.string(),
    attachment,
    state: z.union([
      z.object({ status: z.literal('complete') }),
      z.object({ status: z.literal('failed'), error }),
    ]),
  }),
  z.object({
    type: z.literal('compaction'),
    id: z.string(),
    summary: z.string().optional(),
    state: partState,
  }),
  z.object({
    type: z.literal('retry'),
    id: z.string(),
    attempt: timestamp,
    error,
    resumeAt: timestamp.optional(),
  }),
  z.object({
    type: z.literal('notice'),
    id: z.string(),
    message: z.string(),
    tone: z.enum(['neutral', 'warning', 'danger']),
  }),
  z.object({
    type: z.literal('unknown'),
    id: z.string(),
    partType: z.string(),
    data: z.json().optional(),
  }),
])
const message = z.object({
  id: z.string(),
  turnId: z.string(),
  createdAt: timestamp,
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(part),
  delivery: z.discriminatedUnion('status', [
    z.object({ status: z.literal('optimistic'), clientId: z.string() }),
    z.object({ status: z.literal('confirmed') }),
    z.object({ status: z.literal('failed'), error, retryable: z.boolean() }),
  ]),
})
const turn = z.object({
  id: z.string(),
  agent: agent.optional(),
  model: modelSchema.optional(),
  reasoningEffort: z.string().optional(),
  user: message,
  assistant: z.array(message),
  state: z.discriminatedUnion('status', [
    z.object({ status: z.literal('queued') }),
    z.object({ status: z.literal('running'), startedAt: timestamp }),
    z.object({
      status: z.literal('retrying'),
      attempt: timestamp,
      error,
      resumeAt: timestamp.optional(),
    }),
    z.object({
      status: z.literal('complete'),
      startedAt: timestamp,
      endedAt: timestamp,
      stopReason: z.string().optional(),
    }),
    z.object({
      status: z.literal('interrupted'),
      startedAt: timestamp,
      endedAt: timestamp,
      reason: z.string().optional(),
    }),
    z.object({
      status: z.literal('failed'),
      startedAt: timestamp.optional(),
      endedAt: timestamp,
      error,
    }),
  ]),
})

export const savedHistorySchema = z.object({
  activeId: z.string(),
  conversations: z.array(
    z.object({
      id: z.string().regex(/^[0-9a-f-]{36}$/i),
      title: z.string(),
      hasContext: z.boolean(),
      composer: draft,
      turns: z.array(turn),
    }),
  ),
})
