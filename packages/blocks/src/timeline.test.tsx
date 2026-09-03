// @vitest-environment jsdom

import type { ChatMessage, ChatTurn } from '@pretty-amped/foundations/chat'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  keyframes: () => '',
  props: () => ({}),
}))

import { Timeline } from './timeline'

afterEach(cleanup)

describe('Timeline', () => {
  it('keeps the mounted turn count bounded for long sessions', () => {
    const turns = Array.from({ length: 500 }, (_, index) => turn(index))
    const { container } = render(
      <Timeline
        activity={{ status: 'idle' }}
        history={{ hasPrevious: false, status: 'ready' }}
        label="Conversation"
        onLoadPrevious={async () => undefined}
        turns={turns}
      />,
    )

    const renderedTurns = container.querySelectorAll('[data-turn-id]')
    expect(renderedTurns.length).toBeGreaterThan(0)
    expect(renderedTurns.length).toBeLessThanOrEqual(24)
    expect(container.querySelector('[data-virtualized="true"]')).not.toBeNull()
  })
})

function turn(index: number): ChatTurn {
  return {
    assistant: [message(`assistant-${index}`, `turn-${index}`, 'assistant')],
    id: `turn-${index}`,
    state: { endedAt: index + 1, startedAt: index, status: 'complete' },
    user: message(`user-${index}`, `turn-${index}`, 'user'),
  }
}

function message(
  id: string,
  turnId: string,
  role: ChatMessage['role'],
): ChatMessage {
  return {
    createdAt: 1,
    delivery: { status: 'confirmed' },
    id,
    parts: [
      {
        id: `${id}-text`,
        markdown: id,
        state: { status: 'complete' },
        type: 'text',
      },
    ],
    role,
    turnId,
  }
}
