import type { Message, Part } from '@opencode-ai/sdk/v2'
import type {
  AgentIdentity,
  ChatMessage,
  ChatTurn,
  FileChangeFile,
  FileChangeHunk,
  FileChangeLine,
  FileDiagnostic,
  JsonValue,
  MessagePart,
  ModelIdentity,
  PartState,
  SessionActivity,
  ToolPart,
  ToolPresentation,
  ToolState,
  TurnState,
} from '@pretty-amped/foundations/chat'

import {
  mapOpenCodeError,
  type OpenCodeAdapterState,
  type OpenCodeMessageRecord,
} from './state'

export type OpenCodeProjection = Readonly<{
  activity: SessionActivity
  turns: readonly ChatTurn[]
}>

export function projectOpenCodeState(
  state: OpenCodeAdapterState,
): OpenCodeProjection {
  const records = state.messageOrder
    .map((id) => state.messages[id])
    .filter((record) => record !== undefined)
  const users = records.filter((record) => record.info.role === 'user')
  const assistants = records.filter(
    (record) => record.info.role === 'assistant',
  )
  const turns = users.map((record, index) => {
    const replies = assistants.filter(
      (candidate) =>
        candidate.info.role === 'assistant' &&
        candidate.info.parentID === record.info.id,
    )
    return mapTurn(
      record,
      replies,
      state,
      index === users.length - 1,
    )
  })

  return {
    activity: projectActivity(state, turns.at(-1)),
    turns,
  }
}

function mapTurn(
  userRecord: OpenCodeMessageRecord,
  assistantRecords: readonly OpenCodeMessageRecord[],
  state: OpenCodeAdapterState,
  isLatest: boolean,
): ChatTurn {
  const user = userRecord.info
  if (user.role !== 'user') throw new Error('A chat turn must start with a user message.')

  const assistant = assistantRecords.flatMap((record) =>
    record.info.role === 'assistant'
      ? [mapMessage(record)]
      : [],
  )
  const latestAssistant = assistantRecords.at(-1)

  return {
    agent: mapAgent(user.agent),
    assistant,
    id: user.id,
    model: mapModel(user.model.providerID, user.model.modelID),
    state: mapTurnState(
      latestAssistant?.info,
      latestAssistant?.parts,
      state,
      isLatest,
      user.time.created,
    ),
    user: mapMessage(userRecord),
  }
}

function mapMessage(record: OpenCodeMessageRecord): ChatMessage {
  const mappedParts = record.parts.flatMap((part) => {
    const info = record.info
    const mapped = mapPart(part, info)
    return mapped ? [mapped] : []
  })
  const info = record.info

  return {
    createdAt: info.time.created,
    delivery: record.delivery,
    id: info.id,
    parts: mappedParts,
    role: info.role,
    turnId: info.role === 'assistant' ? info.parentID : info.id,
  }
}

function mapPart(part: Part, message: Message): MessagePart | undefined {
  switch (part.type) {
    case 'text':
      return {
        id: part.id,
        markdown: part.text,
        state: partState(message, part.time),
        type: 'text',
      }
    case 'reasoning':
      return {
        ...(part.time.end === undefined ? {} : { endedAt: part.time.end }),
        id: part.id,
        startedAt: part.time.start,
        state: partState(message, part.time),
        text: part.text,
        type: 'reasoning',
      }
    case 'file':
      return {
        attachment: {
          id: part.id,
          kind: part.mime.startsWith('image/') ? 'image' : 'file',
          mediaType: part.mime,
          name:
            part.filename ??
            (part.source?.type === 'file' || part.source?.type === 'symbol'
              ? part.source.path
              : 'Attachment'),
          ...(safePreviewUrl(part.url) ? { previewUrl: part.url } : {}),
        },
        id: part.id,
        state: { status: 'complete' },
        type: 'attachment',
      }
    case 'tool':
      return mapToolPart(part)
    case 'subtask':
      return {
        callId: part.id,
        id: part.id,
        presentation: {
          agent: mapAgent(part.agent),
          kind: 'task',
        },
        state: {
          input: toJsonValue({
            description: part.description,
            prompt: part.prompt,
          }),
          status: 'queued',
        },
        toolName: 'task',
        type: 'tool',
      }
    case 'retry':
      return {
        attempt: part.attempt,
        error: mapOpenCodeError(part.error),
        id: part.id,
        resumeAt: part.time.created,
        type: 'retry',
      }
    case 'compaction':
      return {
        id: part.id,
        state: { status: 'complete' },
        summary: part.auto ? 'Context compacted automatically.' : 'Context compacted.',
        type: 'compaction',
      }
    case 'patch':
      return {
        id: part.id,
        message: `${part.files.length.toLocaleString()} file${part.files.length === 1 ? '' : 's'} changed.`,
        tone: 'neutral',
        type: 'notice',
      }
    case 'agent':
      return {
        data: toJsonValue({ name: part.name, source: part.source }),
        id: part.id,
        partType: 'agent',
        type: 'unknown',
      }
    case 'step-start':
    case 'step-finish':
    case 'snapshot':
      return undefined
  }
}

