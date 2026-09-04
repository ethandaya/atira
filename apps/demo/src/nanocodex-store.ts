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

export type RuntimeState =
  | { status: 'loading' }
  | { model: string; runtime: string; status: 'ready' }
  | { message: string; status: 'unavailable' }

type Usage = Readonly<{
  outputTokens: number
  totalTokens: number
}>

type StreamEvent =
  | { type: 'started' }
  | { text: string; type: 'assistant-delta' }
  | { text: string; type: 'assistant-message' }
  | { text: string; type: 'reasoning-delta' }
  | {
      id: string
      input?: string
      summary: string
      tool: string
      type: 'tool-started'
    }
  | {
      error?: string
      id: string
      output?: string
      status: 'succeeded' | 'failed'
      summary: string
      tool: string
      type: 'tool-completed'
    }
  | { durationMs: number; message: string; type: 'completed'; usage: Usage }
  | { type: 'cancelled' }
  | { message: string; type: 'error' }

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

export class NanocodexChatStore implements ChatStore {
  readonly #listeners = new Set<() => void>()
  #activeController: AbortController | undefined
  #cancelNotification: (() => void) | undefined
  #disposed = false
  #failedDraft: ComposerDraft | undefined
  #runtime: RuntimeState = { status: 'loading' }
  #snapshot: ChatSnapshot = {
    activity: { status: 'idle' },
    capabilities: unavailableCapabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { status: 'complete' },
    queue: [],
    requests: [],
    sessionId: 'nanocodex-playground',
    turns: [],
  }

  getSnapshot = () => this.#snapshot
  getRuntimeSnapshot = () => this.#runtime

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async initialize() {
    this.#disposed = false
    const controller = new AbortController()
    this.#activeController = controller

    try {
      const response = await fetch('/api/runtime', { signal: controller.signal })
      const body: unknown = await response.json()
      if (!response.ok || !isRecord(body)) throw new Error()

      this.#runtime =
        body.available === true &&
        typeof body.model === 'string' &&
        typeof body.runtime === 'string'
          ? { model: body.model, runtime: body.runtime, status: 'ready' }
          : {
              message: 'Add a supported server-side provider key to run the playground.',
              status: 'unavailable',
            }
    } catch (error) {
      if (isAbort(error)) return
      this.#runtime = {
        message: 'The local model runtime could not be reached.',
        status: 'unavailable',
      }
    } finally {
      if (this.#activeController === controller) this.#activeController = undefined
    }

    this.#snapshot = {
      ...this.#snapshot,
      capabilities: capabilities(this.#runtime, false),
    }
    this.#commit()
  }

  dispose() {
    if (this.#disposed) return
    this.#disposed = true
    this.#activeController?.abort()
    this.#cancelNotification?.()
    this.#cancelNotification = undefined
    this.#listeners.clear()
  }

  async clear() {
    const response = await fetch('/api/session', { method: 'DELETE' })
    if (!response.ok) return
    this.#failedDraft = undefined
    this.#snapshot = {
      ...this.#snapshot,
      activity: { status: 'idle' },
      capabilities: capabilities(this.#runtime, false),
      composer: createDraft(),
      turns: [],
    }
    this.#commit()
  }

  async submit(draft: ComposerDraft, intent: SubmitIntent) {
    const input = composerDraftText(draft).trim()
    if (
      !input ||
      intent !== 'send' ||
      this.#runtime.status !== 'ready' ||
      this.#snapshot.activity.status !== 'idle'
    ) {
      return
    }

    const now = Date.now()
    const turnId = createId('turn')
    const userMessageId = createId('message')
    const assistantMessageId = createId('message')
    const clearedDraft = createDraft('', draft.revision + 1)
    const turn: ChatTurn = {
      assistant: [],
      id: turnId,
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
    this.#activeController = controller
    this.#snapshot = {
      ...this.#snapshot,
      activity: { status: 'busy', turnId },
      capabilities: capabilities(this.#runtime, true),
      composer: clearedDraft,
      turns: [...this.#snapshot.turns, turn],
    }
    this.#commit()

    try {
      const response = await fetch('/api/chat', {
        body: JSON.stringify({ input }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await responseError(response))

      accepted = true
      this.#updateTurn(turnId, (current) => ({
        ...current,
        assistant: [assistantMessage(assistantMessageId, turnId, now)],
        state: { startedAt: now, status: 'running' },
        user: { ...current.user, delivery: { status: 'confirmed' } },
      }))

      await readEvents(response, (event) => {
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

      if (!terminal) {
        throw new Error('The response stream ended before it completed.')
      }
    } catch (error) {
      if (isAbort(error)) return
      const failure = error instanceof Error
        ? error.message
        : 'The response could not be completed.'
      if (accepted) {
        this.#failTurn(turnId, assistantMessageId, failure, now)
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
      if (this.#activeController === controller) this.#activeController = undefined
      if (this.#snapshot.activity.status !== 'idle') {
        this.#snapshot = {
          ...this.#snapshot,
          activity: { status: 'idle' },
          capabilities: capabilities(this.#runtime, false),
        }
      }
      this.#commit()
    }
  }

  async stop(_turnId: string) {
    if (this.#snapshot.activity.status === 'idle') return
    await fetch('/api/cancel', { method: 'POST' })
  }

  updateDraft(draft: ComposerDraft) {
    this.#failedDraft = undefined
    const { submissionError: _submissionError, ...snapshot } = this.#snapshot
    this.#snapshot = { ...snapshot, composer: draft }
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

function assistantMessage(id: string, turnId: string, createdAt: number): ChatMessage {
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
    return {
      ...message,
      parts: updateText(message.parts, `${message.id}:text`, event.text, false),
    }
  }
  if (event.type === 'assistant-message') {
    return { ...message, parts: replaceText(message.parts, event.text) }
  }
  if (event.type === 'reasoning-delta') {
    return {
      ...message,
      parts: updateReasoning(message.parts, `${message.id}:reasoning`, event.text, startedAt),
    }
  }
  if (event.type === 'tool-started') {
    const tool: ToolPart = {
      callId: event.id,
      id: event.id,
      presentation: toolPresentation(event.tool),
      state: {
        input: event.input ? { query: event.input } : {},
        startedAt: Date.now(),
        status: 'running',
      },
      toolName: event.tool,
      type: 'tool',
    }
    return { ...message, parts: upsertPart(message.parts, tool) }
  }

  const existing = message.parts.find(
    (part): part is ToolPart => part.type === 'tool' && part.callId === event.id,
  )
  const input = existing && 'input' in existing.state ? existing.state.input : {}
  const tool: ToolPart = {
    callId: event.id,
    id: event.id,
    presentation: existing?.presentation ?? toolPresentation(event.tool),
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
  const existing = parts.find(
    (part) => part.type === 'text' && part.id === id,
  )
  const part = {
    id,
    markdown: `${replace ? '' : existing?.type === 'text' ? existing.markdown : ''}${text}`,
    state: { status: 'streaming' as const },
    type: 'text' as const,
  }
  return upsertPart(parts, part)
}

function replaceText(parts: ChatMessage['parts'], text: string) {
  const current = parts.find((part) => part.type === 'text')
  return updateText(parts, current?.id ?? 'response-text', text, true)
}

function updateReasoning(
  parts: ChatMessage['parts'],
  id: string,
  text: string,
  startedAt: number,
) {
  const existing = parts.find(
    (part) => part.type === 'reasoning' && part.id === id,
  )
  return upsertPart(parts, {
    id,
    startedAt,
    state: { status: 'streaming' },
    text: `${existing?.type === 'reasoning' ? existing.text : ''}${text}`,
    type: 'reasoning',
  })
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
          return {
            ...part,
            state: { endedAt: Date.now(), error: state.error, status: 'failed' },
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

function toolPresentation(tool: string): ToolPart['presentation'] {
  const value = tool.toLowerCase()
  if (value === 'search_web' || value.includes('websearch')) {
    return { kind: 'web', operation: 'search' }
  }
  if (value.includes('search') || value === 'inspect_component_catalog') {
    return { kind: 'context', operation: 'grep' }
  }
  if (value === 'read') return { kind: 'context', operation: 'read' }
  if (value === 'bash' || value === 'shell') return { kind: 'shell' }
  if (value === 'write' || value === 'edit') {
    return { diagnostics: [], files: [], kind: 'file-change', operation: value }
  }
  return { kind: 'generic' }
}

function capabilities(runtime: RuntimeState, busy: boolean): ChatCapabilities {
  return {
    ...unavailableCapabilities,
    canStop: busy,
    canSubmit: runtime.status === 'ready' && !busy,
  }
}

function chatError(message = 'The response could not be completed.', retryable: boolean): ChatError {
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
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'started' || value.type === 'cancelled') return { type: value.type }
  if (
    (value.type === 'assistant-delta' ||
      value.type === 'assistant-message' ||
      value.type === 'reasoning-delta') &&
    typeof value.text === 'string'
  ) {
    return { text: value.text, type: value.type }
  }
  if (
    value.type === 'tool-started' &&
    typeof value.id === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.tool === 'string' &&
    (value.input === undefined || typeof value.input === 'string')
  ) {
    return {
      id: value.id,
      ...(value.input === undefined ? {} : { input: value.input }),
      summary: value.summary,
      tool: value.tool,
      type: 'tool-started',
    }
  }
  if (
    value.type === 'tool-completed' &&
    typeof value.id === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.tool === 'string' &&
    (value.status === 'succeeded' || value.status === 'failed') &&
    (value.output === undefined || typeof value.output === 'string') &&
    (value.error === undefined || typeof value.error === 'string')
  ) {
    return {
      ...(value.error === undefined ? {} : { error: value.error }),
      id: value.id,
      ...(value.output === undefined ? {} : { output: value.output }),
      status: value.status,
      summary: value.summary,
      tool: value.tool,
      type: 'tool-completed',
    }
  }
  if (value.type === 'error' && typeof value.message === 'string') {
    return { message: value.message, type: 'error' }
  }
  if (
    value.type === 'completed' &&
    typeof value.durationMs === 'number' &&
    typeof value.message === 'string' &&
    isRecord(value.usage) &&
    typeof value.usage.outputTokens === 'number' &&
    typeof value.usage.totalTokens === 'number'
  ) {
    return {
      durationMs: value.durationMs,
      message: value.message,
      type: 'completed',
      usage: {
        outputTokens: value.usage.outputTokens,
        totalTokens: value.usage.totalTokens,
      },
    }
  }
  return null
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
