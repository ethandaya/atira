import type {
  Event,
  Message,
  OpencodeClient,
  Part,
  PermissionRequest,
  QuestionRequest,
  Todo,
} from '@opencode-ai/sdk/v2'
import type {
  ChatCapabilities,
  ChatError,
  ChatRequest,
  ChatSnapshot,
  ChatStore,
  ComposerDraft,
  PermissionDecision,
  QuestionRequestView,
  QuestionResponse,
  QueuedPrompt,
  RevertedPrompt,
  SubmitIntent,
} from '@pretty-amped/foundations/chat'
import { composerDraftText } from '@pretty-amped/foundations/chat-invariants'

import { projectOpenCodeState } from './project'
import {
  addOpenCodeOptimisticMessage,
  createOpenCodeAdapterState,
  failOpenCodeMessage,
  mapOpenCodeError,
  mergeOpenCodeMessagePage,
  reduceOpenCodeEvent,
  type OpenCodeAdapterState,
} from './state'

type ScheduleNotification = (callback: () => void) => () => void

export type OpenCodeChatStoreOptions = Readonly<{
  capabilities: ChatCapabilities
  client: OpencodeClient
  directory: string
  draft: ComposerDraft
  pageSize?: number
  scheduleNotification?: ScheduleNotification
  sessionId: string
}>

