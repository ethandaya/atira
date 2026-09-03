import type {
  Event,
  Message,
  OpencodeClient,
  Part,
  PermissionRequest,
  QuestionRequest,
  Session,
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
  QuestionDecision,
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
  mapOpenCodeError,
  mergeOpenCodeMessagePage,
  reduceOpenCodeEvent,
  rollbackOpenCodeOptimisticMessage,
  withOpenCodeSessionLineage,
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
  #dismissedRevertId: string | undefined
  #disposed = false
  #eventTask?: Promise<void>
  #failedSubmission:
    | Readonly<{
        draft: ComposerDraft
        error: ChatError
        intent: Exclude<SubmitIntent, 'queue'>
      }>
    | undefined
  #historyGeneration = 0
  #history: ChatSnapshot['history'] = { status: 'initial-loading' }
  #initializePromise?: Promise<void>
  #queue: readonly QueuedPrompt[] = []
  #queuePaused = false
  #queueSending = false
  #reconnectPromise: Promise<void> | undefined
  readonly #requestMutations = new Set<string>()
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
    this.#historyGeneration += 1
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
    const generation = ++this.#historyGeneration
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
      if (this.#disposed || generation !== this.#historyGeneration) return
      const page = response.data ?? []
      this.#adapter = mergeOpenCodeMessagePage(this.#adapter, page)
      this.#history =
        page.length < this.#pageSize
          ? { status: 'complete' }
          : { hasPrevious: true, status: 'ready' }
    } catch (error) {
      if (this.#disposed || generation !== this.#historyGeneration) return
      this.#history = {
        canRetry: true,
        error: mutationError(error, 'Earlier messages could not be loaded.'),
        status: 'failed',
      }
    }
    this.#commit()
  }

  async reconnect() {
    if (this.#disposed || this.#connection.status === 'connected') return
    return this.#beginReconnect(true)
  }

  async decidePermission(input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }) {
    const mutationKey = requestKey('permission', input)
    if (
      this.#requestMutations.has(mutationKey) ||
      !this.#hasActionableRequest('permission', input.requestId, input.originSessionId)
    ) {
      return
    }
    this.#requestMutations.add(mutationKey)
    this.#setPermissionRequest(input.requestId, input.originSessionId, {
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
      if (this.#permissionSubmissionMatches(input)) {
        this.#setPermissionRequest(input.requestId, input.originSessionId, {
          decision: input.decision,
          status: 'resolved',
        })
      }
    } catch (error) {
      if (this.#permissionSubmissionMatches(input)) {
        this.#setPermissionRequest(input.requestId, input.originSessionId, {
          decision: input.decision,
          error: mutationError(error, 'The permission decision was not sent.'),
          status: 'failed',
        })
      }
      throw error
    } finally {
      this.#requestMutations.delete(mutationKey)
      this.#commit()
    }
  }

  async answerQuestion(input: {
    originSessionId: string
    requestId: string
    response: QuestionResponse
  }) {
    const mutationKey = requestKey('question', input)
    if (this.#requestMutations.has(mutationKey)) return
    const request = this.#questionRequest(input.requestId, input.originSessionId)
    if (!request || !isActionableRequest(request)) return
    this.#requestMutations.add(mutationKey)
    const decision = { response: input.response, type: 'answer' as const }
    this.#setQuestionRequest(input.requestId, input.originSessionId, {
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
      if (this.#questionSubmissionMatches(input.requestId, input.originSessionId, decision)) {
        this.#setQuestionRequest(input.requestId, input.originSessionId, {
          decision,
          status: 'resolved',
        })
      }
    } catch (error) {
      if (this.#questionSubmissionMatches(input.requestId, input.originSessionId, decision)) {
        this.#setQuestionRequest(input.requestId, input.originSessionId, {
          decision,
          error: mutationError(error, 'The answer was not sent.'),
          status: 'failed',
        })
      }
      throw error
    } finally {
      this.#requestMutations.delete(mutationKey)
      this.#commit()
    }
  }

  async rejectQuestion(input: {
    originSessionId: string
    requestId: string
  }) {
    const mutationKey = requestKey('question', input)
    if (this.#requestMutations.has(mutationKey)) return
    const request = this.#questionRequest(input.requestId, input.originSessionId)
    if (!request || !isActionableRequest(request)) return
    this.#requestMutations.add(mutationKey)
    const decision = { type: 'reject' as const }
    this.#setQuestionRequest(input.requestId, input.originSessionId, {
      decision,
      status: 'submitting',
    })
    this.#commit()

    try {
      await this.#client.question.reject(
        { directory: this.#directory, requestID: input.requestId },
        { throwOnError: true },
      )
      if (this.#questionSubmissionMatches(input.requestId, input.originSessionId, decision)) {
        this.#setQuestionRequest(input.requestId, input.originSessionId, {
          decision,
          status: 'resolved',
        })
      }
    } catch (error) {
      if (this.#questionSubmissionMatches(input.requestId, input.originSessionId, decision)) {
        this.#setQuestionRequest(input.requestId, input.originSessionId, {
          decision,
          error: mutationError(error, 'The question could not be dismissed.'),
          status: 'failed',
        })
      }
      throw error
    } finally {
      this.#requestMutations.delete(mutationKey)
      this.#commit()
    }
  }

  async stop(_turnId: string) {
    this.#queuePaused = true
    await this.#client.session.abort(
      { directory: this.#directory, sessionID: this.#sessionId },
      { throwOnError: true },
    )
  }

  async submit(draft: ComposerDraft, intent: SubmitIntent) {
    if (intent === 'queue') {
      this.#queue = [
        ...this.#queue,
        { draft, id: createId('queue'), state: 'queued' },
      ]
      this.#composer = emptyDraft(draft)
      this.#commit()
      return
    }

    await this.#sendDraft(draft, intent)
  }

  dismissSubmissionError() {
    this.#failedSubmission = undefined
    this.#commit()
  }

  async retrySubmission() {
    const failed = this.#failedSubmission
    if (!failed) return
    this.#failedSubmission = undefined
    await this.#sendDraft(failed.draft, failed.intent)
  }

  editQueued(item: QueuedPrompt) {
    if (!this.#queue.some((candidate) => candidate.id === item.id)) return
    this.#queue = this.#queue.filter((candidate) => candidate.id !== item.id)
    this.#composer = {
      ...item.draft,
      revision: this.#composer.revision + 1,
    }
    this.#commit()
  }

  removeQueued(item: QueuedPrompt) {
    const next = this.#queue.filter((candidate) => candidate.id !== item.id)
    if (next.length === this.#queue.length) return
    this.#queue = next
    this.#commit()
  }

  async retryQueued(item: QueuedPrompt) {
    const queued = this.#queue.find((candidate) => candidate.id === item.id)
    if (!queued || queued.state === 'submitting') return
    await this.#releaseQueued(queued)
  }

  async revert(turnId: string) {
    if (!this.#adapter.messages[turnId]) return
    await this.#client.session.revert(
      {
        directory: this.#directory,
        messageID: turnId,
        sessionID: this.#sessionId,
      },
      { throwOnError: true },
    )
    this.#adapter = { ...this.#adapter, revert: { messageID: turnId } }
    this.#dismissedRevertId = undefined
    this.#commit()
  }

  async dismissReverted(reverted: RevertedPrompt) {
    if (this.#projectedRevert()?.id !== reverted.id) return
    this.#dismissedRevertId = reverted.id
    this.#commit()
  }

  async restoreReverted(reverted: RevertedPrompt) {
    if (this.#projectedRevert()?.id !== reverted.id) return
    this.#composer = {
      ...reverted.draft,
      revision: this.#composer.revision + 1,
    }
    this.#dismissedRevertId = reverted.id
    this.#commit()
  }

  async redoReverted(reverted: RevertedPrompt) {
    if (this.#projectedRevert()?.id !== reverted.id) return
    await this.#client.session.unrevert(
      { directory: this.#directory, sessionID: this.#sessionId },
      { throwOnError: true },
    )
    const { revert: _revert, ...adapter } = this.#adapter
    this.#adapter = adapter
    this.#dismissedRevertId = undefined
    this.#commit()
  }

  async #sendDraft(
    draft: ComposerDraft,
    intent: Exclude<SubmitIntent, 'queue'>,
    queuedId?: string,
  ) {
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
    const clearedDraft = emptyDraft(draft)
    if (!queuedId) this.#composer = clearedDraft
    this.#failedSubmission = undefined
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
      if (queuedId) {
        this.#queue = this.#queue.filter((item) => item.id !== queuedId)
      }
    } catch (error) {
      const failure = mutationError(error, 'The message was not sent.')
      this.#adapter = rollbackOpenCodeOptimisticMessage(
        this.#adapter,
        messageId,
        failure,
      )
      if (queuedId) {
        this.#queue = this.#queue.map((item) =>
          item.id === queuedId
            ? { draft: item.draft, error: failure, id: item.id, state: 'failed' }
            : item,
        )
      } else {
        this.#failedSubmission = { draft, error: failure, intent }
        if (this.#composer.revision === clearedDraft.revision) {
          this.#composer = {
            ...draft,
            revision: clearedDraft.revision + 1,
          }
        }
      }
      throw error
    } finally {
      this.#commit()
    }
  }

  async #releaseQueued(item: QueuedPrompt) {
    if (this.#queueSending) return
    this.#queueSending = true
    this.#queuePaused = false
    this.#queue = this.#queue.map((candidate) =>
      candidate.id === item.id
        ? { draft: candidate.draft, id: candidate.id, state: 'submitting' }
        : candidate,
    )
    this.#commit()
    try {
      await this.#sendDraft(item.draft, 'send', item.id)
    } finally {
      this.#queueSending = false
      this.#maybeReleaseQueue()
    }
  }

  #maybeReleaseQueue() {
    if (
      this.#queueSending ||
      this.#queuePaused ||
      this.#adapter.sessionStatus.type !== 'idle' ||
      this.#adapter.requests.some(isActionableRequest)
    ) {
      return
    }
    const next = this.#queue.find((item) => item.state === 'queued')
    if (next) void this.#releaseQueued(next).catch(() => undefined)
  }

  updateDraft(draft: ComposerDraft) {
    this.#composer = draft
    this.#failedSubmission = undefined
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

      const [messages, todos, statuses, lineage, permissions, questions] = await Promise.all([
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
        loadSessionLineage(this.#client, this.#directory, this.#sessionId),
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
      this.#adapter = withOpenCodeSessionLineage(this.#adapter, lineage)
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
      this.#maybeReleaseQueue()
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
        this.#maybeReleaseQueue()
      }
    } catch (error) {
      if (this.#abort.signal.aborted) return
      this.#connection = {
        error: mutationError(error, 'The OpenCode event stream disconnected.'),
        status: 'offline',
      }
      this.#commit()
      void this.#beginReconnect(false).catch(() => undefined)
    }
  }

  #beginReconnect(immediate: boolean) {
    if (this.#reconnectPromise) return this.#reconnectPromise

    const reconnect = async () => {
      let attempt = 0
      let lastError: unknown
      while (!this.#disposed) {
        attempt += 1
        this.#connection = { attempt, status: 'reconnecting' }
        this.#commit()
        if (!immediate || attempt > 1) {
          await waitForReconnect(Math.min(4_000, 250 * 2 ** (attempt - 1)), this.#abort.signal)
        }
        if (this.#disposed) return

        try {
          const subscription = await this.#client.event.subscribe(
            { directory: this.#directory },
            { signal: this.#abort.signal },
          )
          this.#connection = { status: 'connected' }
          this.#commit()
          this.#eventTask = this.#consumeEvents(subscription.stream)
          return
        } catch (error) {
          if (this.#abort.signal.aborted) return
          lastError = error
          this.#connection = {
            error: mutationError(error, 'The OpenCode event stream disconnected.'),
            status: 'offline',
          }
          this.#commit()
        }
      }
      if (lastError) throw lastError
    }

    this.#reconnectPromise = reconnect().finally(() => {
      this.#reconnectPromise = undefined
    })
    return this.#reconnectPromise
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

  #hasActionableRequest(
    type: ChatRequest['type'],
    requestId: string,
    sessionId: string,
  ) {
    const request = this.#adapter.requests.find(
      (request) =>
        request.type === type &&
        request.id === requestId &&
        request.origin.sessionId === sessionId,
    )
    return request ? isActionableRequest(request) : false
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
    sessionId: string,
    state: Extract<ChatRequest, { type: 'permission' }>['state'],
  ) {
    this.#adapter = {
      ...this.#adapter,
      requests: this.#adapter.requests.map((request) =>
        request.type === 'permission' &&
        request.id === requestId &&
        request.origin.sessionId === sessionId
          ? { ...request, state }
          : request,
      ),
    }
  }

  #setQuestionRequest(
    requestId: string,
    sessionId: string,
    state: QuestionRequestView['state'],
  ) {
    this.#adapter = {
      ...this.#adapter,
      requests: this.#adapter.requests.map((request) =>
        request.type === 'question' &&
        request.id === requestId &&
        request.origin.sessionId === sessionId
          ? { ...request, state }
          : request,
      ),
    }
  }

  #permissionSubmissionMatches(input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }) {
    const request = this.#adapter.requests.find(
      (candidate) =>
        candidate.type === 'permission' &&
        candidate.id === input.requestId &&
        candidate.origin.sessionId === input.originSessionId,
    )
    return (
      request?.state.status === 'submitting' &&
      request.state.decision === input.decision
    )
  }

  #questionSubmissionMatches(
    requestId: string,
    sessionId: string,
    decision: QuestionDecision,
  ) {
    const request = this.#questionRequest(requestId, sessionId)
    return (
      request?.state.status === 'submitting' &&
      request.state.decision === decision
    )
  }

  #projectedRevert() {
    return projectRevertedPrompt(this.#adapter)
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
    const projectedRevert = this.#projectedRevert()
    const revertedPrompt =
      projectedRevert?.id === this.#dismissedRevertId
        ? undefined
        : projectedRevert
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
      ...(this.#failedSubmission
        ? { submissionError: this.#failedSubmission.error }
        : {}),
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

function requestKey(
  type: ChatRequest['type'],
  input: { originSessionId: string; requestId: string },
) {
  return `${type}:${input.originSessionId}:${input.requestId}`
}

function isActionableRequest(request: ChatRequest) {
  return request.state.status === 'pending' || request.state.status === 'failed'
}

function waitForReconnect(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const handle = setTimeout(done, duration)
    signal.addEventListener('abort', done, { once: true })

    function done() {
      clearTimeout(handle)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}

async function loadSessionLineage(
  client: OpencodeClient,
  directory: string,
  rootSessionId: string,
) {
  const sessions: Session[] = []
  const pending = [rootSessionId]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const parentId = pending.shift()
    if (!parentId || visited.has(parentId)) continue
    visited.add(parentId)
    const response = await client.session.children(
      { directory, sessionID: parentId },
      { throwOnError: true },
    )
    for (const child of response.data ?? []) {
      sessions.push(child)
      pending.push(child.id)
    }
  }

  return sessions
}
