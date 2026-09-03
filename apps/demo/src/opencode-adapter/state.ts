import type {
  Event,
  LlmToolContent,
  Message,
  Part,
  QuestionInfo,
  RevertState,
  SessionErrorUnknown,
  SessionStatus,
  Todo,
} from '@opencode-ai/sdk/v2'
import type {
  ChatError,
  ChatRequest,
  MessageDelivery,
  PermissionDecision,
  QuestionAnswer,
  QuestionDecision,
  QuestionRequestView,
  QuestionResponse,
  QuestionView,
  TodoListView,
} from '@pretty-amped/foundations/chat'

export type OpenCodeMessagePageItem = Readonly<{
  info: Message
  parts: readonly Part[]
}>

export type OpenCodeMessageRecord = Readonly<{
  delivery: MessageDelivery
  info: Message
  parts: readonly Part[]
  source: 'event' | 'optimistic' | 'page'
}>

export type OpenCodeAdapterState = Readonly<{
  messages: Readonly<Record<string, OpenCodeMessageRecord>>
  messageOrder: readonly string[]
  messageTombstones: ReadonlySet<string>
  nextRequestOrder: number
  orphanParts: Readonly<Record<string, readonly Part[]>>
  partTombstones: ReadonlySet<string>
  pendingDeltas: Readonly<Record<string, string>>
  requests: readonly ChatRequest[]
  revert?: RevertState
  seenEventIds: ReadonlySet<string>
  sessionError?: ChatError
  sessionId: string
  sessionStatus: SessionStatus
  todos?: TodoListView
}>

export function createOpenCodeAdapterState(
  sessionId: string,
): OpenCodeAdapterState {
  return {
    messages: {},
    messageOrder: [],
    messageTombstones: new Set(),
    nextRequestOrder: 0,
    orphanParts: {},
    partTombstones: new Set(),
    pendingDeltas: {},
    requests: [],
    seenEventIds: new Set(),
    sessionId,
    sessionStatus: { type: 'idle' },
  }
}