function mapToolPart(part: Extract<Part, { type: 'tool' }>): ToolPart {
  const metadata = toolMetadata(part)
  return {
    callId: part.callID,
    id: part.id,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    presentation: toolPresentation(part.id, part.tool, part.state.input, metadata),
    state: mapToolState(part.state),
    toolName: part.tool,
    type: 'tool',
  }
}

function mapToolState(
  state: Extract<Part, { type: 'tool' }>['state'],
): ToolState {
  const input = toJsonValue(state.input)
  switch (state.status) {
    case 'pending':
      return {
        ...(Object.keys(state.input).length > 0 ? { partialInput: input } : {}),
        rawInput: state.raw,
        status: 'receiving-input',
      }
    case 'running':
      return {
        input,
        ...mapToolProgress(state.metadata),
        startedAt: state.time.start,
        status: 'running',
      }
    case 'completed':
      return {
        endedAt: state.time.end,
        input,
        output: state.output,
        status: 'succeeded',
      }
    case 'error':
      return {
        endedAt: state.time.end,
        error: {
          kind: 'tool',
          message: state.error,
          retryable: false,
        },
        input,
        status: 'failed',
      }
  }
}

function toolMetadata(
  part: Extract<Part, { type: 'tool' }>,
): Readonly<Record<string, JsonValue>> {
  const topLevel = part.metadata ? toJsonRecord(part.metadata) : {}
  const stateMetadata =
    'metadata' in part.state && part.state.metadata
      ? toJsonRecord(part.state.metadata)
      : {}
  const duration =
    'time' in part.state &&
    part.state.time &&
    'end' in part.state.time &&
    typeof part.state.time.end === 'number'
      ? part.state.time.end - part.state.time.start
      : undefined

  return {
    ...topLevel,
    ...stateMetadata,
    ...(duration === undefined || 'durationMs' in stateMetadata
      ? {}
      : { durationMs: duration }),
  }
}

function mapToolProgress(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return {}
  const candidate =
    metadata.progress &&
    typeof metadata.progress === 'object' &&
    !Array.isArray(metadata.progress)
      ? (metadata.progress as Record<string, unknown>)
      : metadata
  const current =
    typeof candidate.current === 'number' ? candidate.current : undefined
  const total = typeof candidate.total === 'number' ? candidate.total : undefined
  const label = typeof candidate.label === 'string' ? candidate.label : undefined
  if (current === undefined && total === undefined && label === undefined) return {}
  return {
    progress: {
      ...(current === undefined ? {} : { current }),
      ...(total === undefined ? {} : { total }),
      ...(label === undefined ? {} : { label }),
    },
  }
}

