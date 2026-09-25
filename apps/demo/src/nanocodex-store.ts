import type {
  ChatCapabilities,
  ChatError,
  ChatMessage,
  ChatSnapshot,
  ChatStore,
  ChatTurn,
  ComposerDraft,
  PermissionDecision,
  QuestionResponse,
  QueuedPrompt,
  RevertedPrompt,
  SubmitIntent,
  ToolPart,
} from '@pretty-amped/foundations/chat'
import { composerDraftText } from '@pretty-amped/foundations/chat-invariants'
import {
  runtimeResponseSchema,
  savedHistorySchema,
  streamEventSchema,
  type StreamEvent,
} from '../chat-contract.mjs'

export type RuntimeState =
  | { status: 'loading' }
  | {
      model: string
      runtime: string
      status: 'ready'
      retryTurns?: boolean
      models?: ChatCapabilities['models']
    }
  | { message: string; status: 'unavailable' }

const unavailableCapabilities: ChatCapabilities = {
  agents: [],
  busySubmission: [],
  canAttach: false,
  canStop: false,
  canSubmit: false,
  canUseShell: false,
  models: [],
  permissionDecisions: [],
  referenceTypes: [],
  variants: [],
}

type SavedConversation = {
  id: string
  title: string
  composer: ComposerDraft
  turns: readonly ChatTurn[]
  hasContext: boolean
}

type JsonDefined<T> = T extends readonly (infer Item)[]
  ? JsonDefined<Item>[]
  : T extends object
    ? {
        [Key in keyof T as undefined extends T[Key] ? never : Key]: JsonDefined<
          T[Key]
        >
      } & {
        [
          Key in keyof T as undefined extends T[Key] ? Key : never
        ]?: JsonDefined<Exclude<T[Key], undefined>>
      }
    : T
type ParsedSavedHistory = ReturnType<typeof savedHistorySchema.parse>
type SavedHistoryContract = {
  activeId: string
  conversations: SavedConversation[]
}
const savedHistoryTypeAgreement: JsonDefined<ParsedSavedHistory> extends SavedHistoryContract
  ? true
  : never = true

const conversationStorageKey = 'pretty-amped:conversations:v1'

