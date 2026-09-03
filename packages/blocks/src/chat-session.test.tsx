// @vitest-environment jsdom

import type {
  ChatSnapshot,
  ChatStore,
  ComposerDraft,
} from '@pretty-amped/foundations/chat'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  keyframes: () => '',
  props: () => ({}),
}))

import { ChatSession } from './chat-session'

afterEach(cleanup)

describe('ChatSession', () => {
  it('routes session, turn, and child-tool actions through controlled callbacks', async () => {
    const store = chatStore(snapshot)
    const onOpenChild = vi.fn()
    render(
      <ChatSession
        label="OpenCode session"
        onOpenChild={onOpenChild}
        store={store}
      />,
    )

    expect(
      document.querySelector('[data-slot="chat-session"]')?.getAttribute(
        'data-session-id',
      ),
    ).toBe('session')

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(store.submit).toHaveBeenCalledWith(snapshot.composer, 'send')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revert prompt turn' }),
    )
    expect(store.revert).toHaveBeenCalledWith('turn')

    await userEvent.click(
      screen.getByRole('button', { name: /Run child task.*Task agent/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Open child session' }),
    )
    expect(onOpenChild).toHaveBeenCalledWith('child-session')
  })
})

const composer: ComposerDraft = {
  attachments: [],
  mode: 'prompt',
  revision: 0,
  segments: [{ id: 'text', text: 'Inspect this.', type: 'text' }],
  selection: {
    anchor: { offset: 13, segmentId: 'text' },
    focus: { offset: 13, segmentId: 'text' },
  },
}

const snapshot: ChatSnapshot = {
  activity: { status: 'idle' },
  capabilities: {
    agents: [],
    busySubmission: ['queue', 'follow-up'],
    canAttach: false,
    canStop: true,
    canSubmit: true,
    canUseShell: false,
    models: [],
    permissionDecisions: ['once', 'always', 'reject'],
    referenceTypes: [],
    variants: [],
  },
  composer,
  connection: { status: 'connected' },
  history: { status: 'complete' },
  queue: [],
  requests: [],
  sessionId: 'session',
  turns: [
    {
      assistant: [
        {
          createdAt: 2,
          delivery: { status: 'confirmed' },
          id: 'assistant',
          parts: [
            {
              callId: 'task-call',
              id: 'task-part',
              presentation: {
                agent: { id: 'task', label: 'Task agent' },
                childSessionId: 'child-session',
                kind: 'task',
              },
              state: {
                endedAt: 3,
                input: { description: 'Run child task' },
                output: 'Done',
                status: 'succeeded',
              },
              toolName: 'task',
              type: 'tool',
            },
          ],
          role: 'assistant',
          turnId: 'turn',
        },
      ],
      id: 'turn',
      state: { endedAt: 3, startedAt: 1, status: 'complete' },
      user: {
        createdAt: 1,
        delivery: { status: 'confirmed' },
        id: 'turn',
        parts: [
          {
            id: 'user-text',
            markdown: 'Inspect this.',
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'user',
        turnId: 'turn',
      },
    },
  ],
}

function chatStore(value: ChatSnapshot): ChatStore {
  return {
    answerQuestion: vi.fn(async () => undefined),
    decidePermission: vi.fn(async () => undefined),
    dismissReverted: vi.fn(async () => undefined),
    dismissSubmissionError: vi.fn(),
    editQueued: vi.fn(),
    getSnapshot: () => value,
    loadPrevious: vi.fn(async () => undefined),
    reconnect: vi.fn(async () => undefined),
    redoReverted: vi.fn(async () => undefined),
    rejectQuestion: vi.fn(async () => undefined),
    removeQueued: vi.fn(),
    restoreReverted: vi.fn(async () => undefined),
    retryQueued: vi.fn(async () => undefined),
    retrySubmission: vi.fn(async () => undefined),
    revert: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    submit: vi.fn(async () => undefined),
    subscribe: () => () => undefined,
    updateDraft: vi.fn(),
    updateQueue: vi.fn(),
  }
}
