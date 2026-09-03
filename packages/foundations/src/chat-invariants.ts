import type {
  ChatRequest,
  ComposerDraft,
  DraftPoint,
  DraftSegment,
  ToolState,
  TurnState,
} from './chat'

export type DraftIssue =
  | { code: 'missing-text-segment' }
  | { code: 'duplicate-segment-id'; segmentId: string }
  | { code: 'unknown-selection-segment'; point: 'anchor' | 'focus' }
  | { code: 'invalid-selection-offset'; point: 'anchor' | 'focus' }

export function validateComposerDraft(
  draft: ComposerDraft,
): readonly DraftIssue[] {
  const issues: DraftIssue[] = []
  const segments = new Map<string, DraftSegment>()

  if (!draft.segments.some((segment) => segment.type === 'text')) {
    issues.push({ code: 'missing-text-segment' })
  }

  for (const segment of draft.segments) {
    if (segments.has(segment.id)) {
      issues.push({ code: 'duplicate-segment-id', segmentId: segment.id })
    }

    segments.set(segment.id, segment)
  }

  validatePoint('anchor', draft.selection.anchor, segments, issues)
  validatePoint('focus', draft.selection.focus, segments, issues)
  return issues
}

function validatePoint(
  pointName: 'anchor' | 'focus',
  point: DraftPoint,
  segments: ReadonlyMap<string, DraftSegment>,
  issues: DraftIssue[],
) {
  const segment = segments.get(point.segmentId)

  if (!segment) {
    issues.push({ code: 'unknown-selection-segment', point: pointName })
    return
  }

  const maximumOffset = segment.type === 'text' ? segment.text.length : 1
  if (
    !Number.isInteger(point.offset) ||
    point.offset < 0 ||
    point.offset > maximumOffset
  ) {
    issues.push({ code: 'invalid-selection-offset', point: pointName })
  }
}

export function selectActiveRequest(
  requests: readonly ChatRequest[],
): ChatRequest | undefined {
  return [...requests]
    .filter(
      (request) =>
        request.state.status === 'pending' ||
        request.state.status === 'submitting' ||
        request.state.status === 'failed',
    )
    .sort((left, right) => {
      const priority = requestPriority(left) - requestPriority(right)
      if (priority !== 0) return priority

      const order = left.order - right.order
      return order === 0 ? left.id.localeCompare(right.id) : order
    })[0]
}

function requestPriority(request: ChatRequest) {
  return request.type === 'permission' ? 0 : 1
}

export function isTerminalToolState(state: ToolState) {
  return (
    state.status === 'succeeded' ||
    state.status === 'failed' ||
    state.status === 'cancelled'
  )
}

export function isTerminalTurnState(state: TurnState) {
  return (
    state.status === 'complete' ||
    state.status === 'interrupted' ||
    state.status === 'failed'
  )
}

export function composerDraftText(draft: ComposerDraft) {
  return draft.segments
    .map((segment) =>
      segment.type === 'text' ? segment.text : `@${segment.label}`,
    )
    .join('')
}
