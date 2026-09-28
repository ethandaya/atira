import { z } from 'zod'

const timestamp = z.number().nonnegative()
export const modelSchema = z
  .strictObject({
    description: z.string().optional(),
    label: z.string(),
    modelId: z.string(),
    providerId: z.string(),
  })
  .transform(({ description, ...model }) => ({
    ...model,
    ...(description === undefined ? {} : { description }),
  }))

const requestedModelSchema = z.strictObject({
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
  .strictObject({
    available: z.boolean(),
    message: z.string().optional(),
    model: z.string(),
    models: z.array(modelSchema).default([]),
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
  resume: z.boolean().optional().default(false),
  retry: z.boolean().optional().default(false),
  turnId: turnId.optional(),
})

export const apiErrorSchema = z.strictObject({ error: z.string().min(1) })
export const cancelResponseSchema = z.strictObject({ cancelled: z.boolean() })

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

export type StreamEvent = z.infer<typeof streamEventSchema>
