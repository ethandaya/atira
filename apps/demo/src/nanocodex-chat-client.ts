import type { ChatCapabilities } from '@atira/foundations/chat'

import {
  apiErrorSchema,
  cancelResponseSchema,
  runtimeResponseSchema,
  streamEventSchema,
  type StreamEvent,
} from '../chat-contract.ts'

type StartTurn = {
  conversationId: string
  input: string
  model: ChatCapabilities['models'][number] | undefined
  resume: boolean
  retry: boolean
  signal: AbortSignal
  turnId: string
}

export async function fetchRuntime(signal: AbortSignal) {
  const response = await fetch('/api/runtime', { signal })
  if (!response.ok) throw new Error()
  const result = runtimeResponseSchema.safeParse(await response.json())
  signal.throwIfAborted()
  if (!result.success) throw new Error()
  return result.data
}

export function startTurn(input: StartTurn) {
  return checkedResponse(
    fetch('/api/chat', {
      body: JSON.stringify({
        input: input.input,
        model: input.model && {
          modelId: input.model.modelId,
          providerId: input.model.providerId,
        },
        resume: input.resume,
        retry: input.retry,
        turnId: input.turnId,
      }),
      headers: headers(input.conversationId),
      method: 'POST',
      signal: input.signal,
    }),
    input.signal,
  )
}

export function reconnectTurn(
  conversationId: string,
  turnId: string,
  signal: AbortSignal,
) {
  return checkedResponse(
    fetch(`/api/chat?turnId=${encodeURIComponent(turnId)}`, {
      headers: headers(conversationId),
      signal,
    }),
    signal,
  )
}

export async function cancelTurn(
  conversationId: string,
  turnId: string,
  signal: AbortSignal,
) {
  const response = await fetch('/api/cancel', {
    method: 'POST',
    headers: headers(conversationId),
    body: JSON.stringify({ turnId }),
    signal,
  })
  signal.throwIfAborted()
  if (!response.ok) throw new Error(await responseError(response))
  const result = cancelResponseSchema.safeParse(
    await response.json().catch(() => null),
  )
  if (!result.success || !result.data.cancelled) {
    throw new Error('The active response could not be stopped.')
  }
}

export async function readEvents(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) throw new Error('The response stream is unavailable.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()
    buffer += decoder.decode(result.value, { stream: !result.done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const event = parseEvent(line)
      if (event) onEvent(event)
    }
    if (result.done) break
  }
  const finalEvent = parseEvent(buffer)
  if (finalEvent) onEvent(finalEvent)
}

async function checkedResponse(
  request: Promise<Response>,
  signal: AbortSignal,
) {
  const response = await request
  signal.throwIfAborted()
  if (!response.ok) throw new Error(await responseError(response))
  return response
}

function headers(conversationId: string) {
  return {
    'Content-Type': 'application/json',
    'X-Conversation-Id': conversationId,
  }
}

function parseEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null
  try {
    const result = streamEventSchema.safeParse(JSON.parse(line))
    if (result.success) return result.data
  } catch {
    // The common error below keeps protocol details out of the user-facing message.
  }
  throw new Error('The response stream returned an invalid event.')
}

async function responseError(response: Response) {
  const result = apiErrorSchema.safeParse(
    await response.json().catch(() => null),
  )
  return result.success ? result.data.error : 'The model request failed.'
}
