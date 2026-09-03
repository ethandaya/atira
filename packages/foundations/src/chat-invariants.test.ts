import { describe, expect, it } from 'vitest'

import type {
  ChatError,
  ChatRequest,
  ComposerDraft,
} from './chat'
import {
  composerDraftText,
  isTerminalToolState,
  isTerminalTurnState,
  selectActiveRequest,
  validateComposerDraft,
} from './chat-invariants'

const error: ChatError = {
  kind: 'mutation',
  message: 'Request failed.',
  retryable: true,
}

function draft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    attachments: [],
    mode: 'prompt',
    revision: 1,
    segments: [{ id: 'text', text: 'Inspect ', type: 'text' }],
    selection: {
      anchor: { offset: 8, segmentId: 'text' },
      focus: { offset: 8, segmentId: 'text' },
    },
    ...overrides,
  }
}

describe('validateComposerDraft', () => {
  it('accepts a valid structured draft', () => {
    expect(validateComposerDraft(draft())).toEqual([])
  })

  it('reports missing text, duplicate IDs, and invalid selection points', () => {
    expect(
      validateComposerDraft(
        draft({
          segments: [
            {
              id: 'ref',
              label: 'app.tsx',
              referenceType: 'file',
              type: 'reference',
              value: 'src/app.tsx',
            },
            {
              id: 'ref',
              label: 'button.tsx',
              referenceType: 'file',
              type: 'reference',
              value: 'src/button.tsx',
            },
          ],
          selection: {
            anchor: { offset: 2, segmentId: 'ref' },
            focus: { offset: 0, segmentId: 'missing' },
          },
        }),
      ),
    ).toEqual([
      { code: 'missing-text-segment' },
      { code: 'duplicate-segment-id', segmentId: 'ref' },
      { code: 'invalid-selection-offset', point: 'anchor' },
      { code: 'unknown-selection-segment', point: 'focus' },
    ])
  })
})

describe('selectActiveRequest', () => {
  it('prefers permissions, then stable server order', () => {
    const requests: ChatRequest[] = [
      {
        id: 'question',
        order: 0,
        origin: { sessionId: 'session' },
        questions: [],
        state: { status: 'pending' },
        type: 'question',
      },
      {
        consequence: 'external',
        effect: 'Publish a comment.',
        id: 'permission-b',
        order: 2,
        origin: { sessionId: 'child' },
        state: { error, decision: 'once', status: 'failed' },
        title: 'Publish comment',
        type: 'permission',
      },
      {
        consequence: 'reversible',
        effect: 'Read a file.',
        id: 'permission-a',
        order: 1,
        origin: { sessionId: 'session' },
        state: { status: 'pending' },
        title: 'Read file',
        type: 'permission',
      },
    ]

    expect(selectActiveRequest(requests)?.id).toBe('permission-a')
  })

  it('ignores resolved and expired requests', () => {
    expect(
      selectActiveRequest([
        {
          consequence: 'reversible',
          effect: 'Read a file.',
          id: 'resolved',
          order: 0,
          origin: { sessionId: 'session' },
          state: { decision: 'once', status: 'resolved' },
          title: 'Read file',
          type: 'permission',
        },
      ]),
    ).toBeUndefined()
  })
})

describe('chat state helpers', () => {
  it('identifies terminal tool and turn states', () => {
    expect(
      isTerminalToolState({ endedAt: 1, input: null, status: 'succeeded' }),
    ).toBe(true)
    expect(
      isTerminalToolState({ input: null, startedAt: 1, status: 'running' }),
    ).toBe(false)
    expect(
      isTerminalTurnState({ endedAt: 2, startedAt: 1, status: 'complete' }),
    ).toBe(true)
    expect(isTerminalTurnState({ startedAt: 1, status: 'running' })).toBe(
      false,
    )
  })

  it('serializes references to a readable plain-text fallback', () => {
    expect(
      composerDraftText(
        draft({
          segments: [
            { id: 'a', text: 'Inspect ', type: 'text' },
            {
              id: 'b',
              label: 'app.tsx',
              referenceType: 'file',
              type: 'reference',
              value: 'src/app.tsx',
            },
            { id: 'c', text: ' first.', type: 'text' },
          ],
        }),
      ),
    ).toBe('Inspect @app.tsx first.')
  })
})
