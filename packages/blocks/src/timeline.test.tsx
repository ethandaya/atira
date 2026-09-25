// @vitest-environment jsdom

import type { ChatMessage, ChatTurn } from '@pretty-amped/foundations/chat'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  firstThatWorks: (...values: string[]) => values[0],
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

  it('recalculates the virtual window when estimates change without a new transcript', () => {
    const turns = Array.from({ length: 500 }, (_, index) => turn(index))
    const view = (estimatedTurnHeight: number) => (
      <Timeline
        activity={{ status: 'idle' }}
        estimatedTurnHeight={estimatedTurnHeight}
        estimatedTurnGap={16}
        history={{ status: 'complete' }}
        label="Conversation"
        onLoadPrevious={async () => undefined}
        turns={turns}
      />
    )
    const { container, rerender } = render(view(320))
    // jsdom has a zero-height viewport, leaving the fixed 800px overscan.
    expect(container.querySelectorAll('[data-turn-id]')).toHaveLength(3)
    rerender(view(80))
    expect(container.querySelectorAll('[data-turn-id]')).toHaveLength(9)
  })

  it.each([
    ['rejection', () => Promise.reject(new Error('history failed'))],
    ['an unchanged result', () => Promise.resolve()],
  ])('leaves restoring after %s and permits a retry', async (_, load) => {
    vi.useFakeTimers()
    const onLoadPrevious = vi.fn(load)
    const { container } = renderTimeline([turn(1)], onLoadPrevious)
    mockTimelineGeometry(container)

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }))
    expect(container.querySelector('[data-follow-state="restoring"]')).not.toBeNull()
    await act(async () => { await vi.runAllTimersAsync() })
    expect(container.querySelector('[data-follow-state="detached"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }))
    await act(async () => { await vi.runAllTimersAsync() })
    expect(onLoadPrevious).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('restores the visible turn offset after a successful prepend', async () => {
    let resolveLoad!: () => void
    const load = new Promise<void>((resolve) => { resolveLoad = resolve })
    const onLoadPrevious = vi.fn(() => load)
    const initial = [turn(1)]
    const prependOffset = { value: 0 }
    const view = (turns: readonly ChatTurn[]) => <Timeline
      activity={{ status: 'idle' }} history={{ hasPrevious: true, status: 'ready' }}
      label="Conversation" onLoadPrevious={onLoadPrevious} turns={turns}
    />
    const { container, rerender } = render(view(initial))
    mockTimelineGeometry(container, prependOffset)
    const viewport = container.querySelector<HTMLElement>('[data-slot="timeline-viewport"]')!

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }))
    prependOffset.value = 50
    rerender(view([turn(0), ...initial]))
    await act(async () => resolveLoad())

    expect(viewport.scrollTop).toBe(50)
    expect(container.querySelector('[data-follow-state="detached"]')).not.toBeNull()
  })
})

function renderTimeline(turns: readonly ChatTurn[], onLoadPrevious: () => Promise<void>) {
  return render(<Timeline activity={{ status: 'idle' }} history={{ hasPrevious: true, status: 'ready' }}
    label="Conversation" onLoadPrevious={onLoadPrevious} turns={turns} />)
}

function mockTimelineGeometry(container: HTMLElement, prependOffset = { value: 0 }) {
  const viewport = container.querySelector<HTMLElement>('[data-slot="timeline-viewport"]')!
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 500 },
  })
  viewport.getBoundingClientRect = () => ({ top: 0 } as DOMRect)
  for (const element of container.querySelectorAll<HTMLElement>('[data-turn-id]')) {
    element.getBoundingClientRect = () => {
      const top = element.dataset.turnId === 'turn-1' ? 20 + prependOffset.value : 0
      return { bottom: top + 20, height: 20, top } as DOMRect
    }
  }
}

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