export function reduceOpenCodeEvent(
  state: OpenCodeAdapterState,
  event: Event,
): OpenCodeAdapterState {
  if (state.seenEventIds.has(event.id)) return state

  const seenEventIds = new Set(state.seenEventIds)
  seenEventIds.add(event.id)
  const next = { ...state, seenEventIds }

  switch (event.type) {
    case 'message.updated':
      return event.properties.sessionID === state.sessionId
        ? upsertMessage(next, event.properties.info, 'event')
        : next
    case 'message.removed':
      return event.properties.sessionID === state.sessionId
        ? removeMessage(next, event.properties.messageID)
        : next
    case 'message.part.updated':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(next, event.properties.part)
        : next
    case 'message.part.removed':
      return event.properties.sessionID === state.sessionId
        ? removePart(
            next,
            event.properties.messageID,
            event.properties.partID,
          )
        : next
    case 'message.part.delta':
      return event.properties.sessionID === state.sessionId
        ? appendPartDelta(next, {
            delta: event.properties.delta,
            field: event.properties.field,
            messageId: event.properties.messageID,
            partId: event.properties.partID,
          })
        : next
    case 'session.next.text.delta':
      return event.properties.sessionID === state.sessionId
        ? appendPartDelta(next, {
            delta: event.properties.delta,
            field: 'text',
            messageId: event.properties.assistantMessageID,
            partId: event.properties.textID,
          })
        : next
    case 'session.next.reasoning.delta':
      return event.properties.sessionID === state.sessionId
        ? appendPartDelta(next, {
            delta: event.properties.delta,
            field: 'text',
            messageId: event.properties.assistantMessageID,
            partId: event.properties.reasoningID,
          })
        : next
    case 'session.next.tool.input.delta':
      return event.properties.sessionID === state.sessionId
        ? appendToolInputDelta(
            next,
            event.properties.assistantMessageID,
            event.properties.callID,
            event.properties.delta,
          )
        : next
    case 'session.next.text.started':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(next, {
            id: event.properties.textID,
            messageID: event.properties.assistantMessageID,
            sessionID: event.properties.sessionID,
            text: '',
            time: { start: event.properties.timestamp },
            type: 'text',
          })
        : next
    case 'session.next.text.ended':
      return event.properties.sessionID === state.sessionId
        ? finishTextPart(next, {
            id: event.properties.textID,
            messageId: event.properties.assistantMessageID,
            sessionId: event.properties.sessionID,
            text: event.properties.text,
            timestamp: event.properties.timestamp,
            type: 'text',
          })
        : next
    case 'session.next.reasoning.started':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(next, {
            id: event.properties.reasoningID,
            messageID: event.properties.assistantMessageID,
            sessionID: event.properties.sessionID,
            text: '',
            time: { start: event.properties.timestamp },
            type: 'reasoning',
          })
        : next
    case 'session.next.reasoning.ended':
      return event.properties.sessionID === state.sessionId
        ? finishTextPart(next, {
            id: event.properties.reasoningID,
            messageId: event.properties.assistantMessageID,
            sessionId: event.properties.sessionID,
            text: event.properties.text,
            timestamp: event.properties.timestamp,
            type: 'reasoning',
          })
        : next
    case 'session.next.tool.input.started':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(
            next,
            pendingToolPart({
              callId: event.properties.callID,
              messageId: event.properties.assistantMessageID,
              sessionId: event.properties.sessionID,
              tool: event.properties.name,
            }),
          )
        : next
    case 'session.next.tool.input.ended':
      return event.properties.sessionID === state.sessionId
        ? finishToolInput(next, {
            callId: event.properties.callID,
            messageId: event.properties.assistantMessageID,
            sessionId: event.properties.sessionID,
            text: event.properties.text,
          })
        : next
    case 'session.next.tool.called':
      return event.properties.sessionID === state.sessionId
        ? startTool(next, {
            callId: event.properties.callID,
            input: event.properties.input,
            messageId: event.properties.assistantMessageID,
            sessionId: event.properties.sessionID,
            timestamp: event.properties.timestamp,
            tool: event.properties.tool,
          })
        : next
    case 'session.next.tool.progress':
      return event.properties.sessionID === state.sessionId
        ? progressTool(next, {
            callId: event.properties.callID,
            content: event.properties.content,
            messageId: event.properties.assistantMessageID,
            structured: event.properties.structured,
            timestamp: event.properties.timestamp,
          })
        : next
    case 'session.next.tool.success':
      return event.properties.sessionID === state.sessionId
        ? succeedTool(next, {
            callId: event.properties.callID,
            content: event.properties.content,
            messageId: event.properties.assistantMessageID,
            result: event.properties.result,
            structured: event.properties.structured,
            timestamp: event.properties.timestamp,
          })
        : next
    case 'session.next.tool.failed':
      return event.properties.sessionID === state.sessionId
        ? failTool(next, {
            callId: event.properties.callID,
            error: event.properties.error,
            messageId: event.properties.assistantMessageID,
            timestamp: event.properties.timestamp,
          })
        : next
    case 'session.next.shell.started':
      return event.properties.sessionID === state.sessionId
        ? startTool(next, {
            callId: event.properties.callID,
            input: { command: event.properties.command },
            messageId: event.properties.messageID,
            sessionId: event.properties.sessionID,
            timestamp: event.properties.timestamp,
            tool: 'shell',
          })
        : next
    case 'session.next.shell.ended':
      return event.properties.sessionID === state.sessionId
        ? succeedToolByCallId(next, {
            callId: event.properties.callID,
            output: event.properties.output,
            timestamp: event.properties.timestamp,
          })
        : next
    case 'session.next.step.ended':
      return event.properties.sessionID === state.sessionId
        ? finishAssistantMessage(
            next,
            event.properties.assistantMessageID,
            event.properties.timestamp,
            event.properties.finish,
          )
        : next
    case 'session.next.step.failed':
      return event.properties.sessionID === state.sessionId
        ? failAssistantMessage(
            next,
            event.properties.assistantMessageID,
            event.properties.timestamp,
            event.properties.error,
          )
        : next
    case 'session.next.retried':
      return event.properties.sessionID === state.sessionId
        ? addRetry(next, event.properties)
        : next
    case 'session.next.compaction.started':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(next, {
            auto: event.properties.reason === 'auto',
            id: compactionPartId(event.properties.messageID),
            messageID: event.properties.messageID,
            sessionID: event.properties.sessionID,
            type: 'compaction',
          })
        : next
    case 'session.next.compaction.ended':
      return event.properties.sessionID === state.sessionId
        ? upsertPart(next, {
            auto: event.properties.reason === 'auto',
            id: compactionPartId(event.properties.messageID),
            messageID: event.properties.messageID,
            sessionID: event.properties.sessionID,
            type: 'compaction',
          })
        : next
    case 'session.next.revert.staged':
      return event.properties.sessionID === state.sessionId
        ? { ...next, revert: event.properties.revert }
        : next
    case 'session.next.revert.cleared':
    case 'session.next.revert.committed':
      return event.properties.sessionID === state.sessionId
        ? withoutRevert(next)
        : next
    case 'session.status':
      return event.properties.sessionID === state.sessionId
        ? {
            ...withoutSessionError(next),
            sessionStatus: event.properties.status,
          }
        : next
    case 'session.idle':
      return event.properties.sessionID === state.sessionId
        ? { ...next, sessionStatus: { type: 'idle' } }
        : next
    case 'session.error':
      return !event.properties.sessionID ||
        event.properties.sessionID === state.sessionId
        ? {
            ...next,
            sessionError: mapOpenCodeError(event.properties.error),
            sessionStatus: { type: 'idle' },
          }
        : next
    case 'permission.asked':
      return event.properties.sessionID === state.sessionId
        ? addRequest(
            next,
            permissionRequest(next, {
              action: event.properties.permission,
              id: event.properties.id,
              resources: event.properties.patterns,
              save: event.properties.always,
              sessionId: event.properties.sessionID,
            }),
          )
        : next
    case 'permission.v2.asked':
      return event.properties.sessionID === state.sessionId
        ? addRequest(
            next,
            permissionRequest(next, {
              action: event.properties.action,
              id: event.properties.id,
              resources: event.properties.resources,
              ...(event.properties.save === undefined
                ? {}
                : { save: event.properties.save }),
              sessionId: event.properties.sessionID,
            }),
          )
        : next
    case 'permission.replied':
    case 'permission.v2.replied':
      return event.properties.sessionID === state.sessionId
        ? resolvePermission(
            next,
            event.properties.requestID,
            event.properties.reply,
          )
        : next
    case 'question.asked':
    case 'question.v2.asked':
      return event.properties.sessionID === state.sessionId
        ? addRequest(
            next,
            questionRequest(
              next,
              event.properties.id,
              event.properties.sessionID,
              event.properties.questions,
            ),
          )
        : next
    case 'question.replied':
    case 'question.v2.replied':
      return event.properties.sessionID === state.sessionId
        ? resolveQuestion(
            next,
            event.properties.requestID,
            event.properties.answers,
          )
        : next
    case 'question.rejected':
    case 'question.v2.rejected':
      return event.properties.sessionID === state.sessionId
        ? resolveQuestion(next, event.properties.requestID, 'reject')
        : next
    case 'todo.updated':
      return event.properties.sessionID === state.sessionId
        ? withTodos(next, event.properties.todos)
        : next
    default:
      return next
  }
}

