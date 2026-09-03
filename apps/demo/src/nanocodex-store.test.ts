import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDraft, NanocodexChatStore } from './nanocodex-store'

describe('NanocodexChatStore', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 0),
    )
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('projects the playground stream through the protocol-neutral chat store', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(
        streamResponse([
          { type: 'started' },
          { text: 'Checking the catalog. ', type: 'reasoning-delta' },
          {
            id: 'catalog-call',
            input: 'timeline',
            summary: 'Searching component catalog',
            tool: 'inspect_component_catalog',
            type: 'tool-started',
          },
          {
            id: 'catalog-call',
            output: 'Timeline, Turn',
            status: 'succeeded',
            summary: 'Searched component catalog',
            tool: 'inspect_component_catalog',
            type: 'tool-completed',
          },
          { text: '# Result\n', type: 'assistant-delta' },
          {
            durationMs: 25,
            message: '# Result\nUse `Timeline`.',
            type: 'completed',
            usage: { outputTokens: 8, totalTokens: 12 },
          },
        ]),
      )
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()

    await store.initialize()
    await store.submit(createDraft('Find the timeline component.'), 'send')

    const snapshot = store.getSnapshot()
    const turn = snapshot.turns[0]
    expect(snapshot.activity).toEqual({ status: 'idle' })
    expect(turn?.user.delivery).toEqual({ status: 'confirmed' })
    expect(turn?.state.status).toBe('complete')
    expect(turn?.assistant[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: { status: 'complete' },
          text: 'Checking the catalog. ',
          type: 'reasoning',
        }),
        expect.objectContaining({
          presentation: { kind: 'context', operation: 'grep' },
          state: expect.objectContaining({
            output: 'Timeline, Turn',
            status: 'succeeded',
          }),
          type: 'tool',
        }),
        expect.objectContaining({
          markdown: '# Result\nUse `Timeline`.',
          state: { status: 'complete' },
          type: 'text',
        }),
      ]),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('publishes an optimistic turn and restores the submitted draft on rejection', async () => {
    let rejectChat: (reason: Error) => void = () => undefined
    const chat = new Promise<Response>((_resolve, reject) => {
      rejectChat = reject
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(runtimeResponse())
        .mockReturnValueOnce(chat),
    )
    const store = new NanocodexChatStore()
    await store.initialize()
    const draft = createDraft('Keep this draft.')

    const submission = store.submit(draft, 'send')
    expect(store.getSnapshot().activity.status).toBe('busy')
    expect(store.getSnapshot().turns[0]?.user.delivery.status).toBe('optimistic')

    rejectChat(new Error('Network unavailable.'))
    await submission

    const snapshot = store.getSnapshot()
    expect(snapshot.activity.status).toBe('idle')
    expect(snapshot.turns).toHaveLength(0)
    expect(snapshot.composer.segments[0]).toEqual(
      expect.objectContaining({ text: 'Keep this draft.', type: 'text' }),
    )
    expect(snapshot.submissionError).toEqual(
      expect.objectContaining({ message: 'Network unavailable.', retryable: true }),
    )
  })
})

function runtimeResponse() {
  return Response.json({ available: true, model: 'test-model', runtime: 'Nanocodex' })
}

function streamResponse(events: readonly object[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n'))
}
