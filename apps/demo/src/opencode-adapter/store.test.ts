import type { Event, OpencodeClient } from '@opencode-ai/sdk/v2'
import type {
  ChatCapabilities,
  ComposerDraft,
} from '@pretty-amped/foundations/chat'
import { describe, expect, it, vi } from 'vitest'

import { OpenCodeChatStore } from './store'

describe('OpenCodeChatStore', () => {
  it('hydrates after subscribing and batches notifications per frame', async () => {
    const frame = scheduledFrame()
    const client = fakeClient()
    const store = createStore(client.value, frame.schedule)
    const listener = vi.fn()
    store.subscribe(listener)

    await store.initialize()

    expect(client.eventSubscribe).toHaveBeenCalledBefore(client.messages)
    expect(store.getSnapshot()).toMatchObject({
      connection: { status: 'connected' },
      history: { status: 'complete' },
    })
    expect(listener).not.toHaveBeenCalled()
    expect(frame.pending()).toBe(1)

    frame.flush()
    expect(listener).toHaveBeenCalledOnce()
    store.dispose()
  })

  it('forwards exact permission and structured question decisions', async () => {
    const frame = scheduledFrame()
    const client = fakeClient({ requests: true })
    const store = createStore(client.value, frame.schedule)
    await store.initialize()
    frame.flush()

    await store.decidePermission({
      decision: 'always',
      originSessionId: sessionId,
      requestId: 'permission',
    })
    await store.answerQuestion({
      originSessionId: sessionId,
      requestId: 'question',
      response: {
        answers: [
          {
            optionIds: ['question:question:0:option:0'],
            questionId: 'question:question:0',
            type: 'choice',
          },
        ],
      },
    })

    expect(client.permissionReply).toHaveBeenCalledWith(
      { directory, reply: 'always', requestID: 'permission' },
      { throwOnError: true },
    )
    expect(client.questionReply).toHaveBeenCalledWith(
      {
        answers: [['StyleX']],
        directory,
        requestID: 'question',
      },
      { throwOnError: true },
    )
    expect(store.getSnapshot().requests).toEqual([
      expect.objectContaining({ state: expect.objectContaining({ status: 'resolved' }) }),
      expect.objectContaining({ state: expect.objectContaining({ status: 'resolved' }) }),
    ])
    store.dispose()
  })

  it('projects an optimistic queued prompt and reconciles local queue state', async () => {
    const frame = scheduledFrame()
    const pending = deferred<{ data: undefined }>()
    const client = fakeClient({ promptResult: pending.promise })
    const store = createStore(client.value, frame.schedule)
    await store.initialize()
    frame.flush()

    const submitting = store.submit(draft, 'queue')
    const optimistic = store.getSnapshot()

    expect(optimistic.activity.status).toBe('busy')
    expect(optimistic.queue).toEqual([
      expect.objectContaining({ state: 'submitting' }),
    ])
    expect(optimistic.turns[0]?.user.delivery.status).toBe('optimistic')
    expect(client.promptAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'build',
        directory,
        model: { modelID: 'model', providerID: 'provider' },
        parts: [{ text: 'Inspect this.', type: 'text' }],
        sessionID: sessionId,
      }),
      { throwOnError: true },
    )

    pending.resolve({ data: undefined })
    await submitting
    expect(store.getSnapshot().queue).toEqual([])
    store.dispose()
  })
})

const sessionId = 'session'
const directory = '/workspace'

const capabilities: ChatCapabilities = {
  agents: [{ id: 'build', label: 'Build' }],
  busySubmission: ['queue', 'follow-up'],
  canAttach: true,
  canStop: true,
  canSubmit: true,
  canUseShell: true,
  models: [{ label: 'Model', modelId: 'model', providerId: 'provider' }],
  permissionDecisions: ['once', 'always', 'reject'],
  referenceTypes: ['file', 'range'],
  variants: [],
}

const draft: ComposerDraft = {
  agent: { id: 'build', label: 'Build' },
  attachments: [],
  mode: 'prompt',
  model: { label: 'Model', modelId: 'model', providerId: 'provider' },
  revision: 0,
  segments: [{ id: 'text', text: 'Inspect this.', type: 'text' }],
  selection: {
    anchor: { offset: 13, segmentId: 'text' },
    focus: { offset: 13, segmentId: 'text' },
  },
}

function createStore(
  client: OpencodeClient,
  scheduleNotification: (callback: () => void) => () => void,
) {
  return new OpenCodeChatStore({
    capabilities,
    client,
    directory,
    draft,
    scheduleNotification,
    sessionId,
  })
}

function fakeClient(options?: {
  promptResult?: Promise<{ data: undefined }>
  requests?: boolean
}) {
  const eventSubscribe = vi.fn(async () => ({ stream: emptyEvents() }))
  const messages = vi.fn(async () => ({ data: [] }))
  const permissionReply = vi.fn(async () => ({ data: true }))
  const questionReply = vi.fn(async () => ({ data: true }))
  const promptAsync = vi.fn(
    async () => options?.promptResult ?? Promise.resolve({ data: undefined }),
  )
  const value = {
    event: { subscribe: eventSubscribe },
    permission: {
      list: vi.fn(async () => ({
        data: options?.requests
          ? [
              {
                always: ['project'],
                id: 'permission',
                metadata: {},
                patterns: ['/workspace/app.tsx'],
                permission: 'write',
                sessionID: sessionId,
              },
            ]
          : [],
      })),
      reply: permissionReply,
    },
    question: {
      list: vi.fn(async () => ({
        data: options?.requests
          ? [
              {
                id: 'question',
                questions: [
                  {
                    custom: false,
                    header: 'Framework',
                    multiple: false,
                    options: [
                      { description: 'Keep StyleX.', label: 'StyleX' },
                    ],
                    question: 'Which framework?',
                  },
                ],
                sessionID: sessionId,
              },
            ]
          : [],
      })),
      reject: vi.fn(async () => ({ data: true })),
      reply: questionReply,
    },
    session: {
      abort: vi.fn(async () => ({ data: true })),
      messages,
      promptAsync,
      shell: vi.fn(async () => ({ data: {} })),
      status: vi.fn(async () => ({ data: { [sessionId]: { type: 'idle' } } })),
      todo: vi.fn(async () => ({ data: [] })),
    },
  } as unknown as OpencodeClient

  return {
    eventSubscribe,
    messages,
    permissionReply,
    promptAsync,
    questionReply,
    value,
  }
}

function scheduledFrame() {
  let callbacks: Array<() => void> = []
  return {
    flush() {
      const pending = callbacks
      callbacks = []
      for (const callback of pending) callback()
    },
    pending: () => callbacks.length,
    schedule(callback: () => void) {
      callbacks.push(callback)
      return () => {
        callbacks = callbacks.filter((candidate) => candidate !== callback)
      }
    },
  }
}

async function* emptyEvents(): AsyncGenerator<Event> {}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