export class NanocodexChatStore implements ChatStore {
  readonly #listeners = new Set<() => void>()
  #runtimeController: AbortController | undefined
  #turnController: AbortController | undefined
  #cancelNotification: (() => void) | undefined
  #disposed = false
  #failedDraft: ComposerDraft | undefined
  #runtime: RuntimeState = { status: 'loading' }
  #storage: Pick<Storage, 'getItem' | 'setItem'> | undefined
  #conversations: SavedConversation[] = []
  #hasContext = false
  #saveTimer: ReturnType<typeof setTimeout> | undefined
  #snapshot: ChatSnapshot = {
    activity: { status: 'idle' },
    capabilities: unavailableCapabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { status: 'complete' },
    queue: [],
    requests: [],
    sessionId: crypto.randomUUID(),
    turns: [],
  }

  constructor(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try {
      this.#storage =
        storage ??
        (typeof window === 'undefined' ? undefined : window.sessionStorage)
      const saved = this.#storage?.getItem(conversationStorageKey)
      if (saved) {
        // JSON cannot contain explicit undefined values; schema-checked optional
        // fields therefore satisfy the library's exact optional property types.
        const parsed = savedHistorySchema.parse(JSON.parse(saved))
        // JSON cannot represent explicit undefined, and the compile-time agreement
        // above checks the schema's recursively defined shape against ChatStore.
        const data = parsed as JsonDefined<typeof parsed>
        void savedHistoryTypeAgreement
        this.#conversations = data.conversations
        const current = this.#conversations.find(
          (item) => item.id === data.activeId,
        )
        if (current) this.#restore(current)
      }
    } catch {
      this.#snapshot = {
        ...this.#snapshot,
        submissionError: chatError(
          'Saved conversations could not be restored. Browser session storage may be unavailable.',
          false,
        ),
      }
    }
    this.#remember()
  }

  getSnapshot = () => this.#snapshot
  getRuntimeSnapshot = () => this.#runtime
  getConversations = () => this.#conversations

  newConversation() {
    if (
      this.#snapshot.activity.status !== 'idle' ||
      this.#runtime.status === 'loading'
    )
      return
    if (
      this.#snapshot.turns.length === 0 &&
      !composerDraftText(this.#snapshot.composer).trim()
    )
      return
    this.#remember()
    this.#hasContext = false
    this.#failedDraft = undefined
    const { submissionError: _, ...snapshot } = this.#snapshot
    this.#snapshot = {
      ...snapshot,
      sessionId: crypto.randomUUID(),
      turns: [],
      composer: {
        ...createDraft(),
        ...(snapshot.composer.model ? { model: snapshot.composer.model } : {}),
      },
    }
    this.persist()
    this.#commit()
  }

  selectConversation(id: string) {
    if (
      this.#snapshot.activity.status !== 'idle' ||
      this.#runtime.status === 'loading'
    )
      return
    this.#remember()
    const conversation = this.#conversations.find((item) => item.id === id)
    if (!conversation || id === this.#snapshot.sessionId) return
    this.#restore(conversation)
    this.persist()
    this.#commit()
  }

  #restore(conversation: SavedConversation) {
    this.#hasContext = conversation.hasContext
    this.#failedDraft = undefined
    const { submissionError: _, ...snapshot } = this.#snapshot
    this.#snapshot = {
      ...snapshot,
      sessionId: conversation.id,
      composer: conversation.composer,
      turns: conversation.turns,
    }
  }

  #remember() {
    const { sessionId, composer, turns } = this.#snapshot
    const title = turns[0]?.user.parts.find((part) => part.type === 'text')
    const current = {
      id: sessionId,
      composer,
      turns,
      hasContext: this.#hasContext,
      title:
        title?.type === 'text'
          ? title.markdown.slice(0, 64)
          : composerDraftText(composer).trim().slice(0, 64) ||
            'New conversation',
    }
    const index = this.#conversations.findIndex((item) => item.id === sessionId)
    this.#conversations =
      index < 0
        ? [...this.#conversations, current]
        : this.#conversations.map((item, position) =>
            position === index ? current : item,
          )
  }

  persist = () => {
    clearTimeout(this.#saveTimer)
    this.#remember()
    try {
      this.#storage?.setItem(
        conversationStorageKey,
        JSON.stringify({
          activeId: this.#snapshot.sessionId,
          conversations: this.#conversations,
        }),
      )
    } catch {
      this.#snapshot = {
        ...this.#snapshot,
        submissionError: chatError(
          'Conversation history could not be saved. Keep this tab open; browser session storage may be full or blocked.',
          false,
        ),
      }
    }
  }

  #conversationHeaders() {
    return { 'X-Conversation-Id': this.#snapshot.sessionId }
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async initialize() {
    this.#disposed = false
    this.#runtimeController?.abort()
    const controller = new AbortController()
    this.#runtimeController = controller

    try {
      const response = await fetch('/api/runtime', {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error()
      const result = runtimeResponseSchema.safeParse(await response.json())
      controller.signal.throwIfAborted()
      if (!result.success) throw new Error()
      const body = result.data

      this.#runtime = body.available
        ? {
            model: body.model,
            runtime: body.runtime,
            status: 'ready',
            retryTurns: body.retryTurns,
            models: body.models,
          }
        : {
            message:
              body.message ??
              'Sign in with ChatGPT or set OPENAI_API_KEY on the server.',
            status: 'unavailable',
          }
    } catch {
      if (controller.signal.aborted) return
      this.#runtime = {
        message: 'The local model runtime could not be reached.',
        status: 'unavailable',
      }
    } finally {
      if (this.#runtimeController === controller)
        this.#runtimeController = undefined
    }

    this.#snapshot = {
      ...this.#snapshot,
      capabilities: capabilities(
        this.#runtime,
        this.#snapshot.activity.status !== 'idle',
      ),
    }
    const models = this.#snapshot.capabilities.models
    const defaultModel =
      this.#runtime.status === 'ready' ? this.#runtime.model : undefined
    const selected =
      models.find(
        (model) =>
          model.modelId === this.#snapshot.composer.model?.modelId &&
          model.providerId === this.#snapshot.composer.model?.providerId,
      ) ??
      models.find((model) => model.modelId === defaultModel) ??
      models[0]
    if (selected)
      this.#snapshot = {
        ...this.#snapshot,
        composer: { ...this.#snapshot.composer, model: selected },
      }
    this.#commit()
    const pending = this.#snapshot.turns.at(-1)
    if (
      pending &&
      !this.#turnController &&
      ['queued', 'running', 'retrying'].includes(pending.state.status)
    ) {
      this.#snapshot = { ...this.#snapshot, activity: { status: 'idle' } }
      const input = pending.user.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.markdown)
        .join('\n')
      await this.#send(createDraft(input), pending, true)
    }
  }

  dispose() {
    if (this.#disposed) return
    this.persist()
    this.#disposed = true
    this.#runtimeController?.abort()
    this.#turnController?.abort()
    this.#runtimeController = undefined
    this.#turnController = undefined
    this.#cancelNotification?.()
    this.#cancelNotification = undefined
    this.#listeners.clear()
  }

  async submit(draft: ComposerDraft, intent: SubmitIntent) {
    if (intent !== 'send') return
    await this.#send(draft)
  }

  async retryTurn(turnId: string) {
    const turn = this.#snapshot.turns.at(-1)
    if (
      !this.#snapshot.capabilities.canRetryTurn ||
      turn?.id !== turnId ||
      turn.state.status !== 'failed'
    )
      return
    const input = turn.user.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.markdown)
      .join('\n')
    await this.#send(createDraft(input), turn)
  }

  async #send(draft: ComposerDraft, retry?: ChatTurn, reconnect = false) {
    const input = composerDraftText(draft).trim()
    if (
      this.#disposed ||
      !input ||
      this.#runtime.status !== 'ready' ||
      this.#snapshot.activity.status !== 'idle'
    ) {
      return
    }

    const now = reconnect && retry ? retry.user.createdAt : Date.now()
    const turnId = retry?.id ?? createId('turn')
    const userMessageId = retry?.user.id ?? createId('message')
    const assistantMessageId =
      (reconnect ? retry?.assistant[0]?.id : undefined) ?? createId('message')
    const model =
      retry?.model ?? draft.model ?? this.#snapshot.capabilities.models[0]
    const requestedEffort = retry
      ? retry.reasoningEffort
      : draft.reasoningEffort
    const reasoningEffort =
      requestedEffort && model?.reasoningEfforts?.includes(requestedEffort)
        ? requestedEffort
        : model?.defaultReasoningEffort
    const effort = reasoningEffort ? { reasoningEffort } : {}
    const clearedDraft = retry
      ? this.#snapshot.composer
      : {
          ...createDraft('', draft.revision + 1),
          ...(model ? { model } : {}),
          ...effort,
        }
    const turn: ChatTurn = {
      assistant: [],
      id: turnId,
      ...(model ? { model } : {}),
      ...effort,
      state: { status: 'queued' },
      user: {
        createdAt: now,
        delivery: { clientId: createId('client'), status: 'optimistic' },
        id: userMessageId,
        parts: [
          {
            id: `${userMessageId}:text`,
            markdown: input,
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'user',
        turnId,
      },
    }
    const controller = new AbortController()
    let accepted = false
    let terminal = false

    this.#failedDraft = undefined
    this.#turnController = controller
    this.#snapshot = {
      ...this.#snapshot,
      activity: { status: 'busy', turnId },
      capabilities: capabilities(this.#runtime, true),
      composer: clearedDraft,
      turns: retry
        ? this.#snapshot.turns.map((item) =>
            item.id === turnId
              ? reconnect
                ? retry
                : { ...turn, user: retry.user }
              : item,
          )
        : [...this.#snapshot.turns, turn],
    }
    this.#commit()

    try {
      let response = await fetch(
        reconnect
          ? `/api/chat?turnId=${encodeURIComponent(turnId)}`
          : '/api/chat',
        {
          ...(reconnect
            ? {}
            : {
                body: JSON.stringify({
                  input,
                  model: model && {
                    modelId: model.modelId,
                    providerId: model.providerId,
                  },
                  reasoningEffort,
                  resume: this.#hasContext,
                  turnId,
                  retry: Boolean(retry),
                }),
              }),
          headers: {
            'Content-Type': 'application/json',
            ...this.#conversationHeaders(),
          },
          method: reconnect ? 'GET' : 'POST',
          signal: controller.signal,
        },
      )
      controller.signal.throwIfAborted()
      if (!response.ok) throw new Error(await responseError(response))

      accepted = true
      this.#hasContext = true
      for (let attempt = 0; ; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
            response = await fetch(
              `/api/chat?turnId=${encodeURIComponent(turnId)}`,
              {
                headers: this.#conversationHeaders(),
                signal: controller.signal,
              },
            )
            controller.signal.throwIfAborted()
            if (!response.ok) throw new Error(await responseError(response))
          }
          // Rebuild from the server's full replay so text and tool events cannot duplicate.
          this.#updateTurn(turnId, (current) => ({
            ...current,
            assistant: [assistantMessage(assistantMessageId, turnId, now)],
            state: { startedAt: now, status: 'running' },
            user: { ...current.user, delivery: { status: 'confirmed' } },
          }))
          await readEvents(response, (event) => {
            controller.signal.throwIfAborted()
            if (event.type === 'started') return
            if (event.type === 'completed') {
              terminal = true
              this.#completeTurn(turnId, assistantMessageId, event, now)
              return
            }
            if (event.type === 'cancelled') {
              terminal = true
              this.#interruptTurn(turnId, assistantMessageId, now)
              return
            }
            if (event.type === 'error') {
              terminal = true
              this.#failTurn(turnId, assistantMessageId, event.message, now)
              return
            }
            this.#updateAssistant(turnId, assistantMessageId, (message) =>
              applyStreamEvent(message, event, now),
            )
          })
          if (!terminal)
            throw new Error('The response stream ended before it completed.')
          break
        } catch (error) {
          if (isAbort(error) || attempt >= 3) throw error
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const failure =
        error instanceof Error
          ? error.message
          : 'The response could not be completed.'
      if (accepted || reconnect) {
        this.#failTurn(turnId, assistantMessageId, failure, now)
      } else if (retry) {
        this.#snapshot = {
          ...this.#snapshot,
          turns: this.#snapshot.turns.map((item) =>
            item.id === turnId ? retry : item,
          ),
          submissionError: chatError(failure, false),
        }
      } else {
        this.#failedDraft = draft
        this.#snapshot = {
          ...this.#snapshot,
          ...(this.#snapshot.composer.revision === clearedDraft.revision
            ? { composer: { ...draft, revision: clearedDraft.revision + 1 } }
            : {}),
          submissionError: chatError(failure, true),
          turns: this.#snapshot.turns.filter((item) => item.id !== turnId),
        }
      }
    } finally {
      if (this.#turnController === controller) this.#turnController = undefined
      if (
        !controller.signal.aborted &&
        this.#snapshot.activity.status !== 'idle'
      ) {
        this.#snapshot = {
          ...this.#snapshot,
          activity: { status: 'idle' },
          capabilities: capabilities(this.#runtime, false),
        }
      }
      if (!controller.signal.aborted) this.#commit()
    }
  }

  async stop(turnId: string) {
    if (
      this.#snapshot.activity.status === 'idle' ||
      this.#snapshot.activity.turnId !== turnId
    )
      return
    await fetch('/api/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.#conversationHeaders(),
      },
      body: JSON.stringify({ turnId }),
    })
  }

  updateDraft(draft: ComposerDraft) {
    this.#failedDraft = undefined
    const { submissionError: _submissionError, ...snapshot } = this.#snapshot
    this.#snapshot = { ...snapshot, composer: draft }
    // Controlled input edits must reach React before it restores the DOM value.
    for (const listener of this.#listeners) listener()
    this.#commit()
  }

  dismissSubmissionError() {
    this.#failedDraft = undefined
    const { submissionError: _submissionError, ...snapshot } = this.#snapshot
    this.#snapshot = snapshot
    this.#commit()
  }

  async retrySubmission() {
    const draft = this.#failedDraft
    if (!draft) return
    this.#failedDraft = undefined
    const { submissionError: _submissionError, ...snapshot } = this.#snapshot
    this.#snapshot = snapshot
    await this.submit(draft, 'send')
  }

  loadPrevious() {
    return Promise.resolve()
  }

  reconnect() {
    return this.initialize()
  }

  decidePermission(_input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }) {
    return Promise.resolve()
  }

  answerQuestion(_input: {
    originSessionId: string
    requestId: string
    response: QuestionResponse
  }) {
    return Promise.resolve()
  }

  rejectQuestion(_input: { originSessionId: string; requestId: string }) {
    return Promise.resolve()
  }

  editQueued(_item: QueuedPrompt) {}
  removeQueued(_item: QueuedPrompt) {}
  retryQueued(_item: QueuedPrompt) {
    return Promise.resolve()
  }
  updateQueue(_queue: readonly QueuedPrompt[]) {}
  revert(_turnId: string) {
    return Promise.resolve()
  }
  dismissReverted(_reverted: RevertedPrompt) {
    return Promise.resolve()
  }
  restoreReverted(_reverted: RevertedPrompt) {
    return Promise.resolve()
  }
  redoReverted(_reverted: RevertedPrompt) {
    return Promise.resolve()
  }

  #completeTurn(
    turnId: string,
    messageId: string,
    event: Extract<StreamEvent, { type: 'completed' }>,
    startedAt: number,
  ) {
    this.#updateAssistant(turnId, messageId, (message) =>
      settleAssistantParts(
        { ...message, parts: replaceText(message.parts, event.message) },
        { status: 'complete' },
      ),
    )
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      state: {
        endedAt: startedAt + event.durationMs,
        startedAt,
        status: 'complete',
      },
    }))
  }

  #interruptTurn(turnId: string, messageId: string, startedAt: number) {
    this.#updateAssistant(turnId, messageId, (message) =>
      settleAssistantParts(message, { status: 'interrupted' }),
    )
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      state: { endedAt: Date.now(), startedAt, status: 'interrupted' },
    }))
  }

  #failTurn(
    turnId: string,
    messageId: string,
    error: string,
    startedAt: number,
  ) {
    const failure = chatError(error, false)
    this.#updateAssistant(turnId, messageId, (message) =>
      settleAssistantParts(message, { error: failure, status: 'failed' }),
    )
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      state: {
        endedAt: Date.now(),
        error: failure,
        startedAt,
        status: 'failed',
      },
    }))
  }

  #updateAssistant(
    turnId: string,
    messageId: string,
    update: (message: ChatMessage) => ChatMessage,
  ) {
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      assistant: turn.assistant.map((message) =>
        message.id === messageId ? update(message) : message,
      ),
    }))
  }

  #updateTurn(turnId: string, update: (turn: ChatTurn) => ChatTurn) {
    this.#snapshot = {
      ...this.#snapshot,
      turns: this.#snapshot.turns.map((turn) =>
        turn.id === turnId ? update(turn) : turn,
      ),
    }
    this.#commit()
  }

  #commit() {
    if (this.#disposed || this.#cancelNotification) return
    this.#cancelNotification = scheduleOnAnimationFrame(() => {
      this.#cancelNotification = undefined
      this.#remember()
      clearTimeout(this.#saveTimer)
      if (this.#snapshot.activity.status === 'idle') this.persist()
      else this.#saveTimer = setTimeout(this.persist, 250)
      for (const listener of this.#listeners) listener()
    })
  }
}

