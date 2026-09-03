// @vitest-environment jsdom

import type {
  ChatCapabilities,
  ChatMessage,
  ComposerDraft,
  PermissionRequestView,
  QuestionRequestView,
  ToolPart,
} from '@pretty-amped/foundations/chat'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  keyframes: () => '',
  props: () => ({}),
}))

import { ChatComposer } from './chat-composer'
import { MessageParts } from './message-parts'
import { PermissionPrompt, QuestionRequest } from './requests'

afterEach(cleanup)

describe('chat components', () => {
  it('uses a specialized tool renderer and a lossless generic fallback', () => {
    const read = toolPart('read', { kind: 'context', operation: 'read' })
    const unknown = toolPart('mcp_custom', { kind: 'generic' })
    const message: ChatMessage = {
      createdAt: 1,
      delivery: { status: 'confirmed' },
      id: 'assistant',
      parts: [read, unknown],
      role: 'assistant',
      turnId: 'turn',
    }

    const { container } = render(<MessageParts message={message} />)

    expect(container.querySelector('[data-renderer="generic"]')).not.toBeNull()
    expect(screen.getByText('Read /workspace/app.tsx')).not.toBeNull()
    expect(screen.getByText('Mcp custom')).not.toBeNull()
  })

  it('publishes the exact permission decision', async () => {
    const onDecision = vi.fn()
    const request: PermissionRequestView = {
      consequence: 'external',
      effect: 'Fetch https://example.com',
      id: 'permission',
      order: 0,
      origin: { sessionId: 'session' },
      state: { status: 'pending' },
      title: 'Use the network?',
      type: 'permission',
    }
    render(<PermissionPrompt onDecision={onDecision} request={request} />)

    await userEvent.click(screen.getByRole('button', { name: 'Always allow' }))

    expect(onDecision).toHaveBeenCalledOnce()
    expect(onDecision).toHaveBeenCalledWith('always')
  })

  it('returns stable question and option IDs', async () => {
    const onAnswer = vi.fn()
    const request: QuestionRequestView = {
      id: 'question-request',
      order: 0,
      origin: { sessionId: 'session' },
      questions: [
        {
          allowCustom: false,
          id: 'framework',
          label: 'Choose a framework',
          options: [
            { id: 'stylex', label: 'StyleX' },
            { id: 'tailwind', label: 'Tailwind' },
          ],
          required: true,
          type: 'single-choice',
        },
      ],
      state: { status: 'pending' },
      type: 'question',
    }
    render(<QuestionRequest onAnswer={onAnswer} request={request} />)

    await userEvent.click(screen.getByRole('radio', { name: 'StyleX' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(onAnswer).toHaveBeenCalledWith({
      answers: [
        { optionIds: ['stylex'], questionId: 'framework', type: 'choice' },
      ],
    })
  })

  it('does not submit a composing keyboard event', () => {
    const onSubmit = vi.fn()
    render(
      <ChatComposer
        activity={{ status: 'idle' }}
        capabilities={capabilities}
        draft={draft}
        onDraftChange={() => undefined}
        onStop={() => undefined}
        onSubmit={onSubmit}
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Message' })

    fireEvent.keyDown(input, {
      ctrlKey: true,
      isComposing: true,
      key: 'Enter',
    })

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

const capabilities: ChatCapabilities = {
  agents: [],
  busySubmission: ['queue'],
  canAttach: true,
  canStop: true,
  canSubmit: true,
  canUseShell: true,
  models: [],
  permissionDecisions: ['once', 'always', 'reject'],
  referenceTypes: ['file'],
  variants: [],
}

const draft: ComposerDraft = {
  attachments: [],
  mode: 'prompt',
  revision: 0,
  segments: [{ id: 'text', text: 'Hello', type: 'text' }],
  selection: {
    anchor: { offset: 5, segmentId: 'text' },
    focus: { offset: 5, segmentId: 'text' },
  },
}

function toolPart(
  toolName: string,
  presentation: ToolPart['presentation'],
): ToolPart {
  return {
    callId: `${toolName}-call`,
    id: `${toolName}-part`,
    presentation,
    state: {
      endedAt: 2,
      input: { filePath: '/workspace/app.tsx' },
      output: 'result',
      status: 'succeeded',
    },
    toolName,
    type: 'tool',
  }
}
