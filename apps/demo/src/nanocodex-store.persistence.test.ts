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
    expect(restored.getSnapshot().composer.model).toEqual({
      description: 'Test model description',
      label: 'Test model',
      modelId: 'test-model',
      providerId: 'test-provider',
    })
    await restored.submit(createDraft('Continue alpha'), 'send')
    const request = fetch.mock.calls.at(-1)?.[1]
    expect(request?.headers).toMatchObject({ 'X-Conversation-Id': firstId })
    expect(JSON.parse(request?.body as string)).toMatchObject({
      model: { modelId: 'test-model', providerId: 'test-provider' },
      resume: true,
    })
    expect(JSON.parse(request?.body as string).model).not.toHaveProperty(
      'description',
    )
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
    await vi.waitFor(() =>
      expect(store.getSnapshot().turns[0]?.state.status).toBe('running'),
    )
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
})