function toolPresentation(
  partId: string,
  tool: string,
  input: Record<string, unknown>,
  metadata: Readonly<Record<string, JsonValue>>,
): ToolPresentation {
  const value = tool.toLowerCase()
  if (value === 'read' || value.endsWith('_read')) {
    return { kind: 'context', operation: 'read' }
  }
  if (value === 'list' || value === 'ls' || value.endsWith('_list')) {
    return { kind: 'context', operation: 'list' }
  }
  if (value === 'glob' || value.endsWith('_glob')) {
    return { kind: 'context', operation: 'glob' }
  }
  if (value === 'grep' || value === 'search' || value.endsWith('_grep')) {
    return { kind: 'context', operation: 'grep' }
  }
  if (value === 'bash' || value === 'shell') return { kind: 'shell' }
  if (value === 'edit') {
    return fileChangePresentation(partId, 'edit', input, metadata)
  }
  if (value === 'write') {
    return fileChangePresentation(partId, 'write', input, metadata)
  }
  if (value === 'patch' || value === 'apply_patch') {
    return fileChangePresentation(partId, 'patch', input, metadata)
  }
  if (value === 'task' || value === 'subtask') {
    const agentId =
      typeof input.subagent_type === 'string' ? input.subagent_type : undefined
    const childSessionId =
      typeof metadata.sessionId === 'string' ? metadata.sessionId : undefined
    const blockers = stringList(metadata.blockers ?? metadata.blocker)
    return {
      ...(agentId ? { agent: mapAgent(agentId) } : {}),
      ...(blockers.length > 0 ? { blockers } : {}),
      ...(childSessionId ? { childSessionId } : {}),
      kind: 'task',
    }
  }
  if (value.includes('webfetch') || value === 'fetch') {
    return { kind: 'web', operation: 'fetch' }
  }
  if (value.includes('websearch')) return { kind: 'web', operation: 'search' }
  if (value.includes('todo')) return { kind: 'todo' }
  if (value === 'skill') return { kind: 'skill' }
  return { kind: 'generic' }
}

function fileChangePresentation(
  partId: string,
  operation: 'edit' | 'write' | 'patch',
  input: Record<string, unknown>,
  metadata: Readonly<Record<string, JsonValue>>,
): Extract<ToolPresentation, { kind: 'file-change' }> {
  const inputRecord = toJsonRecord(input)
  const inputPath = recordString(inputRecord, ['filePath', 'path', 'filename'])
  const rawFiles = arrayRecords(metadata.files)
  const filediff = jsonRecord(metadata.filediff)
  const candidates = rawFiles.length > 0 ? rawFiles : filediff ? [filediff] : []
  const files = candidates.flatMap((candidate, index) =>
    normalizeFileChange(partId, operation, inputPath, candidate, index),
  )

  if (files.length === 0 && inputPath && operation === 'edit') {
    const before = recordString(inputRecord, ['oldString'])
    const after = recordString(inputRecord, ['newString'])
    if (before !== undefined || after !== undefined) {
      const hunks = replacementHunk(
        before ?? '',
        after ?? '',
        `${partId}:file:0`,
      )
      files.push({
        ...countChangedLines(hunks),
        hunks,
        id: `${partId}:file:0`,
        path: inputPath,
        status: 'modified',
      })
    }
  }

  return {
    diagnostics: normalizeDiagnostics(partId, inputPath, metadata.diagnostics),
    files,
    kind: 'file-change',
    operation,
  }
}

function normalizeFileChange(
  partId: string,
  operation: 'edit' | 'write' | 'patch',
  inputPath: string | undefined,
  candidate: Readonly<Record<string, JsonValue>>,
  index: number,
): readonly FileChangeFile[] {
  const movePath = recordString(candidate, ['movePath'])
  const sourcePath =
    recordString(candidate, ['relativePath', 'filePath', 'file']) ?? inputPath
  const path = movePath ?? sourcePath
  if (!path) return []
  const id = `${partId}:file:${index}`
  const patch = recordString(candidate, ['patch', 'diff'])
  const before = recordString(candidate, ['before'])
  const after = recordString(candidate, ['after'])
  const hunks = patch
    ? parseUnifiedDiff(patch, id)
    : before !== undefined || after !== undefined
      ? replacementHunk(before ?? '', after ?? '', id)
      : []
  const counts = countChangedLines(hunks)
  const rawStatus = recordString(candidate, ['type', 'status'])

  return [
    {
      additions: recordNumber(candidate, ['additions']) ?? counts.additions,
      deletions: recordNumber(candidate, ['deletions']) ?? counts.deletions,
      hunks,
      id,
      path,
      ...(movePath && sourcePath ? { previousPath: sourcePath } : {}),
      status: fileChangeStatus(rawStatus, operation, movePath !== undefined),
    },
  ]
}

