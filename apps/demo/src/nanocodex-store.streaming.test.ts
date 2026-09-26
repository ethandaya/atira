import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDraft, NanocodexChatStore } from './nanocodex-store'
import {
  installAnimationFrameStub,
  runtimeResponse,
  streamResponse,
} from './nanocodex-store.test-fixtures'

describe('NanocodexChatStore', () => {
  beforeEach(installAnimationFrameStub)

  afterEach(() => vi.unstubAllGlobals())

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
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toMatchObject({
      reasoningEffort: 'medium',
    })
  })
})