export function mergeOpenCodeMessagePage(
  state: OpenCodeAdapterState,
  page: readonly OpenCodeMessagePageItem[],
): OpenCodeAdapterState {
  let next = state

  for (const item of page) {
    if (
      item.info.sessionID !== state.sessionId ||
      state.messageTombstones.has(item.info.id)
    ) {
      continue
    }

    const existing = next.messages[item.info.id]
    if (!existing || existing.source === 'optimistic') {
      next = upsertMessage(next, item.info, 'page')
    }

    for (const part of item.parts) {
      if (!next.partTombstones.has(part.id)) {
        next = upsertPart(next, part, existing?.source === 'event')
      }
    }
  }

  return next
}

export function addOpenCodeOptimisticMessage(
  state: OpenCodeAdapterState,
  input: {
    clientId: string
    info: Message
    parts: readonly Part[]
  },
): OpenCodeAdapterState {
  let next = upsertMessage(state, input.info, 'optimistic')
  for (const part of input.parts) next = upsertPart(next, part)
  const record = next.messages[input.info.id]
  if (!record) return next

  return {
    ...next,
    messages: {
      ...next.messages,
      [input.info.id]: {
        ...record,
        delivery: { clientId: input.clientId, status: 'optimistic' },
      },
    },
  }
}

export function failOpenCodeMessage(
  state: OpenCodeAdapterState,
  messageId: string,
  error: ChatError,
): OpenCodeAdapterState {
  const record = state.messages[messageId]
  if (!record) return state
  return {
    ...state,
    messages: {
      ...state.messages,
      [messageId]: {
        ...record,
        delivery: { error, retryable: error.retryable, status: 'failed' },
      },
    },
  }
}