export class OpenCodeChatStore implements ChatStore {
  readonly #abort = new AbortController()
  readonly #capabilities: ChatCapabilities
  readonly #client: OpencodeClient
  readonly #directory: string
  readonly #listeners = new Set<() => void>()
  readonly #pageSize: number
  readonly #scheduleNotification: ScheduleNotification
  readonly #sessionId: string
  #adapter: OpenCodeAdapterState
  #cancelNotification: (() => void) | undefined
  #composer: ComposerDraft
  #connection: ChatSnapshot['connection'] = {
    attempt: 0,
    status: 'reconnecting',
  }
  #disposed = false
  #eventTask?: Promise<void>
  #history: ChatSnapshot['history'] = { status: 'initial-loading' }
  #initializePromise?: Promise<void>
  #queue: readonly QueuedPrompt[] = []
  #snapshot: ChatSnapshot

  constructor(options: OpenCodeChatStoreOptions) {
    this.#adapter = createOpenCodeAdapterState(options.sessionId)
    this.#capabilities = options.capabilities
    this.#client = options.client
    this.#composer = options.draft
    this.#directory = options.directory
    this.#pageSize = options.pageSize ?? 50
    this.#scheduleNotification =
      options.scheduleNotification ?? scheduleOnAnimationFrame
    this.#sessionId = options.sessionId
    this.#snapshot = this.#projectSnapshot()
  }

  getSnapshot = () => this.#snapshot

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async initialize() {
    if (this.#initializePromise) return this.#initializePromise
    this.#initializePromise = this.#initialize()
    return this.#initializePromise
  }

  dispose() {
    if (this.#disposed) return
    this.#disposed = true
    this.#abort.abort()
    this.#cancelNotification?.()
    this.#cancelNotification = undefined
    this.#listeners.clear()
  }

  async loadPrevious() {
    if (
      this.#history.status === 'loading-previous' ||
      this.#history.status === 'complete'
    ) {
      return
    }

    const oldest = this.#adapter.messageOrder[0]
    if (!oldest) {
      this.#history = { status: 'complete' }
      this.#commit()
      return
    }

    this.#history = { status: 'loading-previous' }
    this.#commit()
    try {
      const response = await this.#client.session.messages(
        {
          before: oldest,
          directory: this.#directory,
          limit: this.#pageSize,
          sessionID: this.#sessionId,
        },
        { throwOnError: true },
      )
      const page = response.data ?? []
      this.#adapter = mergeOpenCodeMessagePage(this.#adapter, page)
      this.#history =
        page.length < this.#pageSize
          ? { status: 'complete' }
          : { hasPrevious: true, status: 'ready' }
    } catch (error) {
      this.#history = {
        canRetry: true,
        error: mutationError(error, 'Earlier messages could not be loaded.'),
        status: 'failed',
      }
    }
    this.#commit()
  }

  async decidePermission(input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }) {
    if (!this.#hasRequest(input.requestId, input.originSessionId)) return
    this.#setPermissionRequest(input.requestId, {
      decision: input.decision,
      status: 'submitting',
    })
    this.#commit()

    try {
      await this.#client.permission.reply(
        {
          directory: this.#directory,
          reply: input.decision,
          requestID: input.requestId,
        },
        { throwOnError: true },
      )
      this.#setPermissionRequest(input.requestId, {
        decision: input.decision,
        status: 'resolved',
      })
    } catch (error) {
      this.#setPermissionRequest(input.requestId, {
        decision: input.decision,
        error: mutationError(error, 'The permission decision was not sent.'),
        status: 'failed',
      })
      throw error
    } finally {
      this.#commit()
    }
  }

  async answerQuestion(input: {
    originSessionId: string
    requestId: string
    response: QuestionResponse
  }) {
    const request = this.#questionRequest(input.requestId, input.originSessionId)
    if (!request) return
    const decision = { response: input.response, type: 'answer' as const }
    this.#setQuestionRequest(input.requestId, {
      decision,
      status: 'submitting',
    })
    this.#commit()

    try {
      await this.#client.question.reply(
        {
          answers: openCodeQuestionAnswers(request, input.response),
          directory: this.#directory,
          requestID: input.requestId,
        },
        { throwOnError: true },
      )
      this.#setQuestionRequest(input.requestId, {
        decision,
        status: 'resolved',
      })
    } catch (error) {
      this.#setQuestionRequest(input.requestId, {
        decision,
        error: mutationError(error, 'The answer was not sent.'),
        status: 'failed',
      })
      throw error
    } finally {
      this.#commit()
    }
  }

  async rejectQuestion(input: {
    originSessionId: string
    requestId: string
  }) {
    if (!this.#questionRequest(input.requestId, input.originSessionId)) return
    const decision = { type: 'reject' as const }
    this.#setQuestionRequest(input.requestId, {
      decision,
      status: 'submitting',
    })
    this.#commit()

    try {
      await this.#client.question.reject(
        { directory: this.#directory, requestID: input.requestId },
        { throwOnError: true },
      )
      this.#setQuestionRequest(input.requestId, {
        decision,
        status: 'resolved',
      })
    } catch (error) {
      this.#setQuestionRequest(input.requestId, {
        decision,
        error: mutationError(error, 'The question could not be dismissed.'),
        status: 'failed',
      })
      throw error
    } finally {
      this.#commit()
    }
  }

  async stop(_turnId: string) {
    await this.#client.session.abort(
      { directory: this.#directory, sessionID: this.#sessionId },
      { throwOnError: true },
    )
  }

  async submit(draft: ComposerDraft, intent: SubmitIntent) {
    const messageId = createId('message')
    const clientId = createId('client')
    const now = Date.now()
    const model = draft.model ?? this.#capabilities.models[0]
    const agent = draft.agent ?? this.#capabilities.agents[0]
    const parts = openCodePromptParts(draft, messageId, this.#sessionId)
    const message: Extract<Message, { role: 'user' }> = {
      agent: agent?.id ?? 'build',
      id: messageId,
      model: {
        modelID: model?.modelId ?? '',
        providerID: model?.providerId ?? '',
      },
      role: 'user',
      sessionID: this.#sessionId,
      time: { created: now },
    }

    this.#adapter = addOpenCodeOptimisticMessage(this.#adapter, {
      clientId,
      info: message,
      parts,
    })
    this.#adapter = {
      ...this.#adapter,
      sessionStatus: { type: 'busy' },
    }
    this.#composer = emptyDraft(draft)
    if (intent === 'queue') {
      this.#queue = [...this.#queue, { draft, id: clientId, state: 'submitting' }]
    }
    this.#commit()

    try {
      if (draft.mode === 'shell') {
        await this.#client.session.shell(
          {
            ...(agent ? { agent: agent.id } : {}),
            command: composerDraftText(draft),
            directory: this.#directory,
            messageID: messageId,
            ...(model
              ? {
                  model: {
                    modelID: model.modelId,
                    providerID: model.providerId,
                  },
                }
              : {}),
            sessionID: this.#sessionId,
          },
          { throwOnError: true },
        )
      } else {
        await this.#client.session.promptAsync(
          {
            ...(agent ? { agent: agent.id } : {}),
            directory: this.#directory,
            messageID: messageId,
            ...(model
              ? {
                  model: {
                    modelID: model.modelId,
                    providerID: model.providerId,
                  },
                }
              : {}),
            parts: openCodePromptInputParts(draft),
            sessionID: this.#sessionId,
            ...(draft.variant ? { variant: draft.variant } : {}),
          },
          { throwOnError: true },
        )
      }
      this.#queue = this.#queue.filter((item) => item.id !== clientId)
    } catch (error) {
      const failure = mutationError(error, 'The message was not sent.')
      this.#adapter = failOpenCodeMessage(this.#adapter, messageId, failure)
      this.#queue = this.#queue.map((item) =>
        item.id === clientId
          ? { draft: item.draft, error: failure, id: item.id, state: 'failed' }
          : item,
      )
      throw error
    } finally {
      this.#commit()
    }
  }

  updateDraft(draft: ComposerDraft) {
    this.#composer = draft
    this.#commit()
  }

  updateQueue(queue: readonly QueuedPrompt[]) {
    this.#queue = queue
    this.#commit()
  }

  async #initialize() {
    try {
      const subscription = await this.#client.event.subscribe(
        { directory: this.#directory },
        { signal: this.#abort.signal },
      )
      this.#eventTask = this.#consumeEvents(subscription.stream)

      const [messages, todos, statuses, permissions, questions] = await Promise.all([
        this.#client.session.messages(
          {
            directory: this.#directory,
            limit: this.#pageSize,
            sessionID: this.#sessionId,
          },
          { throwOnError: true },
        ),
        this.#client.session.todo(
          { directory: this.#directory, sessionID: this.#sessionId },
          { throwOnError: true },
        ),
        this.#client.session.status(
          { directory: this.#directory },
          { throwOnError: true },
        ),
        this.#client.permission.list(
          { directory: this.#directory },
          { throwOnError: true },
        ),
        this.#client.question.list(
          { directory: this.#directory },
          { throwOnError: true },
        ),
      ])

      const page = messages.data ?? []
      this.#adapter = mergeOpenCodeMessagePage(this.#adapter, page)
      this.#bootstrapTodos(todos.data ?? [])
      this.#bootstrapStatus(statuses.data?.[this.#sessionId])
      this.#bootstrapRequests(permissions.data ?? [], questions.data ?? [])
      this.#connection = { status: 'connected' }
      this.#history =
        page.length < this.#pageSize
          ? { status: 'complete' }
          : { hasPrevious: true, status: 'ready' }
      this.#commit()
    } catch (error) {
      if (this.#abort.signal.aborted) return
      const failure = mutationError(error, 'The OpenCode session is unavailable.')
      this.#connection = { error: failure, status: 'offline' }
      this.#history = { canRetry: true, error: failure, status: 'failed' }
      this.#commit()
      throw error
    }
  }

  async #consumeEvents(stream: AsyncGenerator<Event>) {
    try {
      for await (const event of stream) {
        if (this.#disposed) return
        this.#adapter = reduceOpenCodeEvent(this.#adapter, event)
        this.#connection = { status: 'connected' }
        this.#commit()
      }
    } catch (error) {
      if (this.#abort.signal.aborted) return
      this.#connection = {
        error: mutationError(error, 'The OpenCode event stream disconnected.'),
        status: 'offline',
      }
      this.#commit()
    }
  }

  #bootstrapTodos(todos: readonly Todo[]) {
    this.#bootstrapTodoEvent(todos)
  }

  #bootstrapTodoEvent(todos: readonly { content: string; priority: string; status: string }[]) {
    this.#adapter = reduceOpenCodeEvent(this.#adapter, {
      id: `bootstrap:todos:${this.#sessionId}`,
      properties: { sessionID: this.#sessionId, todos: [...todos] },
      type: 'todo.updated',
    })
  }

  #bootstrapStatus(status: OpenCodeAdapterState['sessionStatus'] | undefined) {
    if (!status) return
    this.#adapter = reduceOpenCodeEvent(this.#adapter, {
      id: `bootstrap:status:${this.#sessionId}`,
      properties: { sessionID: this.#sessionId, status },
      type: 'session.status',
    })
  }

  #bootstrapRequests(
    permissions: readonly PermissionRequest[],
    questions: readonly QuestionRequest[],
  ) {
    for (const request of permissions) {
      this.#adapter = reduceOpenCodeEvent(this.#adapter, {
        id: `bootstrap:permission:${request.id}`,
        properties: {
          always: request.always,
          id: request.id,
          metadata: request.metadata,
          patterns: request.patterns,
          permission: request.permission,
          sessionID: request.sessionID,
          ...(request.tool ? { tool: request.tool } : {}),
        },
        type: 'permission.asked',
      })
    }
    for (const request of questions) {
      this.#adapter = reduceOpenCodeEvent(this.#adapter, {
        id: `bootstrap:question:${request.id}`,
        properties: {
          id: request.id,
          questions: request.questions,
          sessionID: request.sessionID,
          ...(request.tool ? { tool: request.tool } : {}),
        },
        type: 'question.asked',
      })
    }
  }

  #hasRequest(requestId: string, sessionId: string) {
    return this.#adapter.requests.some(
      (request) =>
        request.id === requestId && request.origin.sessionId === sessionId,
    )
  }

  #questionRequest(requestId: string, sessionId: string) {
    const request = this.#adapter.requests.find(
      (item) =>
        item.type === 'question' &&
        item.id === requestId &&
        item.origin.sessionId === sessionId,
    )
    return request?.type === 'question' ? request : undefined
  }

  #setPermissionRequest(
    requestId: string,
    state: Extract<ChatRequest, { type: 'permission' }>['state'],
  ) {
    this.#adapter = {
      ...this.#adapter,
      requests: this.#adapter.requests.map((request) =>
        request.type === 'permission' && request.id === requestId
          ? { ...request, state }
          : request,
      ),
    }
  }

  #setQuestionRequest(
    requestId: string,
    state: QuestionRequestView['state'],
  ) {
    this.#adapter = {
      ...this.#adapter,
      requests: this.#adapter.requests.map((request) =>
        request.type === 'question' && request.id === requestId
          ? { ...request, state }
          : request,
      ),
    }
  }

  #commit() {
    if (this.#disposed) return
    this.#snapshot = this.#projectSnapshot()
    if (this.#cancelNotification) return
    this.#cancelNotification = this.#scheduleNotification(() => {
      this.#cancelNotification = undefined
      for (const listener of this.#listeners) listener()
    })
  }

  #projectSnapshot(): ChatSnapshot {
    const projection = projectOpenCodeState(this.#adapter)
    const revertedPrompt = projectRevertedPrompt(this.#adapter)
    return {
      activity: projection.activity,
      capabilities: this.#capabilities,
      composer: this.#composer,
      connection: this.#connection,
      history: this.#history,
      queue: this.#queue,
      requests: this.#adapter.requests,
      ...(revertedPrompt ? { revertedPrompt } : {}),
      sessionId: this.#sessionId,
      ...(this.#adapter.todos ? { todos: this.#adapter.todos } : {}),
      turns: projection.turns,
    }
  }
}

function projectRevertedPrompt(
  state: OpenCodeAdapterState,
): RevertedPrompt | undefined {
  if (!state.revert) return undefined
  const record = state.messages[state.revert.messageID]
  if (record?.info.role !== 'user') return undefined
  const text = record.parts
    .filter((part): part is Extract<Part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
  const textId = `${record.info.id}:reverted-text`
  return {
    draft: {
      agent: { id: record.info.agent, label: humanize(record.info.agent) },
      attachments: [],
      mode: 'prompt',
      model: {
        label: record.info.model.modelID,
        modelId: record.info.model.modelID,
        providerId: record.info.model.providerID,
      },
      revision: 0,
      segments: [{ id: textId, text, type: 'text' }],
      selection: {
        anchor: { offset: text.length, segmentId: textId },
        focus: { offset: text.length, segmentId: textId },
      },
    },
    id: `${record.info.id}:reverted`,
    turnId: record.info.id,
  }
}

function openCodePromptParts(
  draft: ComposerDraft,
  messageId: string,
  sessionId: string,
): readonly Part[] {
  return openCodePromptInputParts(draft).map((part, index) => ({
    ...part,
    id: part.id ?? `${messageId}:part:${index}`,
    messageID: messageId,
    sessionID: sessionId,
  })) as readonly Part[]
}

function openCodePromptInputParts(draft: ComposerDraft) {
  const text = composerDraftText(draft)
  const parts: Array<
    | { id?: string; text: string; type: 'text' }
    | { filename?: string; id?: string; mime: string; type: 'file'; url: string }
  > = text ? [{ text, type: 'text' }] : []

  for (const item of draft.attachments) {
    if (item.state !== 'ready') continue
    parts.push({
      filename: item.attachment.name,
      id: item.attachment.id,
      mime: item.attachment.mediaType ?? 'application/octet-stream',
      type: 'file',
      url: item.sourceId,
    })
  }
  return parts
}

function openCodeQuestionAnswers(
  request: QuestionRequestView,
  response: QuestionResponse,
) {
  return request.questions.map((question) => {
    const answer = response.answers.find(
      (candidate) => candidate.questionId === question.id,
    )
    if (!answer) return []
    if (answer.type === 'text') return [answer.value]
    if (question.type === 'text') return []

    const selected = question.options
      .filter((option) => answer.optionIds.includes(option.id))
      .map((option) => option.label)
    return answer.customValue ? [...selected, answer.customValue] : selected
  })
}

function emptyDraft(draft: ComposerDraft): ComposerDraft {
  const id = createId('text')
  return {
    ...draft,
    attachments: [],
    revision: draft.revision + 1,
    segments: [{ id, text: '', type: 'text' }],
    selection: {
      anchor: { offset: 0, segmentId: id },
      focus: { offset: 0, segmentId: id },
    },
  }
}

function mutationError(error: unknown, fallback: string): ChatError {
  const mapped = mapOpenCodeError(error)
  return mapped.message === 'The OpenCode provider failed.'
    ? { ...mapped, kind: 'mutation', message: fallback }
    : { ...mapped, kind: 'mutation' }
}

function createId(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return `${prefix}:${id}`
}

function humanize(value: string) {
  const words = value.replace(/[._-]+/g, ' ').trim()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : value
}

function scheduleOnAnimationFrame(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(handle)
  }
  const handle = setTimeout(callback, 16)
  return () => clearTimeout(handle)
}
