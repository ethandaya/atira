export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export type ChatErrorKind =
  | 'provider'
  | 'tool'
  | 'connection'
  | 'mutation'
  | 'validation'
  | 'unknown'

export type ChatError = Readonly<{
  code?: string
  kind: ChatErrorKind
  message: string
  retryable: boolean
}>

export type ConnectionState =
  | { status: 'connected' }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'offline'; error?: ChatError }

export type HistoryState =
  | { status: 'initial-loading' }
  | { status: 'ready'; hasPrevious: boolean }
  | { status: 'loading-previous' }
  | { status: 'complete' }
  | { status: 'failed'; canRetry: boolean; error: ChatError }

export type ModelIdentity = Readonly<{
  defaultReasoningEffort?: string
  label: string
  modelId: string
  providerId: string
  reasoningEfforts?: readonly string[]
}>

export type AgentIdentity = Readonly<{
  id: string
  label: string
}>

export type TaskTranscriptStep = Readonly<{
  error?: string
  id: string
  input?: string
  output?: string
  status: 'succeeded' | 'failed'
  summary: string
  tool: string
}>

export type TaskTranscript = Readonly<{
  reasoning?: string
  result: string
  steps: readonly TaskTranscriptStep[]
}>

export type TaskActivity = Readonly<{
  detail?: string
  summary: string
  tool?: string
}>

export type SelectorOption = Readonly<{
  id: string
  label: string
  unavailableReason?: string
}>

export type DraftReferenceType = 'file' | 'range' | 'resource' | 'agent'

export type ChatCapabilities = Readonly<{
  canRetryTurn?: boolean
  agents: readonly AgentIdentity[]
  busySubmission: readonly ('queue' | 'follow-up')[]
  canAttach: boolean
  canStop: boolean
  canSubmit: boolean
  canUseShell: boolean
  models: readonly ModelIdentity[]
  permissionDecisions: readonly PermissionDecision[]
  referenceTypes: readonly DraftReferenceType[]
  variants: readonly SelectorOption[]
}>

export type SessionActivity =
  | { status: 'idle' }
  | { status: 'busy'; turnId: string }
  | {
      status: 'retrying'
      attempt: number
      resumeAt?: number
      turnId: string
    }

export type TurnState =
  | { status: 'queued' }
  | { status: 'running'; startedAt: number }
  | {
      status: 'retrying'
      attempt: number
      error: ChatError
      resumeAt?: number
    }
  | {
      status: 'complete'
      endedAt: number
      startedAt: number
      stopReason?: string
    }
  | {
      status: 'interrupted'
      endedAt: number
      reason?: string
      startedAt: number
    }
  | {
      status: 'failed'
      endedAt: number
      error: ChatError
      startedAt?: number
    }

export type MessageDelivery =
  | { status: 'optimistic'; clientId: string }
  | { status: 'confirmed' }
  | { status: 'failed'; error: ChatError; retryable: boolean }

export type PartState =
  | { status: 'streaming' }
  | { status: 'complete' }
  | { status: 'interrupted' }
  | { status: 'failed'; error: ChatError }

export type TextPart = Readonly<{
  id: string
  markdown: string
  state: PartState
  type: 'text'
}>

export type ReasoningPart = Readonly<{
  endedAt?: number
  id: string
  startedAt?: number
  state: PartState
  text: string
  type: 'reasoning'
}>

export type AttachmentDescriptor = Readonly<{
  id: string
  kind: 'file' | 'image'
  mediaType?: string
  name: string
  previewUrl?: string
  size?: number
}>

export type AttachmentPart = Readonly<{
  attachment: AttachmentDescriptor
  id: string
  state:
    | { status: 'complete' }
    | { status: 'failed'; error: ChatError }
  type: 'attachment'
}>

export type CompactionPart = Readonly<{
  id: string
  state: PartState
  summary?: string
  type: 'compaction'
}>

export type RetryPart = Readonly<{
  attempt: number
  error: ChatError
  id: string
  resumeAt?: number
  type: 'retry'
}>

export type NoticePart = Readonly<{
  id: string
  message: string
  tone: 'neutral' | 'warning' | 'danger'
  type: 'notice'
}>

export type UnknownPart = Readonly<{
  data?: JsonValue
  id: string
  partType: string
  type: 'unknown'
}>

