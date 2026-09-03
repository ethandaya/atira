import type {
  Event,
  Message,
  OpencodeClient,
  Part,
  Session,
} from '@opencode-ai/sdk/v2'
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

  it('queues locally, then sends explicitly through the normal prompt path', async () => {
    const frame = scheduledFrame()
    const pending = deferred<{ data: undefined }>()
    const client = fakeClient({ promptResult: pending.promise })
    const store = createStore(client.value, frame.schedule)
    await store.initialize()
    frame.flush()

    await store.submit(draft, 'queue')
    const queued = store.getSnapshot()

    expect(queued.queue).toEqual([
      expect.objectContaining({ draft, state: 'queued' }),
    ])
    expect(client.promptAsync).not.toHaveBeenCalled()

    const submitting = store.retryQueued(queued.queue[0]!)
    const optimistic = store.getSnapshot()
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

  it('rolls back an unconfirmed optimistic row and restores its draft', async () => {
    const client = fakeClient({
      promptResult: Promise.reject(new Error('Connection lost')),
    })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    await expect(store.submit(draft, 'send')).rejects.toThrow('Connection lost')

    expect(store.getSnapshot()).toMatchObject({
      composer: {
        attachments: draft.attachments,
        segments: draft.segments,
        selection: draft.selection,
      },
      submissionError: { kind: 'mutation' },
      turns: [],
    })
    store.dispose()
  })

  it('does not overwrite a newer draft when an older submission fails', async () => {
    const pending = deferred<{ data: undefined }>()
    const client = fakeClient({ promptResult: pending.promise })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    const submission = store.submit(draft, 'send')
    const newerDraft: ComposerDraft = {
      ...draft,
      revision: 2,
      segments: [{ id: 'new-text', text: 'A newer thought.', type: 'text' }],
      selection: {
        anchor: { offset: 16, segmentId: 'new-text' },
        focus: { offset: 16, segmentId: 'new-text' },
      },
    }
    store.updateDraft(newerDraft)
    pending.reject(new Error('Connection lost'))

    await expect(submission).rejects.toThrow('Connection lost')
    expect(store.getSnapshot().composer).toBe(newerDraft)
    store.dispose()
  })

  it('keeps an independently confirmed part when submission later fails', async () => {
    const pending = deferred<{ data: undefined }>()
    const events = eventChannel()
    const client = fakeClient({ eventStream: events.stream, promptResult: pending.promise })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    const submission = store.submit(draft, 'send')
    const sent = client.promptAsync.mock.calls[0]?.[0] as
      | { messageID?: string }
      | undefined
    const messageId = sent?.messageID
    expect(messageId).toBeTypeOf('string')
    events.push({
      id: 'confirm-optimistic-part',
      properties: {
        part: {
          id: `${messageId}:part:0`,
          messageID: messageId!,
          sessionID: sessionId,
          text: 'Inspect this.',
          type: 'text',
        },
        sessionID: sessionId,
        time: Date.now(),
      },
      type: 'message.part.updated',
    })
    await vi.waitFor(() => {
      expect(store.getSnapshot().turns[0]?.user.parts).toHaveLength(1)
    })
    pending.reject(new Error('Connection lost'))

    await expect(submission).rejects.toThrow('Connection lost')
    expect(store.getSnapshot().turns[0]?.user).toMatchObject({
      delivery: { status: 'failed' },
      parts: [expect.objectContaining({ markdown: 'Inspect this.' })],
    })
    events.close()
    store.dispose()
  })

  it('deduplicates a permission mutation and ignores its stale failure', async () => {
    const pending = deferred<{ data: true }>()
    const events = eventChannel()
    const client = fakeClient({
      eventStream: events.stream,
      permissionResult: pending.promise,
      requests: true,
    })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()
    const decision = {
      decision: 'always' as const,
      originSessionId: sessionId,
      requestId: 'permission',
    }

    const first = store.decidePermission(decision)
    await store.decidePermission(decision)
    expect(client.permissionReply).toHaveBeenCalledOnce()

    events.push({
      id: 'permission-resolved-by-event',
      properties: {
        reply: 'once',
        requestID: 'permission',
        sessionID: sessionId,
      },
      type: 'permission.v2.replied',
    })
    await vi.waitFor(() => {
      expect(
        store
          .getSnapshot()
          .requests.find((request) => request.id === 'permission')?.state,
      ).toEqual({
        decision: 'once',
        status: 'resolved',
      })
    })
    pending.reject(new Error('Late mutation failure'))

    await expect(first).rejects.toThrow('Late mutation failure')
    expect(
      store
        .getSnapshot()
        .requests.find((request) => request.id === 'permission')?.state,
    ).toEqual({ decision: 'once', status: 'resolved' })
    events.close()
    store.dispose()
  })

  it('loads and routes requests from descendant sessions with their origin', async () => {
    const child = childSession('child', sessionId, 'Research agent')
    const client = fakeClient({
      children: [child],
      permissionRequests: [
        {
          always: [],
          id: 'child-permission',
          metadata: {},
          patterns: ['https://example.com'],
          permission: 'webfetch',
          sessionID: child.id,
        },
      ],
    })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    const request = store.getSnapshot().requests[0]
    expect(request?.origin).toEqual({
      label: 'Research agent',
      parentSessionId: sessionId,
      sessionId: child.id,
    })
    await store.decidePermission({
      decision: 'once',
      originSessionId: child.id,
      requestId: 'child-permission',
    })
    expect(client.permissionReply).toHaveBeenCalledWith(
      { directory, reply: 'once', requestID: 'child-permission' },
      { throwOnError: true },
    )
    store.dispose()
  })

  it('releases queued work on idle, but keeps it paused after stop', async () => {
    const events = eventChannel()
    const client = fakeClient({ eventStream: events.stream, status: 'busy' })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    await store.submit(draft, 'queue')
    events.push(sessionIdleEvent('release-queue'))
    await vi.waitFor(() => expect(client.promptAsync).toHaveBeenCalledOnce())
    expect(store.getSnapshot().queue).toEqual([])

    await store.submit(draft, 'queue')
    await store.stop('active-turn')
    events.push(sessionIdleEvent('paused-queue'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(client.promptAsync).toHaveBeenCalledOnce()
    expect(store.getSnapshot().queue).toHaveLength(1)

    await store.retryQueued(store.getSnapshot().queue[0]!)
    expect(client.promptAsync).toHaveBeenCalledTimes(2)
    events.close()
    store.dispose()
  })

  it('edits, removes, restores, and redoes controlled prompts', async () => {
    const initialMessage = userMessage('revert-turn')
    const initialPart = userTextPart(initialMessage, 'Restore this exact prompt.')
    const client = fakeClient({
      messages: [{ info: initialMessage, parts: [initialPart] }],
    })
    const store = createStore(client.value, scheduledFrame().schedule)
    await store.initialize()

    await store.submit(draft, 'queue')
    const queued = store.getSnapshot().queue[0]!
    store.editQueued(queued)
    expect(store.getSnapshot().composer.segments).toBe(draft.segments)
    expect(store.getSnapshot().queue).toEqual([])

    await store.submit(draft, 'queue')
    store.removeQueued(store.getSnapshot().queue[0]!)
    expect(store.getSnapshot().queue).toEqual([])

    await store.revert(initialMessage.id)
    const reverted = store.getSnapshot().revertedPrompt
    expect(reverted).toMatchObject({
      draft: {
        segments: [expect.objectContaining({ text: 'Restore this exact prompt.' })],
      },
      turnId: initialMessage.id,
    })
    await store.restoreReverted(reverted!)
    expect(store.getSnapshot().composer.segments[0]).toMatchObject({
      text: 'Restore this exact prompt.',
    })
    await store.redoReverted(reverted!)
    expect(client.unrevert).toHaveBeenCalledOnce()
    expect(store.getSnapshot().revertedPrompt).toBeUndefined()
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
  children?: readonly Session[]
  eventStream?: AsyncGenerator<Event>
  messages?: readonly { info: Message; parts: readonly Part[] }[]
  permissionRequests?: readonly {
    always: string[]
    id: string
    metadata: Record<string, unknown>
    patterns: string[]
    permission: string
    sessionID: string
  }[]
  permissionResult?: Promise<{ data: true }>
  promptResult?: Promise<{ data: undefined }>
  requests?: boolean
  status?: 'busy' | 'idle'
}) {
  const eventSubscribe = vi.fn(async () => ({
    stream: options?.eventStream ?? emptyEvents(),
  }))
  const messages = vi.fn(async () => ({ data: options?.messages ?? [] }))
  const permissionReply = vi.fn(
    async () => options?.permissionResult ?? Promise.resolve({ data: true as const }),
  )
  const questionReply = vi.fn(async () => ({ data: true }))
  const promptAsync = vi.fn(
    async (_input?: unknown, _requestOptions?: unknown) =>
      options?.promptResult ?? Promise.resolve({ data: undefined }),
  )
  const value = {
    event: { subscribe: eventSubscribe },
    permission: {
      list: vi.fn(async () => ({
        data:
          options?.permissionRequests ??
          (options?.requests
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
            : []),
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
      children: vi.fn(async ({ sessionID }: { sessionID: string }) => ({
        data:
          sessionID === sessionId
            ? (options?.children ?? []).filter(
                (session) => session.parentID === sessionId,
              )
            : (options?.children ?? []).filter(
                (session) => session.parentID === sessionID,
              ),
      })),
      messages,
      promptAsync,
      revert: vi.fn(async () => ({ data: {} })),
      shell: vi.fn(async () => ({ data: {} })),
      status: vi.fn(async () => ({
        data: { [sessionId]: { type: options?.status ?? 'idle' } },
      })),
      todo: vi.fn(async () => ({ data: [] })),
      unrevert: vi.fn(async () => ({ data: {} })),
    },
  } as unknown as OpencodeClient

  return {
    eventSubscribe,
    messages,
    permissionReply,
    promptAsync,
    questionReply,
    unrevert: value.session.unrevert as ReturnType<typeof vi.fn>,
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
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Value>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, reject, resolve }
}

function eventChannel() {
  const queued: Event[] = []
  let closed = false
  let wake: (() => void) | undefined

  async function* consume(): AsyncGenerator<Event> {
    while (!closed) {
      if (queued.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }
      while (queued.length > 0) yield queued.shift()!
    }
  }

  return {
    close() {
      closed = true
      wake?.()
    },
    push(event: Event) {
      queued.push(event)
      wake?.()
      wake = undefined
    },
    stream: consume(),
  }
}

function sessionIdleEvent(id: string): Event {
  return {
    id,
    properties: { sessionID: sessionId },
    type: 'session.idle',
  }
}

function userMessage(id: string): Extract<Message, { role: 'user' }> {
  return {
    agent: 'build',
    id,
    model: { modelID: 'model', providerID: 'provider' },
    role: 'user',
    sessionID: sessionId,
    time: { created: 1_000 },
  }
}

function userTextPart(
  message: Extract<Message, { role: 'user' }>,
  text: string,
): Extract<Part, { type: 'text' }> {
  return {
    id: `${message.id}:text`,
    messageID: message.id,
    sessionID: sessionId,
    text,
    type: 'text',
  }
}

function childSession(id: string, parentID: string, title: string): Session {
  return {
    directory,
    id,
    parentID,
    projectID: 'project',
    slug: id,
    time: { created: 1, updated: 1 },
    title,
    version: '1',
  }
}