export function createDraft(text = '', revision = 0): ComposerDraft {
  const id = createId('draft-text')
  return {
    attachments: [],
    mode: 'prompt',
    revision,
    segments: [{ id, text, type: 'text' }],
    selection: {
      anchor: { offset: text.length, segmentId: id },
      focus: { offset: text.length, segmentId: id },
    },
  }
}

function assistantMessage(
  id: string,
  turnId: string,
  createdAt: number,
): ChatMessage {
  return {
    createdAt,
    delivery: { status: 'confirmed' },
    id,
    parts: [],
    role: 'assistant',
    turnId,
  }
}

function applyStreamEvent(
  message: ChatMessage,
  event: Exclude<
    StreamEvent,
    { type: 'started' | 'completed' | 'cancelled' | 'error' }
  >,
  startedAt: number,
) {
  if (event.type === 'assistant-delta') {
    const parts = completeStreamingReasoning(message.parts)
    return {
      ...message,
      parts: updateText(parts, `${message.id}:text`, event.text, false),
    }
  }
  if (event.type === 'assistant-message') {
    return {
      ...message,
      parts: replaceText(completeStreamingReasoning(message.parts), event.text),
    }
  }
  if (event.type === 'reasoning-delta') {
    return {
      ...message,
      parts: updateReasoning(message.parts, message.id, event.text, startedAt),
    }
  }
  if (event.type === 'tool-started') {
    const presentation = toolPresentation(event.tool, event.input)
    const tool: ToolPart = {
      callId: event.id,
      id: event.id,
      presentation,
      state: {
        input: event.input ?? '',
        startedAt: Date.now(),
        status: 'running',
      },
      toolName: event.tool,
      type: 'tool',
    }
    return {
      ...message,
      parts: upsertPart(completeStreamingReasoning(message.parts), tool),
    }
  }

  const existing = message.parts.find(
    (part): part is ToolPart =>
      part.type === 'tool' && part.callId === event.id,
  )
  const input =
    existing && 'input' in existing.state ? existing.state.input : {}
  const presentation = existing?.presentation ?? toolPresentation(event.tool)
  const tool: ToolPart = {
    callId: event.id,
    id: event.id,
    presentation,
    state:
      event.status === 'failed'
        ? {
            endedAt: Date.now(),
            error: chatError(event.error, false),
            input,
            status: 'failed',
          }
        : {
            endedAt: Date.now(),
            input,
            ...(event.output === undefined ? {} : { output: event.output }),
            status: 'succeeded',
          },
    toolName: event.tool,
    type: 'tool',
  }
  return { ...message, parts: upsertPart(message.parts, tool) }
}

