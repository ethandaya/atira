import type { ChatError, ChatMessage, ToolPart } from '@atira/foundations/chat'

import type { StreamEvent } from '../chat-contract.ts'

export function assistantMessage(
  id: string,
  turnId: string,
  createdAt: number,
): ChatMessage {
  return {
    createdAt,
    delivery: { status: 'confirmed' },
    id,
    parts: [],
    role: 'assistant',
    turnId,
  }
}

export function applyStreamEvent(
  message: ChatMessage,
  event: Exclude<
    StreamEvent,
    { type: 'started' | 'completed' | 'cancelled' | 'error' }
  >,
  startedAt: number,
  eventAt = Date.now(),
) {
  if (event.type === 'assistant-delta') {
    const parts = completeStreamingReasoning(message.parts, eventAt)
    return {
      ...message,
      parts: updateText(parts, `${message.id}:text`, event.text, false),
    }
  }
  if (event.type === 'assistant-message') {
    return {
      ...message,
      parts: replaceText(
        completeStreamingReasoning(message.parts, eventAt),
        event.text,
      ),
    }
  }
  if (event.type === 'reasoning-delta') {
    return {
      ...message,
      parts: updateReasoning(message.parts, message.id, event.text, startedAt),
    }
  }
  if (event.type === 'tool-started') {
    const tool: ToolPart = {
      callId: event.id,
      id: event.id,
      presentation: toolPresentation(event.tool, event.input),
      state: {
        input: event.input ?? '',
        startedAt: eventAt,
        status: 'running',
      },
      toolName: event.tool,
      type: 'tool',
    }
    return {
      ...message,
      parts: upsertPart(
        completeStreamingReasoning(message.parts, eventAt),
        tool,
      ),
    }
  }

  const existing = message.parts.find(
    (part): part is ToolPart =>
      part.type === 'tool' && part.callId === event.id,
  )
  const input =
    existing && 'input' in existing.state ? existing.state.input : {}
  const tool: ToolPart = {
    callId: event.id,
    id: event.id,
    presentation: existing?.presentation ?? toolPresentation(event.tool),
    state:
      event.status === 'failed'
        ? {
            endedAt: eventAt,
            error: providerError(event.error, false),
            input,
            status: 'failed',
          }
        : {
            endedAt: eventAt,
            input,
            ...(event.output === undefined ? {} : { output: event.output }),
            status: 'succeeded',
          },
    toolName: event.tool,
    type: 'tool',
  }
  return { ...message, parts: upsertPart(message.parts, tool) }
}

export function replaceText(parts: ChatMessage['parts'], text: string) {
  const streamed = parts
    .flatMap((part) => (part.type === 'text' ? [part.markdown] : []))
    .join('')
  if (streamed.trim() === text.trim()) return parts

  const tail = parts.at(-1)
  const earlier = tail?.type === 'text' ? parts.slice(0, -1) : parts
  const prefix = earlier
    .flatMap((part) => (part.type === 'text' ? [part.markdown] : []))
    .join('')
    .trimStart()
  const remaining = text.trimStart().startsWith(prefix)
    ? text.trimStart().slice(prefix.length)
    : text
  return updateText(parts, 'response-text', remaining, true)
}

export function settleAssistantParts(
  message: ChatMessage,
  state:
    | { status: 'complete' | 'interrupted' }
    | { error: ChatError; status: 'failed' },
  endedAt = Date.now(),
): ChatMessage {
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return { ...part, state }
      }
      if (part.type === 'tool' && !isTerminalTool(part)) {
        const input = toolInput(part)
        if (state.status === 'failed') {
          return {
            ...part,
            state: {
              endedAt,
              error: state.error,
              ...(input === undefined ? {} : { input }),
              status: 'failed',
            },
          }
        }
        return {
          ...part,
          state: {
            endedAt,
            ...(input === undefined ? {} : { input }),
            status: 'cancelled',
          },
        }
      }
      return part
    }),
  }
}

export function providerError(
  message = 'The response could not be completed.',
  retryable: boolean,
): ChatError {
  return { kind: 'provider', message, retryable }
}

function updateText(
  parts: ChatMessage['parts'],
  id: string,
  text: string,
  replace: boolean,
) {
  // A tool or reasoning part starts a new text segment in the response.
  const tail = parts.at(-1)
  const existing = tail?.type === 'text' ? tail : undefined
  const part = {
    id: existing?.id ?? `${id}:${parts.length}`,
    markdown: `${replace ? '' : (existing?.markdown ?? '')}${text}`,
    state: { status: 'streaming' as const },
    type: 'text' as const,
  }
  return upsertPart(parts, part)
}

function updateReasoning(
  parts: ChatMessage['parts'],
  messageId: string,
  text: string,
  startedAt: number,
) {
  let existing:
    | Extract<ChatMessage['parts'][number], { type: 'reasoning' }>
    | undefined
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (part?.type === 'reasoning' && part.state.status === 'streaming') {
      existing = part
      break
    }
  }
  const count = parts.filter((part) => part.type === 'reasoning').length
  return upsertPart(parts, {
    id: existing?.id ?? `${messageId}:reasoning:${count}`,
    startedAt: existing?.startedAt ?? startedAt,
    state: { status: 'streaming' },
    text: `${existing?.text ?? ''}${text}`,
    type: 'reasoning',
  })
}

function completeStreamingReasoning(
  parts: ChatMessage['parts'],
  endedAt = Date.now(),
) {
  return parts.map((part) =>
    part.type === 'reasoning' && part.state.status === 'streaming'
      ? { ...part, endedAt, state: { status: 'complete' as const } }
      : part,
  )
}

function upsertPart(
  parts: ChatMessage['parts'],
  part: ChatMessage['parts'][number],
) {
  const index = parts.findIndex((item) => item.id === part.id)
  if (index === -1) return [...parts, part]
  return parts.map((item, itemIndex) => (itemIndex === index ? part : item))
}

function isTerminalTool(part: ToolPart) {
  return (
    part.state.status === 'succeeded' ||
    part.state.status === 'failed' ||
    part.state.status === 'cancelled'
  )
}

function toolInput(part: ToolPart) {
  return 'input' in part.state ? part.state.input : undefined
}

function toolPresentation(
  tool: string,
  input?: string,
): ToolPart['presentation'] {
  const target = input === undefined ? {} : { target: input }
  if (tool === 'search_web')
    return { kind: 'web', operation: 'search', ...target }
  if (tool === 'inspect_component_catalog')
    return { kind: 'context', operation: 'grep', ...target }
  return { kind: 'generic' }
}
