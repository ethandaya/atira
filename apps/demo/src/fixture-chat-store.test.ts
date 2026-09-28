import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { FixtureChatStore } from './fixture-chat-store'
import { createDraft } from './nanocodex-store'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('keeps streamed and terminal fixture timestamps chronological', async () => {
  const store = new FixtureChatStore()
  const submission = store.submit(createDraft('Inspect timestamps'), 'send')
  await vi.advanceTimersByTimeAsync(3_000)
  await submission

  const turn = store.getSnapshot().turns.at(-1)
  expect(turn?.state).toEqual({
    endedAt: 12_751,
    startedAt: 10_001,
    status: 'complete',
  })
  const reasoning = turn?.assistant[0]?.parts.find(
    (part) => part.type === 'reasoning',
  )
  expect(reasoning).toMatchObject({ endedAt: 11_251, startedAt: 10_251 })
  const tool = turn?.assistant[0]?.parts.find((part) => part.type === 'tool')
  expect(tool?.state).toMatchObject({ endedAt: 12_001 })
  expect(
    turn?.state.status === 'complete' && turn.state.endedAt,
  ).toBeGreaterThan(tool?.state.status === 'succeeded' ? tool.state.endedAt : 0)
})
