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
import { FileChangeTool, ShellTool, TaskTool } from './chat-tools'
import { MessageParts } from './message-parts'
import {
  PermissionPrompt,
  QuestionAnswerSummary,
  QuestionRequest,
  RequestRegion,
  RevertDock,
} from './requests'
import { Turn } from './turn'

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
    expect(screen.getByText('Custom tool')).not.toBeNull()
  })

  it('renders subagents as compact tasks with optional child navigation', async () => {
    const onOpenChild = vi.fn()
    const part: ToolPart = {
      callId: 'subagent-call',
      id: 'subagent-part',
      presentation: {
        agent: { id: 'review', label: 'Review agent' },
        childSessionId: 'child-session',
        kind: 'task',
      },
      state: {
        endedAt: 2,
        input: { description: 'Check alignment' },
        output: 'Looks good.',
        status: 'succeeded',
      },
      toolName: 'run_subagent',
      type: 'tool',
    }
    const { container } = render(
      <TaskTool onOpenChild={onOpenChild} part={part} />,
    )

    expect(container.textContent).toContain('Review agent · Check alignment')
    expect(container.textContent).not.toContain('run_subagent')
    expect(container.textContent).not.toContain('Looks good.')
    await userEvent.click(
      screen.getByRole('button', { name: /Review agent · Check alignment/ }),
    )
    expect(container.textContent).toContain('Looks good.')
    await userEvent.click(screen.getByRole('button', { name: 'Open child session' }))
    expect(onOpenChild).toHaveBeenCalledWith('child-session')
  })

  it('shows only one turn-level activity indicator', () => {
    const runningTurn = {
      assistant: [
        {
          createdAt: 2,
          delivery: { status: 'confirmed' as const },
          id: 'assistant',
          parts: [
            {
              callId: 'search-call',
              id: 'search-part',
              presentation: { kind: 'web' as const, operation: 'search' as const },
              state: {
                input: { query: 'StyleX' },
                startedAt: 2,
                status: 'running' as const,
              },
              toolName: 'search_web',
              type: 'tool' as const,
            },
          ],
          role: 'assistant' as const,
          turnId: 'turn',
        },
      ],
      id: 'turn',
      state: { startedAt: 1, status: 'running' as const },
      user: {
        createdAt: 1,
        delivery: { status: 'confirmed' as const },
        id: 'user',
        parts: [
          {
            id: 'user-text',
            markdown: 'Search StyleX',
            state: { status: 'complete' as const },
            type: 'text' as const,
          },
        ],
        role: 'user' as const,
        turnId: 'turn',
      },
    }
    const { container } = render(<Turn turn={runningTurn} />)

    expect(container.querySelector('[data-slot="turn-status"]')).toBeNull()
    expect(container.querySelector('[data-slot="tool-activity"]')).not.toBeNull()
  })

  it('uses one primary composer control while a turn is active', () => {
    const props = {
      capabilities,
      onDraftChange: () => undefined,
      onStop: () => undefined,
      onSubmit: () => undefined,
    }
    const { rerender } = render(
      <ChatComposer
        {...props}
        activity={{ status: 'busy', turnId: 'turn' }}
        draft={{ ...draft, segments: [{ id: 'text', text: '', type: 'text' }] }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Stop' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Queue' })).toBeNull()

    rerender(
      <ChatComposer
        {...props}
        activity={{ status: 'busy', turnId: 'turn' }}
        draft={draft}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Queue' })).not.toBeNull()
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

  it('locks a permission request after the first local decision', () => {
    const onDecision = vi.fn()
    const request = permissionRequest()
    render(<PermissionPrompt onDecision={onDecision} request={request} />)
    const button = screen.getByRole('button', { name: 'Allow once' })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(onDecision).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Allowing…' }).dataset.state).toBe(
      'disabled',
    )
  })

  it('unlocks a failed permission request for an explicit retry', async () => {
    const onDecision = vi.fn()
    const request = permissionRequest()
    const { rerender } = render(
      <PermissionPrompt onDecision={onDecision} request={request} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    rerender(
      <PermissionPrompt
        onDecision={onDecision}
        request={{
          ...request,
          state: {
            decision: 'once',
            error: {
              kind: 'mutation',
              message: 'Network unavailable.',
              retryable: true,
            },
            status: 'failed',
          },
        }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))

    expect(onDecision).toHaveBeenCalledTimes(2)
    expect(onDecision).toHaveBeenLastCalledWith('once')
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

  it('validates required choices before publishing an answer', async () => {
    const onAnswer = vi.fn()
    render(
      <QuestionRequest
        onAnswer={onAnswer}
        request={questionRequest()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(onAnswer).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(
      'Choose at least one answer.',
    )
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: 'StyleX' }),
    )
  })

  it('locks a question request after the first valid answer', async () => {
    const onAnswer = vi.fn()
    render(
      <QuestionRequest
        onAnswer={onAnswer}
        request={questionRequest()}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'StyleX' }))
    const submit = screen.getByRole('button', { name: 'Submit answer' })

    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(onAnswer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Submitting…' }).dataset.state,
    ).toBe('disabled')
  })

  it('renders immutable answer labels from structured option IDs', () => {
    const request = questionRequest()
    render(
      <QuestionAnswerSummary
        request={{
          ...request,
          state: {
            decision: {
              response: {
                answers: [
                  {
                    optionIds: ['stylex'],
                    questionId: 'framework',
                    type: 'choice',
                  },
                ],
              },
              type: 'answer',
            },
            status: 'resolved',
          },
        }}
      />,
    )

    expect(screen.getByText('Choose frameworks')).not.toBeNull()
    expect(screen.getByText('StyleX')).not.toBeNull()
  })

  it('keeps redo distinct from editing a reverted prompt', async () => {
    const onRedo = vi.fn()
    const onRestore = vi.fn()
    const reverted = { draft, id: 'revert', turnId: 'turn' }
    render(
      <RevertDock
        onDismiss={() => undefined}
        onRedo={onRedo}
        onRestore={onRestore}
        reverted={reverted}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))

    expect(onRedo).toHaveBeenCalledWith(reverted)
    expect(onRestore).not.toHaveBeenCalled()
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

  it('keeps structured references outside the native editor value', () => {
    const referencedDraft: ComposerDraft = {
      ...draft,
      segments: [
        { id: 'text', text: 'Review this file', type: 'text' },
        {
          id: 'reference',
          label: 'chat.ts',
          referenceType: 'file',
          type: 'reference',
          value: '/workspace/chat.ts',
        },
      ],
    }
    render(
      <ChatComposer
        activity={{ status: 'idle' }}
        capabilities={capabilities}
        draft={referencedDraft}
        onDraftChange={() => undefined}
        onStop={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(
      (screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement)
        .value,
    ).toBe('Review this file')
    expect(screen.getByRole('list', { name: 'References' }).textContent).toContain(
      '@chat.ts',
    )
  })

  it('accepts attachments from paste and drop without swallowing text input', () => {
    const onFilesAdd = vi.fn()
    const { container } = render(
      <ChatComposer
        activity={{ status: 'idle' }}
        capabilities={capabilities}
        draft={draft}
        onDraftChange={() => undefined}
        onFilesAdd={onFilesAdd}
        onStop={() => undefined}
        onSubmit={() => undefined}
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Message' })
    const pasted = new File(['paste'], 'paste.png', { type: 'image/png' })
    const dropped = new File(['drop'], 'drop.txt', { type: 'text/plain' })

    fireEvent.paste(input, { clipboardData: { files: [pasted] } })
    fireEvent.drop(container.querySelector('form')!, {
      dataTransfer: { files: [dropped], types: ['Files'] },
    })

    expect(onFilesAdd).toHaveBeenNthCalledWith(1, [pasted], 'paste')
    expect(onFilesAdd).toHaveBeenNthCalledWith(2, [dropped], 'drop')
  })

  it('restores composer focus after a request when the draft is unchanged', () => {
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
    const region = (requests: readonly PermissionRequestView[]) => (
      <RequestRegion
        draftRevision={1}
        onPermissionDecision={() => undefined}
        onQuestionAnswer={() => undefined}
        onQuestionReject={() => undefined}
        requests={requests}
      >
        <form data-slot="chat-composer">
          <textarea aria-label="Message" />
        </form>
      </RequestRegion>
    )
    const { rerender } = render(region([]))
    const input = screen.getByRole('textbox', { name: 'Message' })
    input.focus()

    rerender(region([request]))
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Use the network?' }),
    )

    rerender(region([]))
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Message' }),
    )
  })

  it('bounds and sanitizes shell output until explicitly revealed', async () => {
    const part: ToolPart = {
      callId: 'shell-call',
      id: 'shell-part',
      metadata: { durationMs: 1_200, exitCode: 0 },
      presentation: { kind: 'shell' },
      state: {
        endedAt: 2,
        input: { command: 'printf hello' },
        output: '\u001b[31mabcdefghij\u001b[0m',
        status: 'succeeded',
      },
      toolName: 'shell',
      type: 'tool',
    }
    const { container } = render(
      <ShellTool defaultOpen outputCharacterLimit={5} part={part} />,
    )

    expect(container.textContent).toContain('abcde')
    expect(container.textContent).not.toContain('abcdefghij')
    expect(container.textContent).toContain('1.2 s')

    await userEvent.click(screen.getByRole('button', { name: 'Show full output' }))
    expect(container.textContent).toContain('abcdefghij')
  })

  it('renders normalized file changes, moves, counts, and diagnostics', () => {
    const part: ToolPart = {
      callId: 'patch-call',
      id: 'patch-part',
      presentation: {
        diagnostics: [
          {
            column: 3,
            id: 'diagnostic',
            line: 2,
            message: 'Missing return type.',
            path: '/workspace/old.ts',
            severity: 'error',
          },
        ],
        files: [
          {
            additions: 1,
            deletions: 1,
            hunks: [
              {
                header: '@@ -1,2 +1,2 @@',
                id: 'hunk',
                lines: [
                  {
                    content: 'export default value',
                    id: 'deletion',
                    kind: 'deletion',
                    oldLine: 2,
                  },
                  {
                    content: 'export { value }',
                    id: 'addition',
                    kind: 'addition',
                    newLine: 2,
                  },
                ],
              },
            ],
            id: 'file',
            path: '/workspace/new.ts',
            previousPath: '/workspace/old.ts',
            status: 'moved',
          },
        ],
        kind: 'file-change',
        operation: 'patch',
      },
      state: {
        endedAt: 2,
        input: { filePath: '/workspace/old.ts' },
        output: 'Done',
        status: 'succeeded',
      },
      toolName: 'apply_patch',
      type: 'tool',
    }
    const { container } = render(<FileChangeTool defaultOpen part={part} />)

    expect(container.textContent).toContain(
      '/workspace/old.ts → /workspace/new.ts',
    )
    expect(container.textContent).toContain('Moved+1−1')
    expect(container.textContent).toContain('export { value }')
    expect(container.textContent).toContain(
      '/workspace/old.ts:2:3Missing return type.',
    )
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

function permissionRequest(): PermissionRequestView {
  return {
    consequence: 'external',
    effect: 'Fetch https://example.com',
    id: 'permission',
    order: 0,
    origin: { sessionId: 'session' },
    state: { status: 'pending' },
    title: 'Use the network?',
    type: 'permission',
  }
}

function questionRequest(): QuestionRequestView {
  return {
    id: 'question-request',
    order: 0,
    origin: { sessionId: 'session' },
    questions: [
      {
        allowCustom: false,
        id: 'framework',
        label: 'Choose frameworks',
        options: [
          { id: 'stylex', label: 'StyleX' },
          { id: 'base-ui', label: 'Base UI' },
        ],
        required: true,
        type: 'multiple-choice',
      },
    ],
    state: { status: 'pending' },
    type: 'question',
  }
}
