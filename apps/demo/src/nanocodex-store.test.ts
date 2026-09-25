import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDraft, NanocodexChatStore } from './nanocodex-store'

describe('NanocodexChatStore', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 0),
    )
    vi.stubGlobal('cancelAnimationFrame', (handle: number) =>
      clearTimeout(handle),
    )
  })

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

  it('sends the active turn identity with stop and ignores stale local actions', async () => {
    let finish: (response: Response) => void = () => undefined
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValue(Response.json({ cancelled: true }))
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()
    await store.initialize()
    const sending = store.submit(createDraft('Hello'), 'send')
    await store.stop('old-turn')
    expect(fetch).toHaveBeenCalledTimes(2)
    const turnId = store.getSnapshot().turns[0]!.id
    await store.stop(turnId)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/cancel',
      expect.objectContaining({ body: JSON.stringify({ turnId }) }),
    )
    finish(streamResponse([{ type: 'cancelled' }]))
    await sending
    store.dispose()
  })

  it('validates model identities before exposing discovered models to the composer', async () => {
    const valid = { label: 'Valid', modelId: 'valid', providerId: 'test' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          available: true,
          conversationSessions: true,
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
    expect(store.getSnapshot().capabilities.models).toEqual([valid])
    expect(store.getSnapshot().composer.model).toEqual(valid)
    store.dispose()
  })

  it.each(['streamed', 'partial', 'completion-only', 'segment-snapshot'])(
    'preserves text/tool chronology with a %s final answer',
    async (mode) => {
      const intro = 'I will check the sources.\n\n'
      const answer = 'The evidence supports this recommendation.'
      const finalEvents =
        mode === 'completion-only'
          ? []
          : mode === 'segment-snapshot'
            ? [{ type: 'assistant-message', text: answer }]
            : [
                {
                  type: 'assistant-delta',
                  text: mode === 'partial' ? 'The evidence' : answer,
                },
              ]
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValueOnce(runtimeResponse())
          .mockResolvedValueOnce(
            streamResponse([
              { type: 'started' },
              { type: 'assistant-delta', text: 'I will check ' },
              { type: 'assistant-delta', text: 'the sources.\n\n' },
              {
                type: 'tool-started',
                id: 'search',
                tool: 'search_web',
                input: 'Official sources',
                summary: 'Searching',
              },
              {
                type: 'tool-completed',
                id: 'search',
                tool: 'search_web',
                status: 'succeeded',
                summary: 'Sources found',
              },
              ...finalEvents,
              { type: 'assistant-message', text: intro + answer },
              {
                type: 'completed',
                message: intro + answer,
                durationMs: 1,
                usage: { outputTokens: 1, totalTokens: 2 },
              },
            ]),
          ),
      )
      const store = new NanocodexChatStore()
      await store.initialize()
      await store.submit(createDraft('Compare the sources'), 'send')
      const parts = store.getSnapshot().turns[0]!.assistant[0]!.parts
      expect(parts).toEqual([
        expect.objectContaining({
          type: 'text',
          markdown: intro,
          state: { status: 'complete' },
        }),
        expect.objectContaining({ type: 'tool', callId: 'search' }),
        expect.objectContaining({
          type: 'text',
          markdown: answer,
          state: { status: 'complete' },
        }),
      ])
      expect(new Set(parts.map((part) => part.id)).size).toBe(parts.length)
      store.dispose()
    },
  )

  it('preserves failed tool input and target, then retries the same turn without consuming the draft', async () => {
    let resolveRetry: (value: Response) => void = () => undefined
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(
        streamResponse([
          {
            type: 'tool-started',
            id: 'search',
            tool: 'search_web',
            summary: 'Searching',
            input: 'Find bike stores',
          },
          {
            type: 'tool-completed',
            id: 'search',
            tool: 'search_web',
            summary: 'Search failed',
            status: 'failed',
            error: 'network error',
          },
          { type: 'error', message: 'network error' },
        ]),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve
          }),
      )
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()
    await store.initialize()
    await store.submit(createDraft('Find a bike'), 'send')
    const failed = store.getSnapshot().turns[0]!
    expect(failed.assistant[0]?.parts[0]).toMatchObject({
      state: { status: 'failed', input: 'Find bike stores' },
      presentation: {
        kind: 'web',
        operation: 'search',
        target: 'Find bike stores',
      },
    })
    store.updateDraft(createDraft('Unsent follow-up'))
    const retry = store.retryTurn(failed.id)
    await store.retryTurn(failed.id)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toMatchObject({
      turnId: failed.id,
      retry: true,
      input: 'Find a bike',
    })
    resolveRetry(
      streamResponse([
        {
          type: 'completed',
          message: 'Recovered.',
          durationMs: 1,
          usage: { outputTokens: 1, totalTokens: 2 },
        },
      ]),
    )
    await retry
    expect(store.getSnapshot().turns).toHaveLength(1)
    expect(store.getSnapshot().turns[0]?.user).toEqual(failed.user)
    expect(store.getSnapshot().turns[0]?.state.status).toBe('complete')
    expect(store.getSnapshot().composer.segments[0]).toMatchObject({
      text: 'Unsent follow-up',
    })
    store.dispose()
  })

  it('restores conversations and drafts and resumes their original runtime IDs', async () => {
    let saved: string | null = null
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value
      },
    }
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      url === '/api/runtime'
        ? runtimeResponse()
        : streamResponse([
            {
              type: 'completed',
              message: 'Remembered.',
              durationMs: 1,
              usage: { outputTokens: 1, totalTokens: 2 },
            },
          ]),
    )
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore(storage)
    await store.initialize()
    const firstId = store.getSnapshot().sessionId
    await store.submit(createDraft('Remember alpha'), 'send')
    store.updateDraft(createDraft('First draft'))
    store.newConversation()
    const secondId = store.getSnapshot().sessionId
    expect(secondId).not.toBe(firstId)
    await store.submit(createDraft('Remember beta'), 'send')
    store.updateDraft(createDraft('Second draft'))
    store.selectConversation(firstId)
    expect(store.getSnapshot().composer.segments[0]).toMatchObject({
      text: 'First draft',
    })
    store.dispose()

    const restored = new NanocodexChatStore(storage)
    await restored.initialize()
    expect(restored.getSnapshot().sessionId).toBe(firstId)
    expect(restored.getSnapshot().turns).toHaveLength(1)
    await restored.submit(createDraft('Continue alpha'), 'send')
    const request = fetch.mock.calls.at(-1)?.[1]
    expect(request?.headers).toMatchObject({ 'X-Conversation-Id': firstId })
    expect(JSON.parse(request?.body as string)).toMatchObject({ resume: true })
    restored.selectConversation(secondId)
    expect(restored.getSnapshot().turns).toHaveLength(1)
    expect(restored.getSnapshot().composer.segments[0]).toMatchObject({
      text: 'Second draft',
    })
    restored.dispose()
  })

  it('preserves an unfinished stream for replay and blocks switching while busy', async () => {
    let saved: string | null = null
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value
      },
    }
    let finish: () => void = () => undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url === '/api/runtime'
          ? runtimeResponse()
          : new Response(
              new ReadableStream({
                start(controller) {
                  finish = () => {
                    controller.enqueue(
                      new TextEncoder().encode('{"type":"cancelled"}\n'),
                    )
                    controller.close()
                  }
                },
              }),
            ),
      ),
    )
    const store = new NanocodexChatStore(storage)
    await store.initialize()
    const originalId = store.getSnapshot().sessionId
    const request = store.submit(createDraft('In flight'), 'send')
    await Promise.resolve()
    store.newConversation()
    expect(store.getSnapshot().sessionId).toBe(originalId)
    store.persist()
    const restored = new NanocodexChatStore(storage)
    expect(restored.getSnapshot().activity.status).toBe('idle')
    expect(restored.getSnapshot().turns[0]?.state.status).toBe('running')
    finish()
    await request
    store.dispose()
    restored.dispose()
  })

  it('reports unavailable browser storage without breaking the chat store', () => {
    const storage = {
      getItem: () => '{broken',
      setItem: () => {
        throw new Error('Quota exceeded')
      },
    }
    const store = new NanocodexChatStore(storage)
    expect(store.getSnapshot().submissionError?.message).toContain(
      'could not be restored',
    )
    store.persist()
    expect(store.getSnapshot().submissionError?.message).toContain(
      'could not be saved',
    )
    expect(store.getSnapshot().turns).toEqual([])
    store.dispose()
  })

  it.each([
    ['null segment', { segments: [null] }],
    [
      'non-text segment content',
      { segments: [{ id: 'text', type: 'text', text: {} }] },
    ],
    ['invalid attachment', { attachments: [null] }],
    [
      'missing selection segment',
      {
        selection: {
          anchor: { segmentId: 'missing', offset: 0 },
          focus: { segmentId: 'missing', offset: 0 },
        },
      },
    ],
  ])(
    'rejects persisted drafts with %s without installing invalid history',
    (_label, invalid) => {
      const id = crypto.randomUUID()
      const data = {
        activeId: id,
        conversations: [
          {
            id,
            title: 'Saved',
            hasContext: true,
            turns: [],
            composer: { ...createDraft('Saved draft'), ...invalid },
          },
        ],
      }
      const store = new NanocodexChatStore({
        getItem: () => JSON.stringify(data),
        setItem: () => {},
      })
      expect(store.getSnapshot().submissionError?.message).toContain(
        'could not be restored',
      )
      expect(store.getSnapshot().sessionId).not.toBe(id)
      expect(store.getSnapshot().composer.segments[0]).toMatchObject({
        text: '',
      })
      expect(store.getConversations()).toHaveLength(1)
      store.dispose()
    },
  )

  it('round-trips tool targets and raw inputs and rejects malformed nested message parts', async () => {
    let saved = ''
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value
      },
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(runtimeResponse())
        .mockResolvedValueOnce(
          streamResponse([
            {
              type: 'tool-started',
              id: 'catalog',
              tool: 'inspect_component_catalog',
              summary: 'Inspecting',
              input: 'timeline',
            },
            {
              type: 'tool-completed',
              id: 'catalog',
              tool: 'inspect_component_catalog',
              summary: 'Found component',
              status: 'succeeded',
              output: 'Timeline',
            },
            {
              type: 'tool-started',
              id: 'alias',
              tool: 'web_search',
              summary: 'Searching',
              input: 'Find sources',
            },
            {
              type: 'tool-completed',
              id: 'alias',
              tool: 'web_search',
              summary: 'Found sources',
              status: 'succeeded',
              output: 'Two sources',
            },
            {
              type: 'completed',
              message: 'Answer',
              durationMs: 3,
              usage: { outputTokens: 2, totalTokens: 5 },
            },
          ]),
        ),
    )
    const store = new NanocodexChatStore(storage)
    await store.initialize()
    await store.submit(createDraft('Find sources'), 'send')
    store.persist()
    const restored = new NanocodexChatStore(storage)
    expect(restored.getSnapshot().turns).toEqual(store.getSnapshot().turns)
    expect(restored.getSnapshot().turns[0]?.assistant[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presentation: {
            kind: 'context',
            operation: 'grep',
            target: 'timeline',
          },
          state: expect.objectContaining({ input: 'timeline' }),
        }),
        expect.objectContaining({
          presentation: { kind: 'generic' },
          state: expect.objectContaining({ input: 'Find sources' }),
          toolName: 'web_search',
        }),
      ]),
    )
    expect(restored.getSnapshot().submissionError).toBeUndefined()
    const valid = saved
    for (const invalidPart of [
      null,
      { type: 'text', markdown: {} },
      {
        type: 'tool',
        presentation: { kind: 'task', transcript: { steps: [null] } },
      },
    ]) {
      const data = JSON.parse(valid)
      data.conversations[0].turns[0].assistant[0].parts = [invalidPart]
      saved = JSON.stringify(data)
      const rejected = new NanocodexChatStore(storage)
      expect(rejected.getSnapshot().submissionError?.message).toContain(
        'could not be restored',
      )
      expect(rejected.getSnapshot().turns).toEqual([])
      rejected.dispose()
    }
    restored.dispose()
    store.dispose()
  })

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
          { text: 'Planning the external check. ', type: 'reasoning-delta' },
          {
            id: 'web-call',
            input: 'current StyleX release',
            summary: 'Searching the web',
            tool: 'search_web',
            type: 'tool-started',
          },
          {
            id: 'web-call',
            output: 'StyleX release notes\nhttps://stylexjs.com/',
            status: 'succeeded',
            summary: 'Searched the web',
            tool: 'search_web',
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
    expect(
      turn?.assistant[0]?.parts.filter((part) => part.type === 'reasoning'),
    ).toEqual([
      expect.objectContaining({
        state: { status: 'complete' },
        text: 'Checking the catalog. ',
      }),
      expect.objectContaining({
        state: { status: 'complete' },
        text: 'Planning the external check. ',
      }),
    ])
    expect(turn?.assistant[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: { status: 'complete' },
          text: 'Checking the catalog. ',
          type: 'reasoning',
        }),
        expect.objectContaining({
          presentation: {
            kind: 'context',
            operation: 'grep',
            target: 'timeline',
          },
          state: expect.objectContaining({
            input: 'timeline',
            output: 'Timeline, Turn',
            status: 'succeeded',
          }),
          type: 'tool',
        }),
        expect.objectContaining({
          presentation: {
            kind: 'web',
            operation: 'search',
            target: 'current StyleX release',
          },
          state: expect.objectContaining({
            input: 'current StyleX release',
            output: 'StyleX release notes\nhttps://stylexjs.com/',
            status: 'succeeded',
          }),
          toolName: 'search_web',
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
    expect(
      JSON.parse(fetch.mock.calls[1]![1]!.body as string),
    ).not.toHaveProperty('reasoningEffort')
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

function runtimeResponse() {
  return Response.json({
    retryTurns: true,
    conversationSessions: true,
    available: true,
    model: 'test-model',
    runtime: 'Nanocodex',
  })
}

function streamResponse(events: readonly object[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n'))
}