function upsertMessage(
  state: OpenCodeAdapterState,
  info: Message,
  source: OpenCodeMessageRecord['source'],
): OpenCodeAdapterState {
  if (state.messageTombstones.has(info.id)) return state

  const existing = state.messages[info.id]
  const orphanParts = state.orphanParts[info.id] ?? []
  const record: OpenCodeMessageRecord = {
    delivery: { status: 'confirmed' },
    info: source === 'page' && existing ? existing.info : info,
    parts: mergeParts(existing?.parts ?? [], orphanParts),
    source: existing?.source === 'event' ? 'event' : source,
  }
  const nextOrphans = { ...state.orphanParts }
  delete nextOrphans[info.id]

  return {
    ...state,
    messageOrder: existing
      ? state.messageOrder
      : sortMessageOrder([...state.messageOrder, info.id], {
          ...state.messages,
          [info.id]: record,
        }),
    messages: { ...state.messages, [info.id]: record },
    orphanParts: nextOrphans,
  }
}

function removeMessage(state: OpenCodeAdapterState, messageId: string) {
  const messages = { ...state.messages }
  const orphanParts = { ...state.orphanParts }
  delete messages[messageId]
  delete orphanParts[messageId]
  const messageTombstones = new Set(state.messageTombstones)
  messageTombstones.add(messageId)

  return {
    ...state,
    messages,
    messageOrder: state.messageOrder.filter((id) => id !== messageId),
    messageTombstones,
    orphanParts,
  }
}

function upsertPart(
  state: OpenCodeAdapterState,
  part: Part,
  preserveExisting = false,
): OpenCodeAdapterState {
  if (
    state.partTombstones.has(part.id) ||
    state.messageTombstones.has(part.messageID)
  ) {
    return state
  }

  const pendingDeltas = { ...state.pendingDeltas }
  const textDeltaKey = partDeltaKey(part.messageID, part.id, 'text')
  const textDelta = pendingDeltas[textDeltaKey]
  let resolvedPart = textDelta ? applyPendingDelta(part, textDelta) : part
  delete pendingDeltas[textDeltaKey]

  if (resolvedPart.type === 'tool') {
    const inputDeltaKey = partDeltaKey(
      resolvedPart.messageID,
      resolvedPart.callID,
      'tool-input',
    )
    const inputDelta = pendingDeltas[inputDeltaKey]
    if (inputDelta) resolvedPart = applyPendingDelta(resolvedPart, inputDelta)
    delete pendingDeltas[inputDeltaKey]
  }

  const record = state.messages[part.messageID]
  if (!record) {
    return {
      ...state,
      orphanParts: {
        ...state.orphanParts,
        [part.messageID]: upsertPartInList(
          state.orphanParts[part.messageID] ?? [],
          resolvedPart,
          preserveExisting,
        ),
      },
      pendingDeltas,
    }
  }

  return {
    ...state,
    messages: {
      ...state.messages,
      [part.messageID]: {
        ...record,
        parts: upsertPartInList(record.parts, resolvedPart, preserveExisting),
      },
    },
    pendingDeltas,
  }
}

function removePart(
  state: OpenCodeAdapterState,
  messageId: string,
  partId: string,
) {
  const partTombstones = new Set(state.partTombstones)
  partTombstones.add(partId)
  const record = state.messages[messageId]

  if (!record) return { ...state, partTombstones }

  return {
    ...state,
    messages: {
      ...state.messages,
      [messageId]: {
        ...record,
        parts: record.parts.filter((part) => part.id !== partId),
      },
    },
    partTombstones,
  }
}

function finishTextPart(
  state: OpenCodeAdapterState,
  input: {
    id: string
    messageId: string
    sessionId: string
    text: string
    timestamp: number
    type: 'text' | 'reasoning'
  },
) {
  const existing = findPart(state, input.messageId, input.id)
  const startedAt =
    existing &&
    (existing.type === 'text' || existing.type === 'reasoning')
      ? existing.time?.start
      : undefined
  const time = { end: input.timestamp, start: startedAt ?? input.timestamp }

  return upsertPart(
    state,
    input.type === 'text'
      ? {
          id: input.id,
          messageID: input.messageId,
          sessionID: input.sessionId,
          text: input.text,
          time,
          type: 'text',
        }
      : {
          id: input.id,
          messageID: input.messageId,
          sessionID: input.sessionId,
          text: input.text,
          time,
          type: 'reasoning',
        },
  )
}

function pendingToolPart(input: {
  callId: string
  messageId: string
  sessionId: string
  tool: string
}): Extract<Part, { type: 'tool' }> {
  return {
    callID: input.callId,
    id: toolPartId(input.callId),
    messageID: input.messageId,
    sessionID: input.sessionId,
    state: { input: {}, raw: '', status: 'pending' },
    tool: input.tool,
    type: 'tool',
  }
}