export type ToolProgress = Readonly<{
  current?: number
  label?: string
  total?: number
}>

export type FileChangeStatus = 'added' | 'removed' | 'modified' | 'moved'

export type FileChangeLine = Readonly<{
  content: string
  id: string
  kind: 'context' | 'addition' | 'deletion'
  newLine?: number
  oldLine?: number
}>

export type FileChangeHunk = Readonly<{
  header: string
  id: string
  lines: readonly FileChangeLine[]
}>

export type FileChangeFile = Readonly<{
  additions?: number
  deletions?: number
  hunks: readonly FileChangeHunk[]
  id: string
  path: string
  previousPath?: string
  status: FileChangeStatus
}>

export type FileDiagnostic = Readonly<{
  column: number
  id: string
  line: number
  message: string
  path: string
  severity: 'error' | 'warning' | 'information' | 'hint'
}>

export type ToolState =
  | {
      status: 'receiving-input'
      partialInput?: JsonValue
      rawInput: string
    }
  | { status: 'queued'; input: JsonValue }
  | {
      status: 'running'
      input: JsonValue
      progress?: ToolProgress
      startedAt: number
    }
  | {
      status: 'awaiting-permission'
      input: JsonValue
      requestId: string
    }
  | {
      status: 'succeeded'
      endedAt: number
      input: JsonValue
      output?: JsonValue
    }
  | {
      status: 'failed'
      endedAt: number
      error: ChatError
      input?: JsonValue
    }
  | {
      status: 'cancelled'
      endedAt: number
      input?: JsonValue
      reason?: string
    }

export type ToolPresentation =
  | { kind: 'context'; operation: 'read' | 'list' | 'glob' | 'grep' }
  | { kind: 'shell' }
  | {
      diagnostics: readonly FileDiagnostic[]
      files: readonly FileChangeFile[]
      kind: 'file-change'
      operation: 'edit' | 'write' | 'patch'
    }
  | {
      activity?: TaskActivity
      agent?: AgentIdentity
      blockers?: readonly string[]
      childSessionId?: string
      kind: 'task'
      transcript?: TaskTranscript
    }
  | { kind: 'web'; operation: 'fetch' | 'search' }
  | { kind: 'todo' }
  | { kind: 'skill' }
  | { kind: 'generic' }

export type ToolPart = Readonly<{
  callId: string
  id: string
  metadata?: Readonly<Record<string, JsonValue>>
  presentation: ToolPresentation
  state: ToolState
  toolName: string
  type: 'tool'
}>

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | AttachmentPart
  | CompactionPart
  | RetryPart
  | NoticePart
  | UnknownPart

export type ChatMessage = Readonly<{
  createdAt: number
  delivery: MessageDelivery
  id: string
  parts: readonly MessagePart[]
  role: 'user' | 'assistant' | 'system'
  turnId: string
}>

export type ChatTurn = Readonly<{
  agent?: AgentIdentity
  assistant: readonly ChatMessage[]
  id: string
  model?: ModelIdentity
  reasoningEffort?: string
  state: TurnState
  user: ChatMessage
}>

export type RequestOrigin = Readonly<{
  label?: string
  parentSessionId?: string
  sessionId: string
}>

export type RequestState<Decision> =
  | { status: 'pending' }
  | { status: 'submitting'; decision: Decision }
  | { status: 'failed'; decision: Decision; error: ChatError }
  | { status: 'resolved'; decision: Decision }
  | { status: 'expired' }

export type PermissionDecision = 'once' | 'always' | 'reject'

export type PermissionRequestView = Readonly<{
  consequence: 'reversible' | 'destructive' | 'external'
  effect: string
  id: string
  order: number
  origin: RequestOrigin
  scope?: string
  state: RequestState<PermissionDecision>
  title: string
  type: 'permission'
}>

export type QuestionOption = Readonly<{
  description?: string
  id: string
  label: string
}>

export type QuestionView =
  | Readonly<{
      allowCustom: boolean
      id: string
      label: string
      options: readonly QuestionOption[]
      required: boolean
      type: 'single-choice' | 'multiple-choice'
    }>
  | Readonly<{
      id: string
      label: string
      maxLength?: number
      multiline?: boolean
      required: boolean
      type: 'text'
    }>

