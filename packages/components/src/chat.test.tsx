// @vitest-environment jsdom

import type {
  ChatCapabilities,
  ChatMessage,
  ChatTurn,
  ComposerDraft,
  JsonValue,
  PermissionRequestView,
  QuestionRequestView,
  ToolPart,
} from '@atiraui/foundations/chat'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  firstThatWorks: (...values: string[]) => values[0],
  keyframes: () => '',
  props: () => ({}),
}))

import { ChatComposer, QueueList } from './chat-composer'
import { CitationList } from './citation-list'
import { FileChangeTool, ShellTool, TaskTool } from './chat-tools'
import { MessageParts } from './message-parts'
import {
  PermissionPrompt,
  QuestionAnswerSummary,
  QuestionRequest,
  RequestRegion,
  RevertDock,
} from './requests'
import { Reasoning } from './reasoning'
import { GeneratedImage } from './generated-image'
import { Thread } from './thread'
import { ToolActivity } from './tool-activity'
import { Turn } from './turn'

afterEach(cleanup)

describe('chat components', () => {
  it('keeps requests without application handlers read-only', async () => {
    render(
      <>
        <PermissionPrompt request={permissionRequest()} />
        <QuestionRequest request={questionRequest()} />
      </>,
    )
    for (const name of [
      'Allow once',
      'Always allow',
      'Reject',
      'Submit answer',
      'Dismiss',
    ]) {
      const button = screen.getByRole('button', { name })
      expect(
        button.hasAttribute('disabled') ||
          button.getAttribute('aria-disabled') === 'true',
      ).toBe(true)
      await userEvent.click(button)
    }
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('orders decision history independently of incoming snapshot order', async () => {
    const request = permissionRequest()
    const resolved = (id: string, order: number): PermissionRequestView => ({
      ...request,
      id,
      order,
      title: id,
      effect: id,
      state: { status: 'resolved', decision: 'once' },
    })
    render(
      <RequestRegion
        requests={[resolved('Latest', 9), resolved('Earlier', 2)]}
        onPermissionDecision={vi.fn()}
        onQuestionAnswer={vi.fn()}
        onQuestionReject={vi.fn()}
      >
        {null}
      </RequestRegion>,
    )
    const toggle = screen.getByRole('button', { name: /Latest/ })
    await userEvent.click(toggle)
    expect(
      screen.getByRole('list', { name: 'Decision history' }).textContent,
    ).toMatch(/Earlier.*Latest/)
  })

  it.each([
    'https://images.example/image.png?signature=a%2Bb',
    'data:image/png;base64,AAAA',
  ])(
    'preserves image URLs and accepts an application-owned download target: %s',
    (url) => {
      const image = { id: 'image', url, alt: 'Diagram', width: 1, height: 1 }
      const { rerender } = render(
        <GeneratedImage state={{ status: 'ready', image }} />,
      )
      fireEvent.load(screen.getByRole('img'))
      expect(
        screen.getByRole('link', { name: 'Download' }).getAttribute('href'),
      ).toBe(url)
      rerender(
        <GeneratedImage
          state={{
            status: 'ready',
            image: { ...image, downloadUrl: '/downloads/diagram' },
          }}
        />,
      )
      expect(
        screen.getByRole('link', { name: 'Download' }).getAttribute('href'),
      ).toBe('/downloads/diagram')
      expect(
        screen.getByRole('link', { name: 'Open image' }).getAttribute('href'),
      ).toBe(url)
    },
  )

  it('customizes composer and generated-image labels and forwards leaf native props', () => {
    const onKeyDown = vi.fn()
    const { container } = render(
      <>
        <Thread
          label="Support transcript"
          data-testid="thread"
          className="consumer"
          onKeyDown={onKeyDown}
        />
        <GeneratedImage
          label="Diagram preview"
          state={{ status: 'generating' }}
          data-testid="image"
        />
      </>,
    )
    fireEvent.keyDown(screen.getByTestId('thread'), { key: 'Escape' })
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(screen.getByTestId('thread').className).toContain('consumer')
    expect(screen.getByLabelText('Diagram preview')).toBe(
      container.querySelector('[data-slot="generated-image"]'),
    )
  })

  it('shows queue failure reasons and only offers retry for recoverable errors', async () => {
    const onRetry = vi.fn()
    const item = {
      id: 'queued',
      draft,
      state: 'failed' as const,
      error: {
        kind: 'connection' as const,
        message: 'Connection lost. Try again.',
        retryable: true,
      },
    }
    const { rerender } = render(<QueueList items={[item]} onRetry={onRetry} />)
    expect(screen.getByRole('alert').textContent).toBe(item.error.message)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledWith(item)
    rerender(
      <QueueList
        items={[{ ...item, error: { ...item.error, retryable: false } }]}
        onRetry={onRetry}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe(item.error.message)
  })

  it('links the complete source entry but leaves invalid sources noninteractive', () => {
    render(
      <CitationList
        id="sources"
        citations={[
          {
            id: 'valid',
            title: 'Source title',
            source: 'Example',
            description: 'Supporting evidence',
            href: 'https://example.com/source',
          },
          {
            id: 'invalid',
            title: 'Unsafe source',
            href: 'javascript:alert(1)',
          },
        ]}
      />,
    )
    const link = screen.getByRole('link', { name: 'Source title' })
    expect(link.contains(screen.getByText('Supporting evidence'))).toBe(true)
    expect(link.getAttribute('href')).toBe('https://example.com/source')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Invalid link')).not.toBeNull()
  })

  it('retains the tool, trigger and open evidence across progress, completion and retry', async () => {
    const view = (
      state: React.ComponentProps<typeof ToolActivity>['state'],
    ) => (
      <ToolActivity
        id="stable-tool"
        state={state}
        summary="Check types"
        tool="shell"
      >
        <code>Checking the interface</code>
      </ToolActivity>
    )
    const { container, rerender } = render(
      view({
        status: 'running',
        startedAt: Date.now(),
        progress: { current: 1, total: 3 },
      }),
    )
    const row = container.querySelector('[data-slot="tool-activity"]')
    const trigger = screen.getByRole('button')
    await userEvent.click(trigger)
    const evidence = container.querySelector(
      '[data-slot="tool-activity-evidence"]',
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('1/3')).not.toBeNull()
    expect(screen.getByLabelText('Elapsed time')).not.toBeNull()
    for (const state of [
      { status: 'receiving-input' },
      { status: 'queued' },
      { status: 'running' },
      { status: 'awaiting-permission' },
      { status: 'awaiting-approval' },
      { status: 'succeeded' },
      { status: 'failed', error: 'Type mismatch' },
      { status: 'cancelled' },
      { status: 'running' },
    ] as const) {
      rerender(view(state))
      expect(container.querySelector('[data-slot="tool-activity"]')).toBe(row)
      expect(screen.getByRole('button')).toBe(trigger)
      expect(
        container.querySelector('[data-slot="tool-activity-evidence"]'),
      ).toBe(evidence)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    }
  })

  it('keeps the permission scope and exact decision available after resolution', async () => {
    const request = permissionRequest()
    const view = (resolved: boolean) => (
      <RequestRegion
        onPermissionDecision={() => undefined}
        onQuestionAnswer={() => undefined}
        onQuestionReject={() => undefined}
        requests={[
          {
            ...request,
            scope: 'Only this workspace.',
            state: resolved
              ? { status: 'resolved', decision: 'once' }
              : request.state,
          },
        ]}
      >
        <textarea
          aria-label="Retained draft"
          defaultValue="Do not lose this draft"
        />
      </RequestRegion>
    )
    const { rerender } = render(view(false))
    rerender(view(true))
    await userEvent.click(screen.getByRole('button', { name: /Allowed once/ }))
    expect(
      screen.getByRole('list', { name: 'Decision history' }).textContent,
    ).toContain('Only this workspace.')
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Retained draft',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('Do not lose this draft')
  })

  it('summarizes successful work while keeping running, blocked, failed and cancelled tools visible', async () => {
    const done = toolPart('read', {
      kind: 'context',
      operation: 'read',
      target: '/workspace/app.tsx',
    })
    const running: ToolPart = {
      ...toolPart('shell', { command: 'pnpm test', kind: 'shell' }),
      state: {
        status: 'running',
        startedAt: Date.now() - 3000,
        input: { command: 'raw command' },
      },
    }
    const failed: ToolPart = {
      ...toolPart('failed', { kind: 'generic' }),
      state: {
        status: 'failed',
        endedAt: 2,
        error: { message: 'Check failed', kind: 'tool', retryable: false },
      },
    }
    const blocked: ToolPart = {
      ...toolPart('blocked', { kind: 'generic' }),
      state: {
        status: 'awaiting-permission',
        input: {},
        requestId: 'permission',
      },
    }
    const cancelled: ToolPart = {
      ...toolPart('cancelled', { kind: 'generic' }),
      state: { status: 'cancelled', endedAt: 2 },
    }
    const message: ChatMessage = {
      createdAt: 1,
      delivery: { status: 'confirmed' },
      id: 'summary',
      parts: [done, running, failed, blocked, cancelled],
      role: 'assistant',
      turnId: 'turn',
    }
    const { container, rerender } = render(
      <MessageParts activityPresentation="summary" message={message} />,
    )
    expect(
      container.querySelectorAll('[data-slot="activity-current"]'),
    ).toHaveLength(4)
    expect(screen.getByText('Check failed')).not.toBeNull()
    expect(screen.getByLabelText('Elapsed time').textContent).toBe('3s')
    expect(
      container.querySelector('[data-slot="activity-completed"]'),
    ).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: '1 action completed' }),
    )
    await userEvent.click(
      screen.getByRole('button', {
        name: /Complete\s*Read \/workspace\/app.tsx/,
      }),
    )
    expect(screen.getByText('result')).not.toBeNull()
    rerender(
      <MessageParts
        activityPresentation="summary"
        message={{
          ...message,
          parts: [
            done,
            {
              ...running,
              state: {
                status: 'succeeded',
                input: { command: 'raw command' },
                endedAt: Date.now(),
                output: 'All passed',
              },
            },
            failed,
            blocked,
            cancelled,
          ],
        }}
      />,
    )
    expect(
      container.querySelectorAll('[data-slot="activity-current"]'),
    ).toHaveLength(3)
    expect(screen.queryByLabelText('Elapsed time')).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: /Complete\s*pnpm test/ }),
    )
    expect(screen.getByText('All passed')).not.toBeNull()
    expect(screen.getByText('result')).not.toBeNull()
    expect(screen.getByText('Check failed')).not.toBeNull()
  })

  it('keeps reasoning geometry while replacing loading with completion', async () => {
    const { container, rerender } = render(
      <Reasoning state={{ status: 'thinking' }}>
        Checking the response.
      </Reasoning>,
    )

    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1)
    expect(
      container.querySelector('[data-slot="reasoning-state-icon"]'),
    ).toBeNull()

    rerender(
      <Reasoning state={{ duration: '2.1s', status: 'complete' }}>
        Checked the response.
      </Reasoning>,
    )

    await waitFor(() =>
      expect(container.querySelector('[data-slot="spinner"]')).toBeNull(),
    )
    expect(
      container.querySelector('[data-slot="reasoning-state-icon"]'),
    ).not.toBeNull()
    expect(screen.getByText('Thought for 2.1s')).not.toBeNull()
  })

  it('uses a specialized tool renderer and a lossless generic fallback', () => {
    const read = toolPart('read', {
      kind: 'context',
      operation: 'read',
      target: '/workspace/app.tsx',
    })
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
        description: 'Check alignment',
        kind: 'task',
        transcript: {
          reasoning: 'I checked the activity hierarchy.',
          result: '**Looks good.**',
          steps: [],
        },
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
    expect(container.textContent).not.toContain('transcript is not available')
    expect(
      screen.getByText('Looks good.', { selector: 'strong' }),
    ).not.toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Open child session' }),
    )
    expect(onOpenChild).toHaveBeenCalledWith('child-session')
  })

  it('shows the current activity for a running subagent', () => {
    const part: ToolPart = {
      callId: 'running-subagent-call',
      id: 'running-subagent-part',
      presentation: {
        activity: {
          summary: 'Searching design references',
          tool: 'search_web',
        },
        agent: { id: 'research', label: 'Research agent' },
        childSessionId: 'running-child-session',
        description: 'Compare transcript density patterns',
        kind: 'task',
      },
      state: {
        input: { description: 'Compare transcript density patterns' },
        startedAt: 1,
        status: 'running',
      },
      toolName: 'run_subagent',
      type: 'tool',
    }

    const { container } = render(<TaskTool part={part} />)

    expect(container.textContent).toContain(
      'Research · Searching design references',
    )
    expect(
      container
        .querySelector('[data-slot="subagent-activity"]')
        ?.getAttribute('data-activity-tool'),
    ).toBe('search_web')
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
              presentation: {
                kind: 'web' as const,
                operation: 'search' as const,
              },
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
    expect(
      container.querySelector('[data-slot="tool-activity"]'),
    ).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1)
  })

  it('shows waiting after settled text but hands off to streaming text or a tool', async () => {
    const turn = runningTurnWithParts([
      {
        id: 'assistant-text',
        markdown: 'I prepared the image prompt.',
        state: { status: 'complete' as const },
        type: 'text' as const,
      },
    ])

    const { container, rerender } = render(<Turn turn={turn} />)

    expect(screen.getByText('I prepared the image prompt.')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="turn-status"]')?.textContent,
    ).toBe('Working')
    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1)

    rerender(
      <Turn
        turn={runningTurnWithParts([
          {
            id: 'assistant-text',
            markdown: 'The response is arriving.',
            state: { status: 'streaming' },
            type: 'text',
          },
        ])}
      />,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-slot="turn-status"]')).toBeNull(),
    )
    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(0)

    rerender(
      <Turn
        turn={runningTurnWithParts([
          ...turn.assistant[0]!.parts,
          {
            ...toolPart('image', { kind: 'image' }),
            state: {
              input: { prompt: 'A test image' },
              startedAt: 2,
              status: 'running',
            },
          },
        ])}
      />,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-slot="turn-status"]')).toBeNull(),
    )
    expect(screen.getByText('Generating image…')).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1)
  })

  it('does not mount empty assistant rows before content arrives', () => {
    const turn: ChatTurn = {
      agent: { id: 'research', label: 'Research agent' },
      model: {
        modelId: 'model',
        providerId: 'provider',
        label: 'Research model',
      },
      assistant: [
        {
          createdAt: 2,
          delivery: { status: 'confirmed' },
          id: 'assistant',
          parts: [
            {
              id: 'assistant-text',
              markdown: '',
              state: { status: 'streaming' },
              type: 'text',
            },
          ],
          role: 'assistant',
          turnId: 'turn',
        },
      ],
      id: 'turn',
      state: { startedAt: 1, status: 'running' },
      user: {
        createdAt: 1,
        delivery: { status: 'confirmed' },
        id: 'user',
        parts: [],
        role: 'user',
        turnId: 'turn',
      },
    }

    const { container, rerender } = render(<Turn turn={turn} />)
    const identity = screen.getByRole('group', { name: 'Response author' })
    expect(identity.textContent).toBe(
      'Agent: Research agentModel: Research model',
    )
    expect(
      container.querySelector('[data-slot="turn-assistant"]')
        ?.firstElementChild,
    ).toBe(identity)
    expect(container.querySelector('[data-slot="turn-meta"]')).toBeNull()

    expect(
      container.querySelector('[data-slot="turn-assistant-message"]'),
    ).toBeNull()
    expect(
      container.querySelector('[data-slot="turn-status"]')?.textContent,
    ).toBe('Working')
    expect(container.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1)
    rerender(
      <Turn
        turn={{
          ...turn,
          state: { status: 'complete', startedAt: 1, endedAt: 2 },
        }}
        actions={<button>Copy response</button>}
      />,
    )
    expect(screen.getByRole('group', { name: 'Response author' })).toBe(
      identity,
    )
    expect(
      container.querySelector('[data-slot="turn-meta"]')?.textContent,
    ).toBe('Copy response')
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
    const { rerender } = render(
      <PermissionPrompt onDecision={onDecision} request={request} />,
    )
    const button = screen.getByRole('button', { name: 'Allow once' })

    fireEvent.click(button)
    rerender(
      <PermissionPrompt
        onDecision={onDecision}
        request={{ ...request, state: { status: 'pending' } }}
      />,
    )
    fireEvent.click(button)

    expect(onDecision).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Allow once' }).dataset.state,
    ).toBe('disabled')
  })

  it.each(['resolved', 'expired'] as const)(
    'clears the local permission lock when %s',
    (status) => {
      const request = permissionRequest()
      const { container, rerender } = render(
        <PermissionPrompt request={request} onDecision={vi.fn()} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Allow once' }))
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
      rerender(
        <PermissionPrompt
          request={{
            ...request,
            state:
              status === 'resolved' ? { status, decision: 'once' } : { status },
          }}
        />,
      )
      expect(container.querySelector('[aria-busy="true"]')).toBeNull()
      expect(
        screen.queryByRole('group', { name: 'Permission decision' }),
      ).toBeNull()
    },
  )

  it('unlocks a failed permission request for an explicit retry', async () => {
    const onDecision = vi.fn()
    const request = permissionRequest()
    const { rerender } = render(
      <PermissionPrompt onDecision={onDecision} request={request} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    for (const message of ['Network unavailable.', 'Still unavailable.']) {
      rerender(
        <PermissionPrompt
          onDecision={onDecision}
          request={{
            ...request,
            state: {
              decision: 'once',
              error: {
                kind: 'mutation',
                message,
                retryable: true,
              },
              status: 'failed',
            },
          }}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    }

    expect(onDecision).toHaveBeenCalledTimes(3)
    expect(onDecision).toHaveBeenLastCalledWith('once')
  })

  it('does not carry a local permission decision into another session with the same request ID', async () => {
    const request = permissionRequest()
    const onDecision = vi.fn()
    const { rerender } = render(
      <PermissionPrompt request={request} onDecision={onDecision} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    rerender(
      <PermissionPrompt
        request={{ ...request, origin: { sessionId: 'other-session' } }}
        onDecision={onDecision}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onDecision.mock.calls).toEqual([['once'], ['reject']])
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

  it('retries each question failure without losing the answer or allowing duplicate submissions', () => {
    const onAnswer = vi.fn()
    const request: QuestionRequestView = {
      id: 'retry-question',
      order: 0,
      origin: { sessionId: 'session' },
      questions: [{ id: 'name', label: 'Name', required: true, type: 'text' }],
      state: { status: 'pending' },
      type: 'question',
    }
    const { rerender } = render(
      <QuestionRequest request={request} onAnswer={onAnswer} />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
    for (const message of ['First failure', 'Second failure']) {
      rerender(
        <QuestionRequest
          onAnswer={onAnswer}
          request={{
            ...request,
            state: {
              status: 'failed',
              decision: {
                type: 'answer',
                response: {
                  answers: [{ questionId: 'name', type: 'text', value: 'Ada' }],
                },
              },
              error: { kind: 'mutation', message, retryable: true },
            },
          }}
        />,
      )
      const button = screen.getByRole('button', { name: 'Submit answer' })
      fireEvent.click(button)
      fireEvent.click(button)
    }
    expect(onAnswer).toHaveBeenCalledTimes(3)
    expect(onAnswer).toHaveBeenLastCalledWith({
      answers: [{ questionId: 'name', type: 'text', value: 'Ada' }],
    })
  })

  it('progresses through multi-question requests without changing the answer payload', async () => {
    const onAnswer = vi.fn()
    const request: QuestionRequestView = {
      id: 'multi-question-request',
      order: 0,
      origin: { sessionId: 'session' },
      questions: [
        {
          allowCustom: false,
          id: 'framework',
          label: 'Choose a framework',
          options: [{ id: 'stylex', label: 'StyleX' }],
          required: true,
          type: 'single-choice',
        },
        {
          id: 'notes',
          label: 'Review notes',
          required: true,
          type: 'text',
        },
      ],
      state: { status: 'pending' },
      type: 'question',
    }
    render(<QuestionRequest onAnswer={onAnswer} request={request} />)

    expect(screen.getByLabelText('Question 1 of 2')).not.toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'StyleX' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Review notes' }),
      'Keep it light.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(onAnswer).toHaveBeenCalledWith({
      answers: [
        { optionIds: ['stylex'], questionId: 'framework', type: 'choice' },
        { questionId: 'notes', type: 'text', value: 'Keep it light.' },
      ],
    })
  })

  it('validates required choices before publishing an answer', async () => {
    const onAnswer = vi.fn()
    render(<QuestionRequest onAnswer={onAnswer} request={questionRequest()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(onAnswer).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(
      'Choose at least one answer.',
    )
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: 'StyleX' }),
    )
  })

  it.each(['request', 'session'])(
    'resets answers when the %s identity changes without a caller key',
    async (identity) => {
      const request = questionRequest()
      const onAnswer = vi.fn()
      const { rerender } = render(
        <QuestionRequest onAnswer={onAnswer} request={request} />,
      )
      await userEvent.click(screen.getByRole('checkbox', { name: 'StyleX' }))
      rerender(
        <QuestionRequest
          onAnswer={onAnswer}
          request={{
            ...request,
            ...(identity === 'request'
              ? { id: 'next-request' }
              : { origin: { sessionId: 'next-session' } }),
          }}
        />,
      )
      expect(
        screen
          .getByRole('checkbox', { name: 'StyleX' })
          .getAttribute('aria-checked'),
      ).toBe('false')
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit answer' }),
      )
      expect(onAnswer).not.toHaveBeenCalled()
      expect(screen.getByRole('alert').textContent).toBe(
        'Choose at least one answer.',
      )
    },
  )

  it('locks a question request after the first valid answer', async () => {
    const onAnswer = vi.fn()
    render(<QuestionRequest onAnswer={onAnswer} request={questionRequest()} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'StyleX' }))
    const submit = screen.getByRole('button', { name: 'Submit answer' })

    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(onAnswer).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Submit answer' }).dataset.state,
    ).toBe('disabled')
  })

  it('replaces local submission with the controlled resolved outcome', async () => {
    const request = questionRequest()
    const onReject = vi.fn()
    const { rerender } = render(
      <QuestionRequest onReject={onReject} request={request} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onReject).toHaveBeenCalledOnce()
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true')

    rerender(
      <QuestionRequest
        onReject={onReject}
        request={{
          ...request,
          state: { status: 'resolved', decision: { type: 'reject' } },
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Question dismissed.' }),
    ).toBeTruthy()
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit answer' })).toBeNull()
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
    expect(
      screen.getByRole('list', { name: 'References' }).textContent,
    ).toContain('@chat.ts')
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

    rerender(
      region([
        {
          ...request,
          origin: { sessionId: 'other-session' },
          title: 'Approve the other session?',
        },
      ]),
    )
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Approve the other session?' }),
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
      presentation: {
        command: 'printf hello',
        durationMs: 1_200,
        exitCode: 0,
        kind: 'shell',
      },
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

    await userEvent.click(
      screen.getByRole('button', { name: 'Show full output' }),
    )
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

  it('uses explicit presentation fields instead of conflicting raw aliases', () => {
    const parts: ToolPart[] = [
      explicitTool(
        'context',
        { kind: 'context', operation: 'read', target: 'explicit-context' },
        { path: 'raw-context' },
      ),
      explicitTool(
        'shell',
        {
          command: 'explicit-command',
          kind: 'shell',
          workingDirectory: '/explicit-directory',
        },
        { command: 'raw-command', cwd: '/raw-directory' },
      ),
      explicitTool(
        'file',
        {
          content: 'explicit-content',
          diagnostics: [],
          files: [],
          kind: 'file-change',
          operation: 'write',
          path: 'explicit-file',
        },
        { content: 'raw-content', path: 'raw-file' },
      ),
      explicitTool(
        'task',
        { description: 'explicit-task', kind: 'task' },
        { prompt: 'raw-task' },
      ),
      explicitTool(
        'web',
        { kind: 'web', operation: 'search', target: 'explicit-web' },
        { query: 'raw-web' },
      ),
      explicitTool(
        'skill',
        { kind: 'skill', name: 'explicit-skill' },
        { skill: 'raw-skill' },
      ),
    ]
    const { container } = render(
      <MessageParts
        message={{
          createdAt: 1,
          delivery: { status: 'confirmed' },
          id: 'explicit-presentations',
          parts,
          role: 'assistant',
          turnId: 'turn',
        }}
      />,
    )

    for (const value of [
      'explicit-context',
      'explicit-command',
      'explicit-file',
      'explicit-task',
      'explicit-web',
      'explicit-skill',
    ]) {
      expect(container.textContent).toContain(value)
    }
    for (const value of [
      'raw-context',
      'raw-command',
      'raw-file',
      'raw-task',
      'raw-web',
      'raw-skill',
    ]) {
      expect(container.querySelector(`[title*="${value}"]`)).toBeNull()
    }
  })

  it('does not derive specialized summaries from raw-only tool input', () => {
    const parts: ToolPart[] = [
      explicitTool(
        'context',
        { kind: 'context', operation: 'read' },
        { filePath: 'guessed-context' },
      ),
      explicitTool('shell', { kind: 'shell' }, { cmd: 'guessed-command' }),
      explicitTool(
        'file',
        { diagnostics: [], files: [], kind: 'file-change', operation: 'edit' },
        { filename: 'guessed-file' },
      ),
      explicitTool('task', { kind: 'task' }, { description: 'guessed-task' }),
      explicitTool(
        'web',
        { kind: 'web', operation: 'fetch' },
        { url: 'https://guessed.example' },
      ),
      explicitTool('skill', { kind: 'skill' }, { name: 'guessed-skill' }),
    ]
    render(
      <MessageParts
        message={{
          createdAt: 1,
          delivery: { status: 'confirmed' },
          id: 'raw-only',
          parts,
          role: 'assistant',
          turnId: 'turn',
        }}
      />,
    )

    for (const summary of [
      'Read',
      'Run shell command',
      'Edit file',
      'Subagent · Run task',
      'Fetch web',
      'Load skill',
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(summary) }),
      ).not.toBeNull()
    }
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

function runningTurnWithParts(parts: ChatMessage['parts']): ChatTurn {
  return {
    assistant: [
      {
        createdAt: 2,
        delivery: { status: 'confirmed' },
        id: 'assistant',
        parts,
        role: 'assistant',
        turnId: 'turn',
      },
    ],
    id: 'turn',
    state: { startedAt: 1, status: 'running' },
    user: {
      createdAt: 1,
      delivery: { status: 'confirmed' },
      id: 'user',
      parts: [],
      role: 'user',
      turnId: 'turn',
    },
  }
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

function explicitTool(
  toolName: string,
  presentation: ToolPart['presentation'],
  input: JsonValue,
): ToolPart {
  return {
    callId: `${toolName}-explicit-call`,
    id: `${toolName}-explicit-part`,
    presentation,
    state: { endedAt: 2, input, status: 'succeeded' },
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