function finishToolInput(
  state: OpenCodeAdapterState,
  input: {
    callId: string
    messageId: string
    sessionId: string
    text: string
  },
) {
  const existing = findToolPart(state, input.messageId, input.callId)
  return upsertPart(state, {
    callID: input.callId,
    id: existing?.id ?? toolPartId(input.callId),
    messageID: input.messageId,
    sessionID: input.sessionId,
    state: {
      input: parseToolInput(input.text),
      raw: input.text,
      status: 'pending',
    },
    tool: existing?.tool ?? 'tool',
    type: 'tool',
  })
}

function startTool(
  state: OpenCodeAdapterState,
  input: {
    callId: string
    input: Record<string, unknown>
    messageId: string
    sessionId: string
    timestamp: number
    tool: string
  },
) {
  const existing = findToolPart(state, input.messageId, input.callId)
  return upsertPart(state, {
    callID: input.callId,
    id: existing?.id ?? toolPartId(input.callId),
    messageID: input.messageId,
    sessionID: input.sessionId,
    state: {
      input: input.input,
      status: 'running',
      time: { start: input.timestamp },
    },
    tool: input.tool,
    type: 'tool',
  })
}

function progressTool(
  state: OpenCodeAdapterState,
  input: {
    callId: string
    content: readonly LlmToolContent[]
    messageId: string
    structured: Record<string, unknown>
    timestamp: number
  },
) {
  const existing = findToolPart(state, input.messageId, input.callId)
  if (!existing) {
    return startTool(state, {
      callId: input.callId,
      input: {},
      messageId: input.messageId,
      sessionId: state.sessionId,
      timestamp: input.timestamp,
      tool: 'tool',
    })
  }

  const toolInput = existing.state.input
  const startedAt =
    existing.state.status === 'running'
      ? existing.state.time.start
      : input.timestamp
  return upsertPart(state, {
    ...existing,
    state: {
      input: toolInput,
      metadata: {
        ...input.structured,
        ...(input.content.length > 0
          ? { progress: toolContentOutput(input.content) }
          : {}),
      },
      status: 'running',
      time: { start: startedAt },
    },
  })
}

function succeedTool(
  state: OpenCodeAdapterState,
  input: {
    callId: string
    content: readonly LlmToolContent[]
    messageId: string
    result?: unknown
    structured: Record<string, unknown>
    timestamp: number
  },
) {
  const existing = findToolPart(state, input.messageId, input.callId)
  const startedAt = toolStartedAt(existing) ?? input.timestamp
  const output = toolResult(input.result, input.structured, input.content)

  return upsertPart(state, {
    callID: input.callId,
    id: existing?.id ?? toolPartId(input.callId),
    messageID: input.messageId,
    sessionID: state.sessionId,
    state: {
      input: existing?.state.input ?? {},
      metadata: input.structured,
      output,
      status: 'completed',
      time: { end: input.timestamp, start: startedAt },
      title: existing?.tool ?? 'Tool',
    },
    tool: existing?.tool ?? 'tool',
    type: 'tool',
  })
}

function failTool(
  state: OpenCodeAdapterState,
  input: {
    callId: string
    error: SessionErrorUnknown
    messageId: string
    timestamp: number
  },
) {
  const existing = findToolPart(state, input.messageId, input.callId)
  return upsertPart(state, {
    callID: input.callId,
    id: existing?.id ?? toolPartId(input.callId),
    messageID: input.messageId,
    sessionID: state.sessionId,
    state: {
      error: input.error.message,
      input: existing?.state.input ?? {},
      status: 'error',
      time: {
        end: input.timestamp,
        start: toolStartedAt(existing) ?? input.timestamp,
      },
    },
    tool: existing?.tool ?? 'tool',
    type: 'tool',
  })
}

function succeedToolByCallId(
  state: OpenCodeAdapterState,
  input: { callId: string; output: string; timestamp: number },
) {
  const match = findToolPartByCallId(state, input.callId)
  if (!match) return state
  return upsertPart(state, {
    ...match,
    state: {
      input: match.state.input,
      metadata: {},
      output: input.output,
      status: 'completed',
      time: {
        end: input.timestamp,
        start: toolStartedAt(match) ?? input.timestamp,
      },
      title: match.tool,
    },
  })
}

function finishAssistantMessage(
  state: OpenCodeAdapterState,
  messageId: string,
  timestamp: number,
  finish: string,
) {
  const record = state.messages[messageId]
  if (record?.info.role !== 'assistant') return state
  return upsertMessage(
    state,
    {
      ...record.info,
      finish,
      time: { ...record.info.time, completed: timestamp },
    },
    'event',
  )
}