function updateText(
  parts: ChatMessage['parts'],
  id: string,
  text: string,
  replace: boolean,
) {
  // Only adjacent text belongs to the same segment. A tool or reasoning part
  // marks a new position in the response, even within one assistant message.
  const tail = parts.at(-1)
  const existing = tail?.type === 'text' ? tail : undefined
  const part = {
    id: existing?.id ?? `${id}:${parts.length}`,
    markdown: `${replace ? '' : (existing?.markdown ?? '')}${text}`,
    state: { status: 'streaming' as const },
    type: 'text' as const,
  }
  return upsertPart(parts, part)
}

function replaceText(parts: ChatMessage['parts'], text: string) {
  const streamed = parts
    .flatMap((part) => (part.type === 'text' ? [part.markdown] : []))
    .join('')
  if (streamed.trim() === text.trim()) return parts

  // Completion may carry the full accumulated response rather than just the
  // last segment. Reconcile its suffix without moving earlier text past tools.
  const tail = parts.at(-1)
  const earlier = tail?.type === 'text' ? parts.slice(0, -1) : parts
  const prefix = earlier
    .flatMap((part) => (part.type === 'text' ? [part.markdown] : []))
    .join('')
    .trimStart()
  const remaining = text.trimStart().startsWith(prefix)
    ? text.trimStart().slice(prefix.length)
    : text
  return updateText(parts, 'response-text', remaining, true)
}

