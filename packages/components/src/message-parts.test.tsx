// @vitest-environment jsdom

import type { ChatMessage, ToolPart } from '@atiraui/foundations/chat'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  firstThatWorks: (...values: string[]) => values[0],
  keyframes: () => '',
  props: () => ({}),
}))

import {
  AssistantSequence,
  MessageParts,
  type ToolRenderer,
} from './message-parts'

afterEach(cleanup)

const customContext: ToolRenderer = {
  id: 'custom-context',
  supports: (part) =>
    part.presentation.kind === 'context' && part.toolName === 'custom',
  render: (part) => <span>custom:{part.id}</span>,
}

describe.each([
  [
    'MessageParts',
    (message: ChatMessage, toolRenderers: readonly ToolRenderer[]) => (
      <MessageParts message={message} toolRenderers={toolRenderers} />
    ),
  ],
  [
    'AssistantSequence',
    (message: ChatMessage, toolRenderers: readonly ToolRenderer[]) => (
      <AssistantSequence messages={[message]} toolRenderers={toolRenderers} />
    ),
  ],
])('%s context rendering', (_, renderSequence) => {
  it('skips unchanged tools during text updates and renders changed tool state', () => {
    const tool = context('custom', 'custom')
    const renderTool = vi.fn((part: ToolPart) => (
      <span>{part.state.status}</span>
    ))
    const renderers = [{ ...customContext, render: renderTool }]
    const first: ChatMessage = {
      ...message([tool]),
      parts: [
        tool,
        {
          id: 'text',
          type: 'text',
          markdown: 'First',
          state: { status: 'streaming' },
        },
      ],
    }
    const { container, rerender } = render(renderSequence(first, renderers))
    expect(renderTool).toHaveBeenCalledTimes(1)

    const next: ChatMessage = {
      ...first,
      parts: [
        tool,
        {
          id: 'text',
          type: 'text',
          markdown: 'Next',
          state: { status: 'streaming' },
        },
      ],
    }
    rerender(renderSequence(next, renderers))
    expect(renderTool).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Next')

    rerender(
      renderSequence(
        {
          ...next,
          parts: [
            { ...tool, state: { status: 'queued', input: {} } },
            next.parts[1]!,
          ],
        },
        renderers,
      ),
    )
    expect(renderTool).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('queued')
  })

  it('groups adjacent defaults while dispatching custom and mixed context tools independently', () => {
    const parts = [
      context('default-1'),
      context('default-2'),
      context('custom', 'custom'),
      context('default-3'),
    ]
    const { container } = render(
      renderSequence(message(parts), [customContext]),
    )

    expect(
      container.querySelectorAll('[data-renderer="context"]'),
    ).toHaveLength(2)
    expect(
      container.querySelectorAll('[data-renderer="custom-context"]'),
    ).toHaveLength(1)
    expect(container.textContent).toContain('custom:custom')
  })
})

function message(parts: readonly ToolPart[]): ChatMessage {
  return {
    createdAt: 1,
    delivery: { status: 'confirmed' },
    id: 'message',
    parts,
    role: 'assistant',
    turnId: 'turn',
  }
}

function context(id: string, toolName = 'read'): ToolPart {
  return {
    callId: `${id}-call`,
    id,
    presentation: { kind: 'context', operation: 'read' },
    state: { status: 'succeeded', endedAt: 1, input: {}, output: id },
    toolName,
    type: 'tool',
  }
}
