import type {
  ChatSnapshot,
  ChatStore,
  ChatTurn,
  ComposerDraft,
  DraftAttachment,
  DraftSegment,
  PermissionDecision,
  PermissionRequestView,
  QuestionRequestView,
  QuestionResponse,
  QueuedPrompt,
  RevertedPrompt,
  SubmitIntent,
} from '@atiraui/foundations/chat'
import { composerDraftText } from '@atiraui/foundations/chat-invariants'

import {
  applyStreamEvent,
  assistantMessage,
  settleAssistantParts,
} from './chat-stream-state'

import { createDraft, createTurn } from './fixtures/chat-fixture'
import { createStressSnapshot } from './fixtures/stress-snapshot'
import { createWorkflowSnapshot } from './fixtures/workflow-snapshot'

export class FixtureChatStore implements ChatStore {
  readonly #listeners = new Set<() => void>()
  #cancelNotification: (() => void) | undefined
  #identifier = 0
  #notificationCount = 0
  #snapshot: ChatSnapshot
  #timestamp = 10_000

  constructor(mode: 'workflow' | 'stress' = 'workflow') {
    this.#snapshot =
      mode === 'stress' ? createStressSnapshot() : createWorkflowSnapshot()
  }

  getSnapshot = () => this.#snapshot
  getNotificationCount = () => this.#notificationCount

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  appendTurn() {
    const index = this.#snapshot.turns.length
    this.#snapshot = {
      ...this.#snapshot,
      turns: [
        ...this.#snapshot.turns,
        createTurn(index, `New output ${index + 1}`),
      ],
    }
    this.#commit()
  }

  requestPermission() {
    if (
      this.#snapshot.requests.some(
        (request) => request.id === 'fixture-permission',
      )
    ) {
      return
    }
    this.#snapshot = {
      ...this.#snapshot,
      requests: [
        ...this.#snapshot.requests,
        {
          consequence: 'external',
          effect: 'Publish the generated preview to the review portal.',
          id: 'fixture-permission',
          order: 0,
          origin: {
            label: 'Design review subagent',
            parentSessionId: this.#snapshot.sessionId,
            sessionId: 'fixture-child',
          },
          scope: 'Applies to this preview only.',
          state: { status: 'pending' },
          title: 'Allow preview publishing?',
          type: 'permission',
        },
      ],
    }
    this.#commit()
  }

  requestQuestion() {
    if (
      this.#snapshot.requests.some(
        (request) => request.id === 'fixture-question',
      )
    ) {
      return
    }
    this.#snapshot = {
      ...this.#snapshot,
      requests: [
        ...this.#snapshot.requests,
        {
          id: 'fixture-question',
          order: 1,
          origin: { sessionId: this.#snapshot.sessionId },
          questions: [
            {
              allowCustom: false,
              id: 'fixture-question:density',
              label: 'Choose a density',
              options: [
                { id: 'compact', label: 'Compact' },
                { id: 'comfortable', label: 'Comfortable' },
              ],
              required: true,
              type: 'single-choice',
            },
            {
              id: 'fixture-question:notes',
              label: 'Review notes',
              multiline: true,
              required: true,
              type: 'text',
            },
          ],
          state: { status: 'pending' },
          type: 'question',
        },
      ],
    }
    this.#commit()
  }

  burstDeltas(count = 1_000) {
    const latest = this.#snapshot.turns.at(-1)
    const message = latest?.assistant.at(-1)
    if (!latest || !message) return
    const text = '·'.repeat(count)
    this.#snapshot = {
      ...this.#snapshot,
      turns: this.#snapshot.turns.map((turn) =>
        turn.id === latest.id
          ? {
              ...turn,
              assistant: turn.assistant.map((assistant) =>
                assistant.id === message.id
                  ? {
                      ...assistant,
                      parts: assistant.parts.map((part) =>
                        part.type === 'text'
                          ? { ...part, markdown: `${part.markdown}${text}` }
                          : part,
                      ),
                    }
                  : assistant,
              ),
            }
          : turn,
      ),
    }
    this.#commit()
  }

  addFiles(files: readonly File[], source: 'drop' | 'paste' | 'picker') {
    const attachments: DraftAttachment[] = files.map((file) => {
      const id = this.#id('attachment')
      const attachment = {
        id,
        kind: file.type.startsWith('image/')
          ? ('image' as const)
          : ('file' as const),
        mediaType: file.type || 'application/octet-stream',
        name: file.name,
        size: file.size,
      }
      if (file.name.endsWith('.blocked')) {
        return {
          attachment,
          error: {
            kind: 'validation',
            message: 'This fixture file needs an explicit retry.',
            retryable: true,
          },
          state: 'failed',
        }
      }
      return {
        attachment,
        sourceId: `fixture:${source}:${id}`,
        state: 'ready',
      }
    })
    this.#snapshot = {
      ...this.#snapshot,
      composer: {
        ...this.#snapshot.composer,
        attachments: [...this.#snapshot.composer.attachments, ...attachments],
        revision: this.#snapshot.composer.revision + 1,
      },
    }
    this.#commit()
  }

  removeAttachment(item: DraftAttachment) {
    this.#snapshot = {
      ...this.#snapshot,
      composer: {
        ...this.#snapshot.composer,
        attachments: this.#snapshot.composer.attachments.filter(
          (candidate) => candidate.attachment.id !== item.attachment.id,
        ),
        revision: this.#snapshot.composer.revision + 1,
      },
    }
    this.#commit()
  }

  retryAttachment(item: DraftAttachment) {
    if (item.state !== 'failed') return
    this.#snapshot = {
      ...this.#snapshot,
      composer: {
        ...this.#snapshot.composer,
        attachments: this.#snapshot.composer.attachments.map((candidate) =>
          candidate.attachment.id === item.attachment.id
            ? {
                attachment: candidate.attachment,
                sourceId: `fixture:retry:${candidate.attachment.id}`,
                state: 'ready',
              }
            : candidate,
        ),
        revision: this.#snapshot.composer.revision + 1,
      },
    }
    this.#commit()
  }

  removeReference(segment: Extract<DraftSegment, { type: 'reference' }>) {
    this.#snapshot = {
      ...this.#snapshot,
      composer: {
        ...this.#snapshot.composer,
        revision: this.#snapshot.composer.revision + 1,
        segments: this.#snapshot.composer.segments.filter(
          (candidate) => candidate.id !== segment.id,
        ),
      },
    }
    this.#commit()
  }

  async loadPrevious() {
    if (this.#snapshot.history.status !== 'ready') return
    this.#snapshot = {
      ...this.#snapshot,
      history: { status: 'loading-previous' },
    }
    this.#commit()
    await delay(20)
    const previous = Array.from({ length: 12 }, (_, index) =>
      createTurn(index - 12, `Earlier response ${index + 1}`),
    )
    this.#snapshot = {
      ...this.#snapshot,
      history: { status: 'complete' },
      turns: [...previous, ...this.#snapshot.turns],
    }
    this.#commit()
  }

  async submit(draft: ComposerDraft, intent: SubmitIntent) {
    if (intent === 'queue' || this.#snapshot.activity.status !== 'idle') {
      const item: QueuedPrompt = {
        draft,
        id: this.#id('queue'),
        state: 'queued',
      }
      this.#snapshot = {
        ...this.#snapshot,
        composer: emptyDraft(draft),
        queue: [...this.#snapshot.queue, item],
      }
      this.#commit()
      return
    }

    const text = composerDraftText(draft).trim()
    if (!text) return
    const now = this.#now()
    const id = this.#id('submitted-turn')
    const userId = `${id}:user`
    const turn: ChatTurn = {
      assistant: [],
      id,
      state: { status: 'queued' },
      user: {
        createdAt: now,
        delivery: { clientId: this.#id('client'), status: 'optimistic' },
        id: userId,
        parts: [
          {
            id: `${userId}:text`,
            markdown: text,
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'user',
        turnId: id,
      },
    }
    this.#snapshot = {
      ...this.#snapshot,
      activity: { status: 'busy', turnId: id },
      composer: emptyDraft(draft),
      turns: [...this.#snapshot.turns, turn],
    }
    this.#commit()
    await delay(250)
    if (!this.#isActive(id)) return

    const assistantId = `${id}:assistant`
    const toolId = `${assistantId}:tool`
    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: [
        applyStreamEvent(
          assistantMessage(assistantId, id, now + 250),
          { text: '', type: 'reasoning-delta' },
          now + 250,
          this.#at(now + 250),
        ),
      ],
      state: { startedAt: now, status: 'running' },
      user: { ...current.user, delivery: { status: 'confirmed' } },
    }))
    await delay(500)
    if (!this.#isActive(id)) return

    this.#applyEvent(id, assistantId, now + 250, {
      text: 'Inspecting the fixture lifecycle.',
      type: 'reasoning-delta',
    })
    await delay(500)
    if (!this.#isActive(id)) return

    this.#applyEvent(
      id,
      assistantId,
      now + 250,
      {
        id: toolId,
        input: text,
        summary: 'Searching the web',
        tool: 'search_web',
        type: 'tool-started',
      },
      this.#at(now + 1_250),
    )
    await delay(750)
    if (!this.#isActive(id)) return

    this.#applyEvent(
      id,
      assistantId,
      now + 250,
      {
        id: toolId,
        output: 'Fixture search complete.',
        status: 'succeeded',
        summary: 'Searched the web',
        tool: 'search_web',
        type: 'tool-completed',
      },
      this.#at(now + 2_000),
    )
    await delay(750)
    if (!this.#isActive(id)) return

    this.#applyEvent(id, assistantId, now + 250, {
      text: 'Streaming the fixture response…',
      type: 'assistant-delta',
    })
    await delay(250)
    if (!this.#isActive(id)) return

    const endedAt = this.#at(now + 2_750)
    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((message) =>
        message.id === assistantId
          ? settleAssistantParts(
              applyStreamEvent(
                message,
                {
                  text: 'The deterministic fixture response is complete.',
                  type: 'assistant-message',
                },
                now + 250,
                endedAt,
              ),
              { status: 'complete' },
            )
          : message,
      ),
      state: { endedAt, startedAt: now, status: 'complete' },
    }))
    this.#snapshot = { ...this.#snapshot, activity: { status: 'idle' } }
    this.#commit()
  }

  async stop(turnId: string) {
    if (!this.#isActive(turnId)) return
    const endedAt = this.#now()
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      assistant: turn.assistant.map((assistant) =>
        settleAssistantParts(assistant, { status: 'interrupted' }, endedAt),
      ),
      state: {
        endedAt,
        startedAt:
          turn.state.status === 'running' ? turn.state.startedAt : endedAt,
        status: 'interrupted',
      },
    }))
    this.#snapshot = { ...this.#snapshot, activity: { status: 'idle' } }
    this.#commit()
  }

  async decidePermission(input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }) {
    const request = this.#snapshot.requests.find(
      (item) =>
        item.type === 'permission' &&
        item.id === input.requestId &&
        item.origin.sessionId === input.originSessionId,
    )
    if (
      !request ||
      (request.state.status !== 'pending' && request.state.status !== 'failed')
    ) {
      return
    }
    this.#setPermissionState(request.id, {
      decision: input.decision,
      status: 'submitting',
    })
    await delay(30)
    this.#setPermissionState(request.id, {
      decision: input.decision,
      status: 'resolved',
    })
  }

  async answerQuestion(input: {
    originSessionId: string
    requestId: string
    response: QuestionResponse
  }) {
    const request = this.#snapshot.requests.find(
      (item) =>
        item.type === 'question' &&
        item.id === input.requestId &&
        item.origin.sessionId === input.originSessionId,
    )
    if (
      !request ||
      (request.state.status !== 'pending' && request.state.status !== 'failed')
    ) {
      return
    }
    const decision = { response: input.response, type: 'answer' as const }
    this.#setQuestionState(input.requestId, { decision, status: 'submitting' })
    await delay(30)
    this.#setQuestionState(input.requestId, { decision, status: 'resolved' })
  }

  async rejectQuestion(input: { originSessionId: string; requestId: string }) {
    const request = this.#snapshot.requests.find(
      (item) =>
        item.type === 'question' &&
        item.id === input.requestId &&
        item.origin.sessionId === input.originSessionId,
    )
    if (
      !request ||
      (request.state.status !== 'pending' && request.state.status !== 'failed')
    ) {
      return
    }
    const decision = { type: 'reject' as const }
    this.#setQuestionState(input.requestId, { decision, status: 'submitting' })
    await delay(30)
    this.#setQuestionState(input.requestId, { decision, status: 'resolved' })
  }

  updateDraft(draft: ComposerDraft) {
    this.#snapshot = { ...this.#snapshot, composer: draft }
    for (const listener of this.#listeners) listener()
  }

  editQueued(item: QueuedPrompt) {
    if (!this.#snapshot.queue.some((candidate) => candidate.id === item.id))
      return
    this.#snapshot = {
      ...this.#snapshot,
      composer: {
        ...item.draft,
        revision: this.#snapshot.composer.revision + 1,
      },
      queue: this.#snapshot.queue.filter(
        (candidate) => candidate.id !== item.id,
      ),
    }
    this.#commit()
  }

  removeQueued(item: QueuedPrompt) {
    this.#snapshot = {
      ...this.#snapshot,
      queue: this.#snapshot.queue.filter(
        (candidate) => candidate.id !== item.id,
      ),
    }
    this.#commit()
  }

  async retryQueued(item: QueuedPrompt) {
    this.#snapshot = {
      ...this.#snapshot,
      queue: this.#snapshot.queue.map((candidate) =>
        candidate.id === item.id
          ? { draft: candidate.draft, id: candidate.id, state: 'queued' }
          : candidate,
      ),
    }
    this.#commit()
  }

  async revert(turnId: string) {
    const turn = this.#snapshot.turns.find((item) => item.id === turnId)
    const textPart = turn?.user.parts.find((part) => part.type === 'text')
    if (!turn || textPart?.type !== 'text') return
    this.#snapshot = {
      ...this.#snapshot,
      revertedPrompt: {
        draft: createDraft(textPart.markdown),
        id: `${turnId}:reverted`,
        turnId,
      },
    }
    this.#commit()
  }

  async dismissReverted(reverted: RevertedPrompt) {
    if (this.#snapshot.revertedPrompt?.id !== reverted.id) return
    const { revertedPrompt: _revertedPrompt, ...snapshot } = this.#snapshot
    this.#snapshot = snapshot
    this.#commit()
  }

  async restoreReverted(reverted: RevertedPrompt) {
    if (this.#snapshot.revertedPrompt?.id !== reverted.id) return
    const { revertedPrompt: _revertedPrompt, ...snapshot } = this.#snapshot
    this.#snapshot = {
      ...snapshot,
      composer: {
        ...reverted.draft,
        revision: snapshot.composer.revision + 1,
      },
    }
    this.#commit()
  }

  async redoReverted(reverted: RevertedPrompt) {
    await this.dismissReverted(reverted)
  }

  #id(prefix: string) {
    this.#identifier += 1
    return `${prefix}:${this.#identifier}`
  }

  #now() {
    this.#timestamp += 1
    return this.#timestamp
  }

  #at(timestamp: number) {
    this.#timestamp = Math.max(this.#timestamp, timestamp)
    return timestamp
  }

  #isActive(turnId: string) {
    return (
      this.#snapshot.activity.status !== 'idle' &&
      this.#snapshot.activity.turnId === turnId
    )
  }

  #setPermissionState(
    requestId: string,
    state: PermissionRequestView['state'],
  ) {
    this.#snapshot = {
      ...this.#snapshot,
      requests: this.#snapshot.requests.map((request) =>
        request.id === requestId && request.type === 'permission'
          ? { ...request, state }
          : request,
      ),
    }
    this.#commit()
  }

  #setQuestionState(requestId: string, state: QuestionRequestView['state']) {
    this.#snapshot = {
      ...this.#snapshot,
      requests: this.#snapshot.requests.map((request) =>
        request.id === requestId && request.type === 'question'
          ? { ...request, state }
          : request,
      ),
    }
    this.#commit()
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

  #applyEvent(
    turnId: string,
    messageId: string,
    startedAt: number,
    event: Parameters<typeof applyStreamEvent>[1],
    eventAt?: number,
  ) {
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      assistant: turn.assistant.map((message) =>
        message.id === messageId
          ? applyStreamEvent(message, event, startedAt, eventAt)
          : message,
      ),
    }))
  }

  #commit() {
    if (this.#cancelNotification) return
    this.#cancelNotification = scheduleOnAnimationFrame(() => {
      this.#cancelNotification = undefined
      this.#notificationCount += 1
      for (const listener of this.#listeners) listener()
    })
  }
}

function emptyDraft(draft: ComposerDraft) {
  return createDraft('', draft.revision + 1)
}

function delay(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration))
}

function scheduleOnAnimationFrame(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(handle)
  }
  const handle = setTimeout(callback, 16)
  return () => clearTimeout(handle)
}
