import type {
  ChatCapabilities,
  ChatSnapshot,
  ChatStore,
  ChatTurn,
  ComposerDraft,
  DraftAttachment,
  DraftSegment,
  JsonValue,
  PermissionDecision,
  PermissionRequestView,
  QuestionRequestView,
  QuestionResponse,
  QueuedPrompt,
  RevertedPrompt,
  SubmitIntent,
  ToolPart,
  ToolPresentation,
} from '@pretty-amped/foundations/chat'
import { composerDraftText } from '@pretty-amped/foundations/chat-invariants'

const capabilities: ChatCapabilities = {
  agents: [
    { id: 'build', label: 'Build' },
    { id: 'plan', label: 'Plan' },
  ],
  busySubmission: ['queue'],
  canAttach: true,
  canStop: true,
  canSubmit: true,
  canUseShell: true,
  models: [
    { label: 'Fixture 1', modelId: 'fixture-1', providerId: 'fixture' },
  ],
  permissionDecisions: ['once', 'always', 'reject'],
  referenceTypes: ['file', 'range', 'resource', 'agent'],
  variants: [{ id: 'precise', label: 'Precise' }],
}

export class FixtureChatStore implements ChatStore {
  readonly #listeners = new Set<() => void>()
  #cancelNotification: (() => void) | undefined
  #notificationCount = 0
  #snapshot: ChatSnapshot

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
      turns: [...this.#snapshot.turns, createTurn(index, `New output ${index + 1}`)],
    }
    this.#commit()
  }

  requestPermission() {
    if (this.#snapshot.requests.some((request) => request.id === 'fixture-permission')) {
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
    if (this.#snapshot.requests.some((request) => request.id === 'fixture-question')) {
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
      const id = fixtureId('attachment')
      const attachment = {
        id,
        kind: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
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
        id: fixtureId('queue'),
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
    const now = Date.now()
    const id = fixtureId('submitted-turn')
    const userId = `${id}:user`
    const turn: ChatTurn = {
      assistant: [],
      id,
      state: { status: 'queued' },
      user: {
        createdAt: now,
        delivery: { clientId: fixtureId('client'), status: 'optimistic' },
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
    const reasoningId = `${assistantId}:reasoning`
    const toolId = `${assistantId}:tool`
    const textId = `${assistantId}:text`
    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: [
        {
          createdAt: now + 250,
          delivery: { status: 'confirmed' },
          id: assistantId,
          parts: [
            {
              id: reasoningId,
              startedAt: now + 250,
              state: { status: 'streaming' },
              text: '',
              type: 'reasoning',
            },
          ],
          role: 'assistant',
          turnId: id,
        },
      ],
      state: { startedAt: now, status: 'running' },
      user: { ...current.user, delivery: { status: 'confirmed' } },
    }))
    await delay(500)
    if (!this.#isActive(id)) return

    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((assistant) => ({
        ...assistant,
        parts: assistant.parts.map((part) =>
          part.type === 'reasoning'
            ? { ...part, text: 'Inspecting the fixture lifecycle.' }
            : part,
        ),
      })),
    }))
    await delay(500)
    if (!this.#isActive(id)) return

    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((assistant) => ({
        ...assistant,
        parts: [
          ...assistant.parts.map((part) =>
            part.type === 'reasoning'
              ? {
                  ...part,
                  endedAt: now + 1_250,
                  state: { status: 'complete' as const },
                }
              : part,
          ),
          {
            callId: `${toolId}:call`,
            id: toolId,
            presentation: { kind: 'web', operation: 'search' },
            state: {
              input: { query: text },
              startedAt: now + 1_250,
              status: 'running',
            },
            toolName: 'search_web',
            type: 'tool',
          },
        ],
      })),
    }))
    await delay(750)
    if (!this.#isActive(id)) return

    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((assistant) => ({
        ...assistant,
        parts: assistant.parts.map((part) =>
          part.id === toolId && part.type === 'tool'
            ? {
                ...part,
                state: {
                  endedAt: now + 2_000,
                  input: { query: text },
                  output: 'Fixture search complete.',
                  status: 'succeeded' as const,
                },
              }
            : part,
        ),
      })),
    }))
    await delay(750)
    if (!this.#isActive(id)) return

    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((assistant) => ({
        ...assistant,
        parts: [
          ...assistant.parts,
          {
            id: textId,
            markdown: 'Streaming the fixture response…',
            state: { status: 'streaming' },
            type: 'text',
          },
        ],
      })),
    }))
    await delay(250)
    if (!this.#isActive(id)) return

    this.#updateTurn(id, (current) => ({
      ...current,
      assistant: current.assistant.map((assistant) => ({
        ...assistant,
        parts: assistant.parts.map((part) =>
          part.id === textId && part.type === 'text'
            ? {
                ...part,
                markdown: 'The deterministic fixture response is complete.',
                state: { status: 'complete' },
              }
            : part,
        ),
      })),
      state: { endedAt: Date.now(), startedAt: now, status: 'complete' },
    }))
    this.#snapshot = { ...this.#snapshot, activity: { status: 'idle' } }
    this.#commit()
  }

  async stop(turnId: string) {
    if (!this.#isActive(turnId)) return
    this.#updateTurn(turnId, (turn) => ({
      ...turn,
      assistant: turn.assistant.map((assistant) => ({
        ...assistant,
        parts: assistant.parts.map((part) =>
          part.type === 'text' || part.type === 'reasoning'
            ? { ...part, state: { status: 'interrupted' } }
            : part.type === 'tool'
              ? cancelTool(part)
              : part,
        ),
      })),
      state: {
        endedAt: Date.now(),
        startedAt: turn.state.status === 'running' ? turn.state.startedAt : Date.now(),
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
    if (!request || (request.state.status !== 'pending' && request.state.status !== 'failed')) {
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
    if (!request || (request.state.status !== 'pending' && request.state.status !== 'failed')) {
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
    if (!request || (request.state.status !== 'pending' && request.state.status !== 'failed')) {
      return
    }
    const decision = { type: 'reject' as const }
    this.#setQuestionState(input.requestId, { decision, status: 'submitting' })
    await delay(30)
    this.#setQuestionState(input.requestId, { decision, status: 'resolved' })
  }

  updateDraft(draft: ComposerDraft) {
    this.#snapshot = { ...this.#snapshot, composer: draft }
    this.#commit()
  }

  editQueued(item: QueuedPrompt) {
    if (!this.#snapshot.queue.some((candidate) => candidate.id === item.id)) return
    this.#snapshot = {
      ...this.#snapshot,
      composer: { ...item.draft, revision: this.#snapshot.composer.revision + 1 },
      queue: this.#snapshot.queue.filter((candidate) => candidate.id !== item.id),
    }
    this.#commit()
  }

  removeQueued(item: QueuedPrompt) {
    this.#snapshot = {
      ...this.#snapshot,
      queue: this.#snapshot.queue.filter((candidate) => candidate.id !== item.id),
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

  dismissSubmissionError() {}
  retrySubmission() {
    return Promise.resolve()
  }
  reconnect() {
    return Promise.resolve()
  }
  updateQueue(queue: readonly QueuedPrompt[]) {
    this.#snapshot = { ...this.#snapshot, queue }
    this.#commit()
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

  #commit() {
    if (this.#cancelNotification) return
    this.#cancelNotification = scheduleOnAnimationFrame(() => {
      this.#cancelNotification = undefined
      this.#notificationCount += 1
      for (const listener of this.#listeners) listener()
    })
  }
}

export function createStressSnapshot(): ChatSnapshot {
  const turns = Array.from({ length: 500 }, (_, index) =>
    createStressTurn(index, index === 499),
  )
  return {
    activity: { status: 'busy', turnId: 'fixture-turn:499' },
    capabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { status: 'complete' },
    queue: [],
    requests: [],
    sessionId: 'stress-fixture',
    turns,
  }
}

function createWorkflowSnapshot(): ChatSnapshot {
  const turns = Array.from({ length: 18 }, (_, index) =>
    createTurn(index, `Fixture response ${index + 1}`),
  )
  turns[17] = createToolFixtureTurn(17)
  return {
    activity: { status: 'idle' },
    capabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { hasPrevious: true, status: 'ready' },
    queue: [],
    requests: [],
    sessionId: 'workflow-fixture',
    turns,
  }
}

function createToolFixtureTurn(index: number): ChatTurn {
  const turn = createTurn(index, 'The coding evidence is available below.')
  const assistant = turn.assistant[0]
  if (!assistant) return turn
  const tools: ToolPart[] = [
    completedTool(
      'context-read',
      'read',
      { kind: 'context', operation: 'read' },
      { path: 'packages/components/src/turn.tsx' },
      'export function Turn() {}',
    ),
    completedTool(
      'context-grep',
      'grep',
      { kind: 'context', operation: 'grep' },
      { pattern: 'data-slot' },
      '12 matches',
    ),
    completedTool(
      'shell',
      'shell',
      { kind: 'shell' },
      { command: 'pnpm typecheck' },
      'Done',
    ),
    completedTool(
      'file-change',
      'edit',
      {
        diagnostics: [],
        files: [
          {
            additions: 1,
            deletions: 1,
            hunks: [
              {
                header: '@@ -1 +1 @@',
                id: 'fixture-hunk',
                lines: [
                  {
                    content: 'const density = "compact"',
                    id: 'fixture-deletion',
                    kind: 'deletion',
                    oldLine: 1,
                  },
                  {
                    content: 'const density = "comfortable"',
                    id: 'fixture-addition',
                    kind: 'addition',
                    newLine: 1,
                  },
                ],
              },
            ],
            id: 'fixture-file',
            path: 'src/interface.ts',
            status: 'modified',
          },
        ],
        kind: 'file-change',
        operation: 'edit',
      },
      { path: 'src/interface.ts' },
      'Updated',
    ),
    completedTool(
      'task',
      'task',
      {
        agent: { id: 'review', label: 'Review agent' },
        childSessionId: 'fixture-child-session',
        kind: 'task',
        transcript: {
          reasoning: 'I compared the activity states and transcript hierarchy.',
          result: '**No blocking issues.** The activity rail remains stable across states.',
          steps: [
            {
              id: 'fixture-child-inspect',
              input: 'activity hierarchy',
              output: 'Reasoning, ToolActivity, MessageParts',
              status: 'succeeded',
              summary: 'Searched component catalog',
              tool: 'inspect_component_catalog',
            },
          ],
        },
      },
      { description: 'Review the chat surface' },
      'No blocking issues.',
    ),
    completedTool(
      'web',
      'webfetch',
      { kind: 'web', operation: 'fetch' },
      { url: 'https://example.com/reference' },
      'Reference loaded.',
    ),
    completedTool(
      'skill',
      'skill',
      { kind: 'skill' },
      { name: 'ui-review' },
      'Skill loaded.',
    ),
    completedTool(
      'generic',
      'mcp_custom_tool',
      { kind: 'generic' },
      { query: 'component contract' },
      { matches: 2 },
    ),
  ]
  return {
    ...turn,
    assistant: [{ ...assistant, parts: [...assistant.parts, ...tools] }],
  }
}

function completedTool(
  id: string,
  toolName: string,
  presentation: ToolPresentation,
  input: JsonValue,
  output: JsonValue,
): ToolPart {
  return {
    callId: `fixture:${id}:call`,
    id: `fixture:${id}`,
    presentation,
    state: {
      endedAt: Date.now(),
      input,
      output,
      status: 'succeeded',
    },
    toolName,
    type: 'tool',
  }
}

function cancelTool(part: ToolPart): ToolPart {
  const { state } = part
  if (
    state.status === 'succeeded' ||
    state.status === 'failed' ||
    state.status === 'cancelled'
  ) {
    return part
  }
  const input = state.status === 'receiving-input' ? state.partialInput : state.input
  return {
    ...part,
    state: {
      endedAt: Date.now(),
      ...(input === undefined ? {} : { input }),
      status: 'cancelled',
    },
  }
}

function createStressTurn(index: number, large: boolean): ChatTurn {
  const paragraph = 'Complete markdown source. '.repeat(20)
  const turn = createTurn(
    index,
    large
      ? `# Large response\n\n${`${paragraph}\n\n`.repeat(419)}${paragraph}`
      : `Response ${index + 1}`,
  )
  const assistant = turn.assistant[0]
  if (!assistant) return turn
  const notices = Array.from({ length: 8 }, (_, partIndex) => ({
    id: `${assistant.id}:notice:${partIndex}`,
    message: `Evidence ${index + 1}.${partIndex + 1}`,
    tone: 'neutral' as const,
    type: 'notice' as const,
  }))
  const parts = large
    ? [
        ...notices.slice(0, 7),
        {
          callId: 'large-output-call',
          id: 'large-output-tool',
          metadata: { truncated: false },
          presentation: { kind: 'shell' as const },
          state: {
            endedAt: index + 2,
            input: { command: 'generate-large-output' },
            output: 'line\n'.repeat(200_000),
            status: 'succeeded' as const,
          },
          toolName: 'shell',
          type: 'tool' as const,
        },
        ...assistant.parts,
      ]
    : [...notices, ...assistant.parts]
  return {
    ...turn,
    assistant: [
      {
        ...assistant,
        parts: parts.map((part) =>
          large && part.type === 'text'
            ? { ...part, state: { status: 'streaming' } }
            : part,
        ),
      },
    ],
    state: large
      ? { startedAt: index * 10 + 1, status: 'running' }
      : turn.state,
  }
}

function createTurn(index: number, response: string): ChatTurn {
  const id = `fixture-turn:${index}`
  const userId = `${id}:user`
  const assistantId = `${id}:assistant`
  return {
    assistant: [
      {
        createdAt: index * 10 + 2,
        delivery: { status: 'confirmed' },
        id: assistantId,
        parts: [
          {
            id: `${assistantId}:text`,
            markdown: response,
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'assistant',
        turnId: id,
      },
    ],
    id,
    state: { endedAt: index * 10 + 3, startedAt: index * 10 + 1, status: 'complete' },
    user: {
      createdAt: index * 10 + 1,
      delivery: { status: 'confirmed' },
      id: userId,
      parts: [
        {
          id: `${userId}:text`,
          markdown: `Fixture prompt ${index + 1}`,
          state: { status: 'complete' },
          type: 'text',
        },
      ],
      role: 'user',
      turnId: id,
    },
  }
}

function createDraft(text = '', revision = 0): ComposerDraft {
  const id = fixtureId('draft')
  const agent = capabilities.agents[0]
  const model = capabilities.models[0]
  const variant = capabilities.variants[0]
  return {
    ...(agent === undefined ? {} : { agent }),
    attachments: [],
    mode: 'prompt',
    ...(model === undefined ? {} : { model }),
    revision,
    segments: [{ id, text, type: 'text' }],
    selection: {
      anchor: { offset: text.length, segmentId: id },
      focus: { offset: text.length, segmentId: id },
    },
    ...(variant === undefined ? {} : { variant: variant.id }),
  }
}

function emptyDraft(draft: ComposerDraft) {
  return createDraft('', draft.revision + 1)
}

function fixtureId(prefix: string) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
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
