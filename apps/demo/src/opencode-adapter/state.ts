import type {
  Event,
  Message,
  Part,
  QuestionInfo,
  SessionStatus,
  Todo,
} from '@opencode-ai/sdk/v2'
import type {
  ChatError,
  ChatRequest,
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
  info: Message
  parts: readonly Part[]
  source: 'event' | 'page'
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
    if (!existing) {
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

function upsertMessage(
  state: OpenCodeAdapterState,
  info: Message,
  source: OpenCodeMessageRecord['source'],
): OpenCodeAdapterState {
  if (state.messageTombstones.has(info.id)) return state

  const existing = state.messages[info.id]
  const orphanParts = state.orphanParts[info.id] ?? []
  const record: OpenCodeMessageRecord = {
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
  const index = parts.findIndex((candidate) => candidate.id === part.id)
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
