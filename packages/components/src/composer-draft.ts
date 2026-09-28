import type {
  ComposerDraft,
  DraftPoint,
  DraftSegment,
} from '@atiraui/foundations/chat'

type EditableSelection = Readonly<{
  anchor: number
  focus: number
}>

export function editableDraftText(draft: ComposerDraft) {
  return draft.segments
    .filter(
      (segment): segment is Extract<DraftSegment, { type: 'text' }> =>
        segment.type === 'text',
    )
    .map((segment) => segment.text)
    .join('')
}

export function editableSelection(draft: ComposerDraft): {
  direction: 'backward' | 'forward' | 'none'
  end: number
  start: number
} {
  const anchor = editablePointOffset(draft, draft.selection.anchor)
  const focus = editablePointOffset(draft, draft.selection.focus)
  return {
    direction:
      anchor === focus ? 'none' : anchor > focus ? 'backward' : 'forward',
    end: Math.max(anchor, focus),
    start: Math.min(anchor, focus),
  }
}

export function projectTextareaEdit(
  draft: ComposerDraft,
  text: string,
  selection: EditableSelection,
): ComposerDraft {
  const oldText = editableDraftText(draft)
  if (text === oldText) {
    return withSelection(draft, selection, draft.selection)
  }

  const replacement = inferReplacement(draft, oldText, text)
  const insertionSegmentId = insertionOwner(draft, replacement.start)
  let inserted = false
  let offset = 0
  const segments = draft.segments.map((segment) => {
    if (segment.type !== 'text') return segment
    const start = offset
    const end = start + segment.text.length
    offset = end
    const before = segment.text.slice(0, Math.max(0, replacement.start - start))
    const after = segment.text.slice(Math.max(0, replacement.end - start))
    const ownsInsertion = segment.id === insertionSegmentId
    if (ownsInsertion) inserted = true
    if (replacement.end < start || replacement.start > end) return segment
    return {
      ...segment,
      text: `${before}${ownsInsertion ? replacement.inserted : ''}${after}`,
    }
  })

  if (!inserted) {
    const id = `text-${draft.revision + 1}`
    segments.push({ id, text: replacement.inserted, type: 'text' })
  }

  const changed = { ...draft, revision: draft.revision + 1, segments }
  return withSelection(changed, selection, {
    anchor: { offset: 0, segmentId: insertionSegmentId },
    focus: { offset: 0, segmentId: insertionSegmentId },
  })
}

export function insertDraftReference(
  draft: ComposerDraft,
  offset: number,
  reference: Extract<DraftSegment, { type: 'reference' }>,
): ComposerDraft {
  const ownerId = insertionOwner(draft, offset)
  let textOffset = 0
  let rightId = ownerId
  const segments: DraftSegment[] = []

  for (const segment of draft.segments) {
    if (segment.type !== 'text') {
      segments.push(segment)
      continue
    }
    const end = textOffset + segment.text.length
    if (segment.id !== ownerId) {
      segments.push(segment)
      textOffset = end
      continue
    }
    const local = Math.max(
      0,
      Math.min(segment.text.length, offset - textOffset),
    )
    rightId = uniqueSegmentId(
      draft,
      `${segment.id}-after-${draft.revision + 1}`,
    )
    segments.push(
      { ...segment, text: segment.text.slice(0, local) },
      reference,
      { id: rightId, text: segment.text.slice(local), type: 'text' },
    )
    textOffset = end
  }

  return {
    ...draft,
    revision: draft.revision + 1,
    segments,
    selection: {
      anchor: { offset: 0, segmentId: rightId },
      focus: { offset: 0, segmentId: rightId },
    },
  }
}

export function removeDraftReference(draft: ComposerDraft, segmentId: string) {
  const index = draft.segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return draft
  const fallback = [
    ...draft.segments.slice(index + 1),
    ...draft.segments.slice(0, index).reverse(),
  ].find((segment) => segment.type === 'text')
  if (!fallback) return draft
  const replacePoint = (point: DraftPoint): DraftPoint =>
    point.segmentId === segmentId
      ? { offset: 0, segmentId: fallback.id }
      : point
  return {
    ...draft,
    revision: draft.revision + 1,
    segments: draft.segments.filter((segment) => segment.id !== segmentId),
    selection: {
      anchor: replacePoint(draft.selection.anchor),
      focus: replacePoint(draft.selection.focus),
    },
  }
}

