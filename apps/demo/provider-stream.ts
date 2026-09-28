import { streamEventSchema } from './chat-contract.ts'
import { presentToolEvent } from './demo-tools.ts'

export function translateProviderEvent(event: {
  payload: Record<string, unknown>
  type: string
}) {
  if (event.type === 'assistant.delta') {
    return { text: stringValue(event.payload, 'text'), type: 'assistant-delta' }
  }
  if (event.type === 'assistant.message') {
    return {
      text: stringValue(event.payload, 'text'),
      type: 'assistant-message',
    }
  }
  if (event.type === 'reasoning.summary.delta') {
    return { text: stringValue(event.payload, 'text'), type: 'reasoning-delta' }
  }
  if (event.type === 'tool.call' || event.type === 'tool.result') {
    return presentToolEvent({ ...event.payload, type: event.type })
  }
  return undefined
}

export function writeStreamEvent(
  response: { writableEnded: boolean; write: (chunk: string) => unknown },
  event: unknown,
) {
  if (!response.writableEnded) {
    response.write(`${JSON.stringify(streamEventSchema.parse(event))}\n`)
  }
}

function stringValue(value: Record<string, unknown>, key: string) {
  const result = value[key]
  return typeof result === 'string' ? result : ''
}
