import type {
  ChatCapabilities,
  ChatMessage,
  ChatSnapshot,
  ChatStore,
  ChatTurn,
  ComposerDraft,
  SubmitIntent,
} from '@atira/foundations/chat'
import { composerDraftText } from '@atira/foundations/chat-invariants'
import type { StreamEvent } from '../chat-contract.ts'
import {
  applyStreamEvent,
  assistantMessage,
  providerError,
  replaceText,
  settleAssistantParts,
} from './chat-stream-state'
import {
  readSavedHistory,
  type SavedConversation,
  writeSavedHistory,
} from './conversation-persistence'
import {
  cancelTurn,
  fetchRuntime,
  readEvents,
  reconnectTurn,
  startTurn,
} from './nanocodex-chat-client'

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

const conversationStorageKey = 'atira:conversations:v1'

export class NanocodexChatStore implements ChatStore {
  readonly #listeners = new Set<() => void>()
  #runtimeController: AbortController | undefined
  #stopController: AbortController | undefined
  #turnController: AbortController | undefined
  #stoppingTurnId: string | undefined
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
        const data = readSavedHistory(saved)
        this.#conversations = data.conversations
        const current = this.#conversations.find(
          (item) => item.id === data.activeId,
        )
        if (current) this.#restore(current)
      }
    } catch {
      this.#snapshot = {
        ...this.#snapshot,
        submissionError: providerError(
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
      if (this.#storage) {
        writeSavedHistory(this.#storage, conversationStorageKey, {
          activeId: this.#snapshot.sessionId,
          conversations: this.#conversations,
        })
      }
    } catch {
      this.#snapshot = {
        ...this.#snapshot,
        submissionError: providerError(
          'Conversation history could not be saved. Keep this tab open; browser session storage may be full or blocked.',
          false,
        ),
      }
    }
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
      const body = await fetchRuntime(controller.signal)

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
    this.#stopController?.abort()
    this.#turnController?.abort()
    this.#runtimeController = undefined
    this.#stopController = undefined
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
      let response = reconnect
        ? await reconnectTurn(
            this.#snapshot.sessionId,
            turnId,
            controller.signal,
          )
        : await startTurn({
            conversationId: this.#snapshot.sessionId,
            input,
            model,
            reasoningEffort,
            resume: this.#hasContext,
            retry: Boolean(retry),
            signal: controller.signal,
            turnId,
          })
      controller.signal.throwIfAborted()
      accepted = true
      this.#hasContext = true
      for (let attempt = 0; ; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
            response = await reconnectTurn(
              this.#snapshot.sessionId,
              turnId,
              controller.signal,
            )
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
          submissionError: providerError(failure, false),
        }
      } else {
        this.#failedDraft = draft
        this.#snapshot = {
          ...this.#snapshot,
          ...(this.#snapshot.composer.revision === clearedDraft.revision
            ? { composer: { ...draft, revision: clearedDraft.revision + 1 } }
            : {}),
          submissionError: providerError(failure, true),
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
    if (!this.#isTurnActive(turnId) || this.#stoppingTurnId === turnId) return
    this.#stoppingTurnId = turnId
    const controller = new AbortController()
    this.#stopController = controller
    try {
      await cancelTurn(this.#snapshot.sessionId, turnId, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      if (this.#isTurnActive(turnId)) {
        this.#snapshot = {
          ...this.#snapshot,
          submissionError: providerError(
            error instanceof Error
              ? error.message
              : 'The active response could not be stopped.',
            false,
          ),
        }
        this.#commit()
      }
    } finally {
      if (this.#stoppingTurnId === turnId) this.#stoppingTurnId = undefined
      if (this.#stopController === controller) this.#stopController = undefined
    }
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

  reconnect() {
    return this.initialize()
  }

  #isTurnActive(turnId: string) {
    return (
      this.#snapshot.activity.status !== 'idle' &&
      this.#snapshot.activity.turnId === turnId
    )
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
    const failure = providerError(error, false)
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

function capabilities(runtime: RuntimeState, busy: boolean): ChatCapabilities {
  return {
    ...unavailableCapabilities,
    models: runtime.status === 'ready' ? (runtime.models ?? []) : [],
    canStop: busy,
    canSubmit: runtime.status === 'ready' && !busy,
    canRetryTurn: runtime.status === 'ready' && runtime.retryTurns === true,
  }
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
