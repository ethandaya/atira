import type { ComposerDraft } from '@pretty-amped/foundations/chat'
import { validateComposerDraft } from '@pretty-amped/foundations/chat-invariants'
import { describe, expect, it } from 'vitest'
import {
  editableDraftText,
  insertDraftReference,
  projectTextareaEdit,
  removeDraftReference,
} from './composer-draft'

const reference = {
  id: 'ref',
  label: 'file.ts',
  referenceType: 'file' as const,
  type: 'reference' as const,
  value: '/file.ts',
}

function draft(anchor = 2, focus = anchor): ComposerDraft {
  return {
    attachments: [],
    mode: 'prompt',
    revision: 3,
    segments: [
      { id: 'before', text: 'abcd', type: 'text' },
      reference,
      { id: 'after', text: 'wxyz', type: 'text' },
    ],
    selection: {
      anchor: { offset: anchor, segmentId: 'before' },
      focus: { offset: focus, segmentId: 'before' },
    },
  }
}

describe('composer draft editing projection', () => {
  it('edits asymmetric text on either side without moving the reference', () => {
    const before = projectTextareaEdit(draft(), 'ab!cdwxyz', { anchor: 3, focus: 3 })
    const after = projectTextareaEdit(
      { ...draft(), selection: { anchor: { offset: 2, segmentId: 'after' }, focus: { offset: 2, segmentId: 'after' } } },
      'abcdwx!yz',
      { anchor: 7, focus: 7 },
    )

    expect(before.segments).toEqual([
      { id: 'before', text: 'ab!cd', type: 'text' },
      reference,
      { id: 'after', text: 'wxyz', type: 'text' },
    ])
    expect(after.segments).toEqual([
      { id: 'before', text: 'abcd', type: 'text' },
      reference,
      { id: 'after', text: 'wx!yz', type: 'text' },
    ])
  })

  it('updates selection without mutating segments or revision and preserves backward ranges', () => {
    const original = draft()
    const selected = projectTextareaEdit(original, 'abcdwxyz', { anchor: 7, focus: 1 })

    expect(selected.segments).toBe(original.segments)
    expect(selected.revision).toBe(3)
    expect(selected.selection).toEqual({
      anchor: { offset: 3, segmentId: 'after' },
      focus: { offset: 1, segmentId: 'before' },
    })
  })

  it('uses the old selection to disambiguate repeated text replacement', () => {
    const original = draft(1, 3)
    const edited = projectTextareaEdit(original, 'axadwxyz', { anchor: 2, focus: 2 })

    expect(edited.segments[0]).toEqual({ id: 'before', text: 'axad', type: 'text' })
  })

  it('inserts a reference in the middle by splitting the active text segment', () => {
    const inserted = insertDraftReference(draft(), 2, { ...reference, id: 'new-ref' })

    expect(inserted.segments).toEqual([
      { id: 'before', text: 'ab', type: 'text' },
      { ...reference, id: 'new-ref' },
      { id: 'before-after-4', text: 'cd', type: 'text' },
      reference,
      { id: 'after', text: 'wxyz', type: 'text' },
    ])
    expect(inserted.selection.anchor).toEqual({ offset: 0, segmentId: 'before-after-4' })
    expect(validateComposerDraft(inserted)).toEqual([])
  })

  it('repairs selection points when removing a selected reference', () => {
    const selectedReference = {
      ...draft(),
      selection: {
        anchor: { offset: 0, segmentId: 'ref' },
        focus: { offset: 1, segmentId: 'ref' },
      },
    }
    const removed = removeDraftReference(selectedReference, 'ref')

    expect(removed.segments).not.toContain(reference)
    expect(removed.selection).toEqual({
      anchor: { offset: 0, segmentId: 'after' },
      focus: { offset: 0, segmentId: 'after' },
    })
    expect(validateComposerDraft(removed)).toEqual([])
  })

  it('retains ordered restored draft content for submission', () => {
    const restored = draft()
    const edited = projectTextareaEdit(restored, 'ABCDwxyz!', { anchor: 9, focus: 9 })

    expect(editableDraftText(edited)).toBe('ABCDwxyz!')
    expect(edited.segments[1]).toBe(reference)
    expect(validateComposerDraft(edited)).toEqual([])
  })
})