export type QuestionAnswer =
  | Readonly<{
      customValue?: string
      optionIds: readonly string[]
      questionId: string
      type: 'choice'
    }>
  | Readonly<{
      questionId: string
      type: 'text'
      value: string
    }>

export type QuestionResponse = Readonly<{
  answers: readonly QuestionAnswer[]
}>

export type QuestionDecision =
  | Readonly<{ response: QuestionResponse; type: 'answer' }>
  | Readonly<{ type: 'reject' }>

export type QuestionRequestView = Readonly<{
  id: string
  order: number
  origin: RequestOrigin
  questions: readonly QuestionView[]
  state: RequestState<QuestionDecision>
  type: 'question'
}>

export type ChatRequest = PermissionRequestView | QuestionRequestView

export type TodoItemView = Readonly<{
  id: string
  state: 'pending' | 'in-progress' | 'complete' | 'cancelled'
  title: string
}>

export type TodoListView = Readonly<{
  id: string
  items: readonly TodoItemView[]
  state: 'active' | 'complete'
}>

export type DraftSegment =
  | Readonly<{ id: string; text: string; type: 'text' }>
  | Readonly<{
      id: string
      label: string
      referenceType: DraftReferenceType
      type: 'reference'
      value: string
    }>

export type DraftPoint = Readonly<{
  offset: number
  segmentId: string
}>

export type DraftAttachment =
  | Readonly<{
      attachment: AttachmentDescriptor
      state: 'reading'
    }>
  | Readonly<{
      attachment: AttachmentDescriptor
      sourceId: string
      state: 'ready'
    }>
  | Readonly<{
      attachment: AttachmentDescriptor
      error: ChatError
      state: 'failed'
    }>

export type ComposerDraft = Readonly<{
  agent?: AgentIdentity
  attachments: readonly DraftAttachment[]
  mode: 'prompt' | 'shell'
  model?: ModelIdentity
  reasoningEffort?: string
  revision: number
  segments: readonly DraftSegment[]
  selection: Readonly<{
    anchor: DraftPoint
    focus: DraftPoint
  }>
  variant?: string
}>

export type QueuedPrompt = Readonly<{
  draft: ComposerDraft
  id: string
}> &
  (
    | Readonly<{ state: 'queued' | 'submitting' }>
    | Readonly<{ error: ChatError; state: 'failed' }>
  )

export type RevertedPrompt = Readonly<{
  draft: ComposerDraft
  id: string
  turnId: string
}>

export type ChatSnapshot = Readonly<{
  activity: SessionActivity
  capabilities: ChatCapabilities
  composer: ComposerDraft
  connection: ConnectionState
  history: HistoryState
  queue: readonly QueuedPrompt[]
  requests: readonly ChatRequest[]
  revertedPrompt?: RevertedPrompt
  sessionId: string
  submissionError?: ChatError
  todos?: TodoListView
  turns: readonly ChatTurn[]
}>

export type SubmitIntent = 'send' | 'queue' | 'follow-up'

export interface ChatStore {
  answerQuestion(input: {
    originSessionId: string
    requestId: string
    response: QuestionResponse
  }): Promise<void>
  decidePermission(input: {
    decision: PermissionDecision
    originSessionId: string
    requestId: string
  }): Promise<void>
  dismissReverted(reverted: RevertedPrompt): Promise<void>
  dismissSubmissionError(): void
  editQueued(item: QueuedPrompt): void
  getSnapshot(): ChatSnapshot
  loadPrevious(): Promise<void>
  reconnect(): Promise<void>
  redoReverted(reverted: RevertedPrompt): Promise<void>
  rejectQuestion(input: {
    originSessionId: string
    requestId: string
  }): Promise<void>
  removeQueued(item: QueuedPrompt): void
  restoreReverted(reverted: RevertedPrompt): Promise<void>
  retryQueued(item: QueuedPrompt): Promise<void>
  retrySubmission(): Promise<void>
  retryTurn?(turnId: string): Promise<void>
  revert(turnId: string): Promise<void>
  stop(turnId: string): Promise<void>
  submit(draft: ComposerDraft, intent: SubmitIntent): Promise<void>
  subscribe(listener: () => void): () => void
  updateDraft(draft: ComposerDraft): void
  updateQueue(queue: readonly QueuedPrompt[]): void
}