function failAssistantMessage(
  state: OpenCodeAdapterState,
  messageId: string,
  timestamp: number,
  error: SessionErrorUnknown,
) {
  const record = state.messages[messageId]
  if (record?.info.role !== 'assistant') return state
  return upsertMessage(
    state,
    {
      ...record.info,
      error: { data: { message: error.message }, name: 'UnknownError' },
      time: { ...record.info.time, completed: timestamp },
    },
    'event',
  )
}

function addRetry(
  state: OpenCodeAdapterState,
  input: {
    attempt: number
    error: {
      isRetryable: boolean
      message: string
      statusCode?: number
    }
    sessionID: string
    timestamp: number
  },
) {
  const messageId = [...state.messageOrder]
    .reverse()
    .find((id) => state.messages[id]?.info.role === 'assistant')
  if (!messageId) return state

  return upsertPart(state, {
    attempt: input.attempt,
    error: {
      data: {
        isRetryable: input.error.isRetryable,
        message: input.error.message,
        ...(input.error.statusCode === undefined
          ? {}
          : { statusCode: input.error.statusCode }),
      },
      name: 'APIError',
    },
    id: `${messageId}:retry:${input.attempt}`,
    messageID: messageId,
    sessionID: input.sessionID,
    time: { created: input.timestamp },
    type: 'retry',
  })
}

function findPart(state: OpenCodeAdapterState, messageId: string, partId: string) {
  return (
    state.messages[messageId]?.parts.find((part) => part.id === partId) ??
    state.orphanParts[messageId]?.find((part) => part.id === partId)
  )
}

function findToolPart(
  state: OpenCodeAdapterState,
  messageId: string,
  callId: string,
) {
  const part =
    state.messages[messageId]?.parts.find(
      (candidate) => candidate.type === 'tool' && candidate.callID === callId,
    ) ??
    state.orphanParts[messageId]?.find(
      (candidate) => candidate.type === 'tool' && candidate.callID === callId,
    )
  return part?.type === 'tool' ? part : undefined
}

function findToolPartByCallId(state: OpenCodeAdapterState, callId: string) {
  for (const record of Object.values(state.messages)) {
    const part = record.parts.find(
      (candidate) => candidate.type === 'tool' && candidate.callID === callId,
    )
    if (part?.type === 'tool') return part
  }
  for (const parts of Object.values(state.orphanParts)) {
    const part = parts.find(
      (candidate) => candidate.type === 'tool' && candidate.callID === callId,
    )
    if (part?.type === 'tool') return part
  }
  return undefined
}

function toolStartedAt(part: Extract<Part, { type: 'tool' }> | undefined) {
  if (!part) return undefined
  return part.state.status === 'running' ||
    part.state.status === 'completed' ||
    part.state.status === 'error'
    ? part.state.time.start
    : undefined
}

