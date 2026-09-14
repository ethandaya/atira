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

  it.each(['streamed', 'partial', 'completion-only', 'segment-snapshot'])('preserves text/tool chronology with a %s final answer', async (mode) => {
    const intro = 'I will check the sources.\n\n'
    const answer = 'The evidence supports this recommendation.'
    const finalEvents = mode === 'completion-only' ? [] : mode === 'segment-snapshot'
      ? [{ type: 'assistant-message', text: answer }]
      : [{ type: 'assistant-delta', text: mode === 'partial' ? 'The evidence' : answer }]
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(streamResponse([
        { type: 'started' },
        { type: 'assistant-delta', text: 'I will check ' },
        { type: 'assistant-delta', text: 'the sources.\n\n' },
        { type: 'tool-started', id: 'search', tool: 'search_web', input: 'Official sources', summary: 'Searching' },
        { type: 'tool-completed', id: 'search', tool: 'search_web', status: 'succeeded', summary: 'Sources found' },
        ...finalEvents,
        { type: 'assistant-message', text: intro + answer },
        { type: 'completed', message: intro + answer, durationMs: 1, usage: { outputTokens: 1, totalTokens: 2 } },
      ])))
    const store = new NanocodexChatStore()
    await store.initialize()
    await store.submit(createDraft('Compare the sources'), 'send')
    const parts = store.getSnapshot().turns[0]!.assistant[0]!.parts
    expect(parts).toEqual([
      expect.objectContaining({ type: 'text', markdown: intro, state: { status: 'complete' } }),
      expect.objectContaining({ type: 'tool', callId: 'search' }),
      expect.objectContaining({ type: 'text', markdown: answer, state: { status: 'complete' } }),
    ])
    expect(new Set(parts.map(part => part.id)).size).toBe(parts.length)
    store.dispose()
  })

  it('preserves failed subagent input and partial transcript, then retries the same turn without consuming the draft', async () => {
    let resolveRetry: (value: Response) => void = () => undefined
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(runtimeResponse())
      .mockResolvedValueOnce(streamResponse([
        { type: 'tool-started', id: 'child', tool: 'run_subagent', summary: 'Working', input: 'Find bike stores', kind: 'task', childSessionId: 'child-session' },
        { type: 'tool-progress', id: 'child', tool: 'run_subagent', summary: 'Working', kind: 'task', transcript: { reasoning: 'Checking stores.', result: 'One supplier.', steps: [] } },
        { type: 'error', message: 'network error' },
      ]))
      .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve }))
    vi.stubGlobal('fetch', fetch)
    const store = new NanocodexChatStore()
    await store.initialize()
    await store.submit(createDraft('Find a bike'), 'send')
    const failed = store.getSnapshot().turns[0]!
    expect(failed.assistant[0]?.parts[0]).toMatchObject({
      state: { status: 'failed', input: { description: 'Find bike stores' } },
      presentation: { transcript: { reasoning: 'Checking stores.', result: 'One supplier.' } },
    })
    store.updateDraft(createDraft('Unsent follow-up'))
    const retry = store.retryTurn(failed.id)
    await store.retryTurn(failed.id)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toMatchObject({ turnId: failed.id, retry: true, input: 'Find a bike' })
    resolveRetry(streamResponse([{ type: 'completed', message: 'Recovered.', durationMs: 1, usage: { outputTokens: 1, totalTokens: 2 } }]))
    await retry
    expect(store.getSnapshot().turns).toHaveLength(1)
    expect(store.getSnapshot().turns[0]?.user).toEqual(failed.user)
    expect(store.getSnapshot().turns[0]?.state.status).toBe('complete')
    expect(store.getSnapshot().composer.segments[0]).toMatchObject({ text: 'Unsent follow-up' })
    store.dispose()
  })

  it('restores conversations and drafts and resumes their original runtime IDs', async () => {
    let saved: string | null = null
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => url === '/api/runtime'
      ? runtimeResponse()
      : streamResponse([{ type: 'completed', message: 'Remembered.', durationMs: 1, usage: { outputTokens: 1, totalTokens: 2 } }]))
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
    expect(store.getSnapshot().composer.segments[0]).toMatchObject({ text: 'First draft' })
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
    expect(restored.getSnapshot().composer.segments[0]).toMatchObject({ text: 'Second draft' })
    restored.dispose()
  })

  it('preserves an unfinished stream for replay and blocks switching while busy', async () => {
    let saved: string | null = null
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
    let finish: () => void = () => undefined
    vi.stubGlobal('fetch', vi.fn(async (url) => url === '/api/runtime' ? runtimeResponse() : new Response(new ReadableStream({
      start(controller) { finish = () => { controller.enqueue(new TextEncoder().encode('{"type":"cancelled"}\n')); controller.close() } },
    }))))
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
    const storage = { getItem: () => '{broken', setItem: () => { throw new Error('Quota exceeded') } }
    const store = new NanocodexChatStore(storage)
    expect(store.getSnapshot().submissionError?.message).toContain('could not be restored')
    store.persist()
    expect(store.getSnapshot().submissionError?.message).toContain('could not be saved')
    expect(store.getSnapshot().turns).toEqual([])
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
          {
            agent: { id: 'review', label: 'Review agent' },
            childSessionId: 'child-session',
            id: 'subagent-call',
            input: 'Review the response hierarchy',
            kind: 'task',
            summary: 'Subagent working',
            tool: 'run_subagent',
            type: 'tool-started',
          },
          {
            activity: {
              detail: 'I am checking the response hierarchy.',
              summary: 'Thinking',
            },
            agent: { id: 'review', label: 'Review agent' },
            childSessionId: 'child-session',
            id: 'subagent-call',
            kind: 'task',
            summary: 'Subagent working',
            tool: 'run_subagent',
            type: 'tool-progress',
          },
          {
            agent: { id: 'review', label: 'Review agent' },
            childSessionId: 'child-session',
            id: 'subagent-call',
            kind: 'task',
            output: 'The hierarchy is clear.',
            status: 'succeeded',
            summary: 'Subagent completed',
            tool: 'run_subagent',
            transcript: {
              reasoning: 'I checked the hierarchy.',
              result: '**No blocking issues.** The hierarchy is clear.',
              steps: [
                {
                  id: 'child-catalog-call',
                  input: 'response hierarchy',
                  output: 'Turn, MessageParts',
                  status: 'succeeded',
                  summary: 'Searched component catalog',
                  tool: 'inspect_component_catalog',
                },
              ],
            },
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
          presentation: { kind: 'context', operation: 'grep' },
          state: expect.objectContaining({
            output: 'Timeline, Turn',
            status: 'succeeded',
          }),
          type: 'tool',
        }),
        expect.objectContaining({
          presentation: { kind: 'web', operation: 'search' },
          state: expect.objectContaining({
            input: { query: 'current StyleX release' },
            output: 'StyleX release notes\nhttps://stylexjs.com/',
            status: 'succeeded',
          }),
          toolName: 'search_web',
          type: 'tool',
        }),
        expect.objectContaining({
          presentation: {
            activity: {
              detail: 'I am checking the response hierarchy.',
              summary: 'Thinking',
            },
            agent: { id: 'review', label: 'Review agent' },
            childSessionId: 'child-session',
            kind: 'task',
            transcript: {
              reasoning: 'I checked the hierarchy.',
              result: '**No blocking issues.** The hierarchy is clear.',
              steps: [
                {
                  id: 'child-catalog-call',
                  input: 'response hierarchy',
                  output: 'Turn, MessageParts',
                  status: 'succeeded',
                  summary: 'Searched component catalog',
                  tool: 'inspect_component_catalog',
                },
              ],
            },
          },
          state: expect.objectContaining({
            input: { description: 'Review the response hierarchy' },
            output: 'The hierarchy is clear.',
            status: 'succeeded',
          }),
          toolName: 'run_subagent',
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
  return Response.json({ retryTurns: true, conversationSessions: true, available: true, model: 'test-model', runtime: 'Nanocodex' })
}

function streamResponse(events: readonly object[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join('\n'))
}