function normalizeDiagnostics(
  partId: string,
  inputPath: string | undefined,
  value: JsonValue | undefined,
): readonly FileDiagnostic[] {
  const byPath = jsonRecord(value)
  if (!byPath) return []
  const paths = inputPath ? [inputPath] : Object.keys(byPath)

  return paths.flatMap((path) =>
    jsonArray(byPath[path]).flatMap((item, index) => {
      const diagnostic = jsonRecord(item)
      const start = jsonRecord(jsonRecord(diagnostic?.range)?.start)
      const message = recordString(diagnostic, ['message'])
      if (!message) return []
      return [
        {
          column: (recordNumber(start, ['character']) ?? 0) + 1,
          id: `${partId}:diagnostic:${path}:${index}`,
          line: (recordNumber(start, ['line']) ?? 0) + 1,
          message,
          path,
          severity: diagnosticSeverity(recordNumber(diagnostic, ['severity'])),
        } satisfies FileDiagnostic,
      ]
    }),
  )
}

function parseUnifiedDiff(value: string, id: string): readonly FileChangeHunk[] {
  const hunks: FileChangeHunk[] = []
  let current:
    | {
        header: string
        lines: FileChangeLine[]
        newLine: number
        oldLine: number
      }
    | undefined

  for (const rawLine of value.replace(/\r\n?/g, '\n').split('\n')) {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(rawLine)
    if (match) {
      if (current) hunks.push(finishHunk(current, id, hunks.length))
      current = {
        header: rawLine,
        lines: [],
        newLine: Number(match[2]),
        oldLine: Number(match[1]),
      }
      continue
    }
    if (!current || rawLine === '\\ No newline at end of file') continue
    const prefix = rawLine.charAt(0)
    const kind =
      prefix === '+' ? 'addition' : prefix === '-' ? 'deletion' : 'context'
    current.lines.push({
      content:
        prefix === '+' || prefix === '-' || prefix === ' '
          ? rawLine.slice(1)
          : rawLine,
      id: `${id}:hunk:${hunks.length}:line:${current.lines.length}`,
      kind,
      ...(kind === 'addition' ? {} : { oldLine: current.oldLine++ }),
      ...(kind === 'deletion' ? {} : { newLine: current.newLine++ }),
    })
  }
  if (current) hunks.push(finishHunk(current, id, hunks.length))
  return hunks
}

function finishHunk(
  hunk: { header: string; lines: FileChangeLine[] },
  id: string,
  index: number,
): FileChangeHunk {
  return { header: hunk.header, id: `${id}:hunk:${index}`, lines: hunk.lines }
}

function replacementHunk(
  before: string,
  after: string,
  id: string,
): readonly FileChangeHunk[] {
  return [
    {
      header: '@@ replacement @@',
      id: `${id}:hunk:0`,
      lines: [
        ...before.split('\n').map((content, index) => ({
          content,
          id: `${id}:before:${index}`,
          kind: 'deletion' as const,
          oldLine: index + 1,
        })),
        ...after.split('\n').map((content, index) => ({
          content,
          id: `${id}:after:${index}`,
          kind: 'addition' as const,
          newLine: index + 1,
        })),
      ],
    },
  ]
}

function countChangedLines(hunks: readonly FileChangeHunk[]) {
  let additions = 0
  let deletions = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'addition') additions += 1
      if (line.kind === 'deletion') deletions += 1
    }
  }
  return { additions, deletions }
}

function fileChangeStatus(
  value: string | undefined,
  operation: 'edit' | 'write' | 'patch',
  moved: boolean,
): FileChangeFile['status'] {
  if (moved || value === 'move' || value === 'moved') return 'moved'
  if (value === 'add' || value === 'added' || operation === 'write') return 'added'
  if (value === 'delete' || value === 'deleted' || value === 'removed') {
    return 'removed'
  }
  return 'modified'
}

function diagnosticSeverity(value: number | undefined): FileDiagnostic['severity'] {
  if (value === 2) return 'warning'
  if (value === 3) return 'information'
  if (value === 4) return 'hint'
  return 'error'
}

function jsonRecord(value: JsonValue | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, JsonValue>>)
    : undefined
}

function jsonArray(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : []
}