function parseToolInput(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function toolResult(
  result: unknown,
  structured: Record<string, unknown>,
  content: readonly LlmToolContent[],
) {
  if (result !== undefined) return stringifyToolValue(result)
  if (Object.keys(structured).length > 0) return stringifyToolValue(structured)
  return toolContentOutput(content)
}

function toolContentOutput(content: readonly LlmToolContent[]) {
  return content
    .map((item) =>
      item.type === 'text'
        ? item.text
        : `${item.name ?? 'File'} (${item.mime}): ${item.uri}`,
    )
    .join('\n')
}

function stringifyToolValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function toolPartId(callId: string) {
  return `tool:${callId}`
}

function compactionPartId(messageId: string) {
  return `${messageId}:compaction`
}

function withoutRevert(state: OpenCodeAdapterState): OpenCodeAdapterState {
  const { revert: _revert, ...rest } = state
  return rest
}

function appendPartDelta(
  state: OpenCodeAdapterState,
  delta: {
    delta: string
    field: string
    messageId: string
    partId: string
  },
) {
  if (delta.field !== 'text') return state

  const record = state.messages[delta.messageId]
  const part = record?.parts.find((candidate) => candidate.id === delta.partId)

  if (record && part && (part.type === 'text' || part.type === 'reasoning')) {
    return {
      ...state,
      messages: {
        ...state.messages,
        [delta.messageId]: {
          ...record,
          parts: record.parts.map((candidate) => {
            if (
              candidate.id === delta.partId &&
              (candidate.type === 'text' || candidate.type === 'reasoning')
            ) {
              return { ...candidate, text: candidate.text + delta.delta }
            }
            return candidate
          }),
        },
      },
    }
  }

  const key = partDeltaKey(delta.messageId, delta.partId, delta.field)
  return {
    ...state,
    pendingDeltas: {
      ...state.pendingDeltas,
      [key]: (state.pendingDeltas[key] ?? '') + delta.delta,
    },
  }
}

function appendToolInputDelta(
  state: OpenCodeAdapterState,
  messageId: string,
  callId: string,
  delta: string,
) {
  const record = state.messages[messageId]
  const part = record?.parts.find(
    (candidate) => candidate.type === 'tool' && candidate.callID === callId,
  )

  if (!record || part?.type !== 'tool' || part.state.status !== 'pending') {
    const key = partDeltaKey(messageId, callId, 'tool-input')
    return {
      ...state,
      pendingDeltas: {
        ...state.pendingDeltas,
        [key]: (state.pendingDeltas[key] ?? '') + delta,
      },
    }
  }

  return {
    ...state,
    messages: {
      ...state.messages,
      [messageId]: {
        ...record,
        parts: record.parts.map((candidate) => {
          if (
            candidate.id === part.id &&
            candidate.type === 'tool' &&
            candidate.state.status === 'pending'
          ) {
            return {
              ...candidate,
              state: { ...candidate.state, raw: candidate.state.raw + delta },
            }
          }
          return candidate
        }),
      },
    },
  }
}

function upsertPartInList(
  parts: readonly Part[],
  part: Part,
  preserveExisting: boolean,
) {
  const index = parts.findIndex(
    (candidate) =>
      candidate.id === part.id ||
      (candidate.type === 'tool' &&
        part.type === 'tool' &&
        candidate.callID === part.callID),
  )
  if (index === -1) return [...parts, part]
  if (preserveExisting) return parts

  const next = [...parts]
  next[index] = part
  return next
}

function mergeParts(left: readonly Part[], right: readonly Part[]) {
  let parts: readonly Part[] = left
  for (const part of right) parts = upsertPartInList(parts, part, false)
  return parts
}

function applyPendingDelta(part: Part, delta: string): Part {
  if (part.type === 'text' || part.type === 'reasoning') {
    return part.text ? part : { ...part, text: delta }
  }

  if (part.type === 'tool' && part.state.status === 'pending') {
    return part.state.raw
      ? part
      : { ...part, state: { ...part.state, raw: delta } }
  }

  return part
}

function partDeltaKey(messageId: string, partId: string, field: string) {
  return `${messageId}\u0000${partId}\u0000${field}`
}

function sortMessageOrder(
  order: readonly string[],
  messages: Readonly<Record<string, OpenCodeMessageRecord>>,
) {
  return [...order].sort((leftId, rightId) => {
    const left = messages[leftId]?.info
    const right = messages[rightId]?.info
    const time = (left?.time.created ?? 0) - (right?.time.created ?? 0)
    return time === 0 ? leftId.localeCompare(rightId) : time
  })
}

function addRequest(
  state: OpenCodeAdapterState,
  request: ChatRequest,
): OpenCodeAdapterState {
  const existing = state.requests.findIndex((item) => item.id === request.id)
  const requests = [...state.requests]

  if (existing === -1) requests.push(request)
  else requests[existing] = request

  return {
    ...state,
    nextRequestOrder:
      existing === -1 ? state.nextRequestOrder + 1 : state.nextRequestOrder,
    requests,
  }
}

function permissionRequest(
  state: OpenCodeAdapterState,
  request: {
    action: string
    id: string
    resources: readonly string[]
    save?: readonly string[]
    sessionId: string
  },
): ChatRequest {
  const resourceText = request.resources.filter(Boolean).join(', ')
  return {
    consequence: permissionConsequence(request.action),
    effect: resourceText
      ? `${humanize(request.action)}: ${resourceText}`
      : humanize(request.action),
    id: request.id,
    order: state.nextRequestOrder,
    origin: { sessionId: request.sessionId },
    ...(request.save?.length
      ? { scope: `Can be remembered for ${request.save.join(', ')}` }
      : {}),
    state: { status: 'pending' },
    title: humanize(request.action),
    type: 'permission',
  }
}

function questionRequest(
  state: OpenCodeAdapterState,
  id: string,
  sessionId: string,
  questions: readonly QuestionInfo[],
): QuestionRequestView {
  return {
    id,
    order: state.nextRequestOrder,
    origin: { sessionId },
    questions: questions.map((question, questionIndex) =>
      mapQuestion(id, question, questionIndex),
    ),
    state: { status: 'pending' },
    type: 'question',
  }
}

function mapQuestion(
  requestId: string,
  question: QuestionInfo,
  questionIndex: number,
): QuestionView {
  const id = `${requestId}:question:${questionIndex}`
  if (question.options.length === 0 && question.custom) {
    return {
      id,
      label: question.question,
      required: true,
      type: 'text',
    }
  }

  return {
    allowCustom: question.custom ?? false,
    id,
    label: question.question,
    options: question.options.map((option, optionIndex) => ({
      description: option.description,
      id: `${id}:option:${optionIndex}`,
      label: option.label,
    })),
    required: true,
    type: question.multiple ? 'multiple-choice' : 'single-choice',
  }
}

function resolvePermission(
  state: OpenCodeAdapterState,
  requestId: string,
  decision: PermissionDecision,
): OpenCodeAdapterState {
  return {
    ...state,
    requests: state.requests.map((request) =>
      request.type === 'permission' && request.id === requestId
        ? { ...request, state: { decision, status: 'resolved' } }
        : request,
    ),
  }
}

function resolveQuestion(
  state: OpenCodeAdapterState,
  requestId: string,
  answers: readonly (readonly string[])[] | 'reject',
): OpenCodeAdapterState {
  return {
    ...state,
    requests: state.requests.map((request) => {
      if (request.type !== 'question' || request.id !== requestId) return request

      const decision: QuestionDecision =
        answers === 'reject'
          ? { type: 'reject' }
          : { response: questionResponse(request, answers), type: 'answer' }
      return { ...request, state: { decision, status: 'resolved' } }
    }),
  }
}

function questionResponse(
  request: QuestionRequestView,
  answers: readonly (readonly string[])[],
): QuestionResponse {
  const mapped: QuestionAnswer[] = []

  for (const [index, question] of request.questions.entries()) {
    const values = answers[index] ?? []
    if (question.type === 'text') {
      mapped.push({
        questionId: question.id,
        type: 'text',
        value: values.join('\n'),
      })
      continue
    }

    const optionIds = question.options
      .filter((option) => values.includes(option.label))
      .map((option) => option.id)
    const optionLabels = new Set(question.options.map((option) => option.label))
    const customValue = values.find((value) => !optionLabels.has(value))
    mapped.push({
      ...(customValue === undefined ? {} : { customValue }),
      optionIds,
      questionId: question.id,
      type: 'choice',
    })
  }

  return { answers: mapped }
}

function mapTodos(sessionId: string, todos: readonly Todo[]): TodoListView {
  const items = todos.map((todo, index) => ({
    id: `${sessionId}:todo:${index}`,
    state: mapTodoStatus(todo.status),
    title: todo.content,
  }))
  return {
    id: `${sessionId}:todos`,
    items,
    state: items.every(
      (item) => item.state === 'complete' || item.state === 'cancelled',
    )
      ? 'complete'
      : 'active',
  }
}

function mapTodoStatus(status: string): TodoListView['items'][number]['state'] {
  switch (status) {
    case 'in_progress':
      return 'in-progress'
    case 'completed':
      return 'complete'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function permissionConsequence(
  action: string,
): 'reversible' | 'destructive' | 'external' {
  if (/delete|remove|reset|destroy/i.test(action)) return 'destructive'
  if (/web|network|publish|share|external/i.test(action)) return 'external'
  return 'reversible'
}

function humanize(value: string) {
  const words = value.replace(/[._-]+/g, ' ').trim()
  return words
    ? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
    : 'Permission required'
}

function withoutSessionError(
  state: OpenCodeAdapterState,
): OpenCodeAdapterState {
  const { sessionError: _sessionError, ...rest } = state
  return rest
}

function withTodos(
  state: OpenCodeAdapterState,
  todos: readonly Todo[],
): OpenCodeAdapterState {
  if (todos.length > 0) return { ...state, todos: mapTodos(state.sessionId, todos) }

  const { todos: _todos, ...rest } = state
  return rest
}

export function mapOpenCodeError(error: unknown): ChatError {
  if (!error || typeof error !== 'object') {
    return {
      kind: 'unknown',
      message: 'The OpenCode session failed.',
      retryable: false,
    }
  }

  const value = error as {
    data?: { isRetryable?: boolean; message?: string }
    name?: string
  }
  return {
    ...(value.name ? { code: value.name } : {}),
    kind: 'provider',
    message: value.data?.message ?? 'The OpenCode provider failed.',
    retryable: value.data?.isRetryable ?? false,
  }
}
