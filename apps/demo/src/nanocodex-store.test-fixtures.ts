import { vi } from 'vitest'

export function installAnimationFrameStub() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0),
  )
  vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
    clearTimeout(handle),
  )
}

export function runtimeResponse() {
  return Response.json({
    available: true,
    model: 'test-model',
    models: [
      {
        description: 'Test model description',
        defaultReasoningEffort: 'medium',
        label: 'Test model',
        modelId: 'test-model',
        providerId: 'test-provider',
        reasoningEfforts: ['low', 'medium', 'high'],
      },
    ],
    retryTurns: true,
    runtime: 'Nanocodex',
  })
}

export function streamResponse(events: readonly object[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n'))
}

export function controlledStreamResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const encoder = new TextEncoder()
  return {
    close: () => controller.close(),
    push: (event: object) =>
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(streamController) {
          controller = streamController
        },
      }),
    ),
  }
}