function arrayRecords(value: JsonValue | undefined) {
  return jsonArray(value).flatMap((item) => {
    const record = jsonRecord(item)
    return record ? [record] : []
  })
}

function recordString(
  value: Readonly<Record<string, JsonValue>> | undefined,
  keys: readonly string[],
) {
  if (!value) return undefined
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}

function recordNumber(
  value: Readonly<Record<string, JsonValue>> | undefined,
  keys: readonly string[],
) {
  if (!value) return undefined
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
  }
  return undefined
}

function stringList(value: JsonValue | undefined): readonly string[] {
  if (typeof value === 'string' && value) return [value]
  return jsonArray(value).flatMap((item) =>
    typeof item === 'string' && item ? [item] : [],
  )
}

function partState(
  message: Message,
  time?: { start: number; end?: number },
): PartState {
  if (message.role === 'assistant' && message.error) {
    return message.error.name === 'MessageAbortedError'
      ? { status: 'interrupted' }
      : { error: mapOpenCodeError(message.error), status: 'failed' }
  }
  return message.role === 'user' || message.time.completed || time?.end
    ? { status: 'complete' }
    : { status: 'streaming' }
}

function mapTurnState(
  message: Message | undefined,
  parts: readonly Part[] | undefined,
  state: OpenCodeAdapterState,
  isLatest: boolean,
  userCreatedAt: number,
): TurnState {
  if (message?.role === 'assistant') {
    if (message.error?.name === 'MessageAbortedError') {
      return {
        endedAt: message.time.completed ?? message.time.created,
        startedAt: message.time.created,
        status: 'interrupted',
      }
    }
    if (message.error) {
      return {
        endedAt: message.time.completed ?? message.time.created,
        error: mapOpenCodeError(message.error),
        startedAt: message.time.created,
        status: 'failed',
      }
    }
    const retry = findLastRetry(parts)
    if (retry?.type === 'retry') {
      return {
        attempt: retry.attempt,
        error: mapOpenCodeError(retry.error),
        resumeAt: retry.time.created,
        status: 'retrying',
      }
    }
    if (message.time.completed !== undefined) {
      return {
        endedAt: message.time.completed,
        startedAt: message.time.created,
        ...(message.finish ? { stopReason: message.finish } : {}),
        status: 'complete',
      }
    }
    if (isLatest && state.sessionStatus.type === 'retry') {
      return {
        attempt: state.sessionStatus.attempt,
        error: {
          kind: 'provider',
          message: state.sessionStatus.message,
          retryable: true,
        },
        resumeAt: state.sessionStatus.next,
        status: 'retrying',
      }
    }
    if (isLatest && state.sessionError) {
      return {
        endedAt: message.time.created,
        error: state.sessionError,
        startedAt: message.time.created,
        status: 'failed',
      }
    }
    return { startedAt: message.time.created, status: 'running' }
  }

  return isLatest && state.sessionStatus.type === 'busy'
    ? { startedAt: userCreatedAt, status: 'running' }
    : { status: 'queued' }
}

function findLastRetry(parts: readonly Part[] | undefined) {
  if (!parts) return undefined

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (part?.type === 'retry') return part
  }

  return undefined
}

function projectActivity(
  state: OpenCodeAdapterState,
  latest: ChatTurn | undefined,
): SessionActivity {
  if (!latest || state.sessionStatus.type === 'idle') return { status: 'idle' }
  if (state.sessionStatus.type === 'retry') {
    return {
      attempt: state.sessionStatus.attempt,
      resumeAt: state.sessionStatus.next,
      status: 'retrying',
      turnId: latest.id,
    }
  }
  return { status: 'busy', turnId: latest.id }
}

function mapModel(providerId: string, modelId: string): ModelIdentity {
  return { label: modelId, modelId, providerId }
}

function mapAgent(agent: string): AgentIdentity {
  return { id: agent, label: humanize(agent) }
}

function safePreviewUrl(url: string) {
  return url.startsWith('blob:') || url.startsWith('data:image/')
}

function toJsonRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]),
  )
}

function toJsonValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item, seen))
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toJsonValue(item, seen)]),
  )
}

function humanize(value: string) {
  const words = value.replace(/[._-]+/g, ' ').trim()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : value
}