function inferReplacement(draft: ComposerDraft, oldText: string, text: string) {
  const oldSelection = editableSelection(draft)
  const selectedReplacementLength =
    text.length - (oldText.length - oldSelection.end + oldSelection.start)
  if (
    selectedReplacementLength >= 0 &&
    oldText.slice(0, oldSelection.start) ===
      text.slice(0, oldSelection.start) &&
    oldText.slice(oldSelection.end) ===
      text.slice(oldSelection.start + selectedReplacementLength)
  ) {
    return {
      end: oldSelection.end,
      inserted: text.slice(
        oldSelection.start,
        oldSelection.start + selectedReplacementLength,
      ),
      start: oldSelection.start,
    }
  }

  let start = 0
  while (
    start < oldText.length &&
    start < text.length &&
    oldText[start] === text[start]
  )
    start++
  let suffix = 0
  while (
    suffix < oldText.length - start &&
    suffix < text.length - start &&
    oldText[oldText.length - suffix - 1] === text[text.length - suffix - 1]
  )
    suffix++
  return {
    end: oldText.length - suffix,
    inserted: text.slice(start, text.length - suffix),
    start,
  }
}

function withSelection(
  draft: ComposerDraft,
  selection: EditableSelection,
  preferred: ComposerDraft['selection'],
): ComposerDraft {
  const anchor = pointAtOffset(
    draft,
    selection.anchor,
    preferred.anchor.segmentId,
  )
  const focus = pointAtOffset(draft, selection.focus, preferred.focus.segmentId)
  if (
    anchor.segmentId === draft.selection.anchor.segmentId &&
    anchor.offset === draft.selection.anchor.offset &&
    focus.segmentId === draft.selection.focus.segmentId &&
    focus.offset === draft.selection.focus.offset
  )
    return draft
  return { ...draft, selection: { anchor, focus } }
}

function pointAtOffset(
  draft: ComposerDraft,
  target: number,
  preferredId?: string,
): DraftPoint {
  let offset = 0
  let lastText: Extract<DraftSegment, { type: 'text' }> | undefined
  for (const segment of draft.segments) {
    if (segment.type !== 'text') continue
    const end = offset + segment.text.length
    if (target < end || (target === end && segment.id === preferredId)) {
      return { offset: Math.max(0, target - offset), segmentId: segment.id }
    }
    if (target === offset && segment.id === preferredId)
      return { offset: 0, segmentId: segment.id }
    offset = end
    lastText = segment
  }
  return lastText
    ? { offset: lastText.text.length, segmentId: lastText.id }
    : { offset: 0, segmentId: preferredId ?? '' }
}

function editablePointOffset(draft: ComposerDraft, point: DraftPoint) {
  let offset = 0
  for (const segment of draft.segments) {
    if (segment.id === point.segmentId) {
      return segment.type === 'text'
        ? offset + Math.min(point.offset, segment.text.length)
        : offset
    }
    if (segment.type === 'text') offset += segment.text.length
  }
  return editableDraftText(draft).length
}

function insertionOwner(draft: ComposerDraft, target: number) {
  const preferred =
    editablePointOffset(draft, draft.selection.focus) === target
      ? draft.selection.focus.segmentId
      : editablePointOffset(draft, draft.selection.anchor) === target
        ? draft.selection.anchor.segmentId
        : undefined
  let offset = 0
  let last = ''
  for (const segment of draft.segments) {
    if (segment.type !== 'text') continue
    const end = offset + segment.text.length
    if (target < end || (target === end && segment.id === preferred))
      return segment.id
    if (target === offset && segment.id === preferred) return segment.id
    offset = end
    last = segment.id
  }
  return last
}

function uniqueSegmentId(draft: ComposerDraft, base: string) {
  const ids = new Set(draft.segments.map((segment) => segment.id))
  let id = base
  let suffix = 2
  while (ids.has(id)) id = `${base}-${suffix++}`
  return id
}