function updateReasoning(
  parts: ChatMessage['parts'],
  messageId: string,
  text: string,
  startedAt: number,
) {
  let existing:
    | Extract<ChatMessage['parts'][number], { type: 'reasoning' }>
    | undefined
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (part?.type === 'reasoning' && part.state.status === 'streaming') {
      existing = part
      break
    }
  }
  const count = parts.filter((part) => part.type === 'reasoning').length
  const id = existing?.id ?? `${messageId}:reasoning:${count}`
  return upsertPart(parts, {
    id,
    startedAt: existing?.startedAt ?? startedAt,
    state: { status: 'streaming' },
    text: `${existing?.type === 'reasoning' ? existing.text : ''}${text}`,
    type: 'reasoning',
  })
}

function completeStreamingReasoning(parts: ChatMessage['parts']) {
  const endedAt = Date.now()
  return parts.map((part) =>
    part.type === 'reasoning' && part.state.status === 'streaming'
      ? { ...part, endedAt, state: { status: 'complete' as const } }
      : part,
  )
}

function upsertPart(
  parts: ChatMessage['parts'],
  part: ChatMessage['parts'][number],
) {
  const index = parts.findIndex((item) => item.id === part.id)
  if (index === -1) return [...parts, part]
  return parts.map((item, itemIndex) => (itemIndex === index ? part : item))
}

