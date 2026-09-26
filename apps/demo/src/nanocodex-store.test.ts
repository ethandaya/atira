import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDraft, NanocodexChatStore } from './nanocodex-store'
import {
  controlledStreamResponse,
  installAnimationFrameStub,
  runtimeResponse,
  streamResponse,
} from './nanocodex-store.test-fixtures'

describe('NanocodexChatStore', () => {
  beforeEach(installAnimationFrameStub)

  afterEach(() => vi.unstubAllGlobals())

  it.each(['runtime-first', 'turn-first'])(
    'disposes independent operations without late writes (%s)',
    async (order) => {
      const pending: {
        url: string
        signal: AbortSignal
        resolve: (response: Response) => void
      }[] = []
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(runtimeResponse())
        .mockImplementation(
          (url, options) =>
            new Promise((resolve) =>
              pending.push({
                url: String(url),
                signal: options!.signal!,
                resolve,
              }),
            ),
        )
      vi.stubGlobal('fetch', fetch)
      const store = new NanocodexChatStore()
      await store.initialize()
      const startRuntime = () => store.initialize()
      const startTurn = () => store.submit(createDraft('Hello'), 'send')
      const operations =
        order === 'runtime-first'
          ? [startRuntime(), startTurn()]
          : [startTurn(), startRuntime()]
      expect(pending).toHaveLength(2)
      store.dispose()
      const snapshot = store.getSnapshot()
      for (const operation of pending) {
        expect(operation.signal.aborted).toBe(true)
        operation.resolve(
          operation.url === '/api/runtime'
            ? runtimeResponse()
            : streamResponse([
                {
                  type: 'completed',
                  message: 'Late reply',
                  durationMs: 1,
                  usage: { outputTokens: 1, totalTokens: 2 },
                },
              ]),
        )
      }
      await Promise.all(operations)
      expect(store.getSnapshot()).toBe(snapshot)
      fetch.mockImplementation(async (url) =>
        url === '/api/runtime'
          ? runtimeResponse()
          : streamResponse([
              {
                type: 'completed',
                message: 'Resumed',
                durationMs: 1,
                usage: { outputTokens: 1, totalTokens: 2 },
              },
            ]),
      )
      await store.initialize()
      expect(store.getSnapshot().turns[0]?.state.status).toBe('complete')
      store.dispose()
    },
  )

  it('keeps the turn busy until cancellation reaches the response stream', async () => {
    const stream = controlledStreamResponse()
    let resolveCancellation!: (response: Response) => void
    const cancellation = new Promise<Response>((resolve) => {
      resolveCancellation = resolve
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(stream.response)
      .mockReturnValueOnce(cancellation)
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()
    await store.initialize()
    const sending = store.submit(createDraft('Hello'), 'send')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    stream.push({ type: 'started' })
    await store.stop('old-turn')
    expect(fetch).toHaveBeenCalledTimes(2)
    const turnId = store.getSnapshot().turns[0]!.id
    const stopping = store.stop(turnId)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/cancel',
      expect.objectContaining({ body: JSON.stringify({ turnId }) }),
    )
    expect(store.getSnapshot().activity).toEqual({ status: 'busy', turnId })
    await store.submit(createDraft('Blocked follow-up'), 'send')
    expect(fetch).toHaveBeenCalledTimes(3)

    resolveCancellation(Response.json({ cancelled: true }))
    await stopping
    expect(store.getSnapshot().activity).toEqual({ status: 'busy', turnId })

    stream.push({ type: 'cancelled' })
    stream.close()
    await sending
    expect(store.getSnapshot().activity).toEqual({ status: 'idle' })
    expect(store.getSnapshot().turns[0]?.state.status).toBe('interrupted')
    store.dispose()
  })

  it('keeps the active turn running and reports cancellation failures', async () => {
    const stream = controlledStreamResponse()
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(stream.response)
      .mockResolvedValueOnce(
        Response.json(
          { error: 'Cancellation is temporarily unavailable.' },
          { status: 503 },
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()
    await store.initialize()
    const sending = store.submit(createDraft('Hello'), 'send')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    stream.push({ type: 'started' })
    const turnId = store.getSnapshot().turns[0]!.id

    await store.stop(turnId)

    expect(store.getSnapshot().activity).toEqual({ status: 'busy', turnId })
    expect(store.getSnapshot().capabilities.canSubmit).toBe(false)
    expect(store.getSnapshot().submissionError).toMatchObject({
      message: 'Cancellation is temporarily unavailable.',
      retryable: false,
    })

    stream.push({ type: 'cancelled' })
    stream.close()
    await sending
    store.dispose()
  })

  it('rejects a runtime response with malformed model identities', async () => {
    const valid = { label: 'Valid', modelId: 'valid', providerId: 'test' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          available: true,
          model: 'valid',
          runtime: 'Test',
          models: [
            valid,
            { label: 'Missing provider', modelId: 'bad' },
            { ...valid, label: 42 },
          ],
        }),
      ),
    )
    const store = new NanocodexChatStore()
    await store.initialize()
    expect(store.getSnapshot().capabilities.models).toEqual([])
    expect(store.getRuntimeSnapshot()).toEqual({
      message: 'The local model runtime could not be reached.',
      status: 'unavailable',
    })
    store.dispose()
  })

  it('reports an HTTP runtime failure without reading its body', async () => {
    const response = new Response('upstream details', { status: 503 })
    const readBody = vi.spyOn(response, 'json')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )
    const store = new NanocodexChatStore()

    await store.initialize()

    expect(readBody).not.toHaveBeenCalled()
    expect(store.getRuntimeSnapshot()).toEqual({
      message: 'The local model runtime could not be reached.',
      status: 'unavailable',
    })
    store.dispose()
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
    expect(store.getSnapshot().turns[0]?.user.delivery.status).toBe(
      'optimistic',
    )

    rejectChat(new Error('Network unavailable.'))
    await submission

    const snapshot = store.getSnapshot()
    expect(snapshot.activity.status).toBe('idle')
    expect(snapshot.turns).toHaveLength(0)
    expect(snapshot.composer.segments[0]).toEqual(
      expect.objectContaining({ text: 'Keep this draft.', type: 'text' }),
    )
    expect(snapshot.submissionError).toEqual(
      expect.objectContaining({
        message: 'Network unavailable.',
        retryable: true,
      }),
    )
  })
})