function settleAssistantParts(
  message: ChatMessage,
  state:
    | { status: 'complete' | 'interrupted' }
    | { error: ChatError; status: 'failed' },
): ChatMessage {
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return { ...part, state }
      }
      if (part.type === 'tool' && !isTerminalTool(part)) {
        if (state.status === 'failed') {
          const input = toolInput(part)
          return {
            ...part,
            state: {
              endedAt: Date.now(),
              error: state.error,
              ...(input === undefined ? {} : { input }),
              status: 'failed',
            },
          }
        }
        const input = toolInput(part)
        return {
          ...part,
          state: {
            endedAt: Date.now(),
            ...(input === undefined ? {} : { input }),
            status: 'cancelled',
          },
        }
      }
      return part
    }),
  }
}

function isTerminalTool(part: ToolPart) {
  return (
    part.state.status === 'succeeded' ||
    part.state.status === 'failed' ||
    part.state.status === 'cancelled'
  )
}

function toolInput(part: ToolPart) {
  return 'input' in part.state ? part.state.input : undefined
}

function toolPresentation(
  tool: string,
  input?: string,
): ToolPart['presentation'] {
  const target = input === undefined ? {} : { target: input }
  if (tool === 'search_web')
    return { kind: 'web', operation: 'search', ...target }
  if (tool === 'inspect_component_catalog')
    return { kind: 'context', operation: 'grep', ...target }
  return { kind: 'generic' }
}

function capabilities(runtime: RuntimeState, busy: boolean): ChatCapabilities {
  return {
    ...unavailableCapabilities,
    models: runtime.status === 'ready' ? (runtime.models ?? []) : [],
    canStop: busy,
    canSubmit: runtime.status === 'ready' && !busy,
    canRetryTurn: runtime.status === 'ready' && runtime.retryTurns === true,
  }
}

function chatError(
  message = 'The response could not be completed.',
  retryable: boolean,
): ChatError {
  return { kind: 'provider', message, retryable }
}

async function readEvents(
  response: globalThis.Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) throw new Error('The response stream is unavailable.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()
    buffer += decoder.decode(result.value, { stream: !result.done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const event = parseEvent(line)
      if (event) onEvent(event)
    }
    if (result.done) break
  }
  const finalEvent = parseEvent(buffer)
  if (finalEvent) onEvent(finalEvent)
}

function parseEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null
  try {
    const result = streamEventSchema.safeParse(JSON.parse(line))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

async function responseError(response: globalThis.Response) {
  const body: unknown = await response.json().catch(() => null)
  return isRecord(body) && typeof body.error === 'string'
    ? body.error
    : 'The model request failed.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function createId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}

function scheduleOnAnimationFrame(callback: () => void) {
  const handle = requestAnimationFrame(callback)
  return () => cancelAnimationFrame(handle)
}
