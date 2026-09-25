import { expect, it, vi } from 'vitest'
import { ConversationError, ConversationService } from './conversations.mjs'
import { RunStream } from './run-stream.mjs'

const turn = (key = 'account:conversation') => ({
  key,
  resume: false,
  retry: false,
  turnId: 'turn-1',
  input: 'hello',
})

function service(options = {}) {
  return new ConversationService({
    createSession: vi.fn(() => ({})),
    disposeSession: vi.fn(async () => {}),
    ...options,
  })
}

it('owns turn identity, retries, replay, and active exclusion', async () => {
  const conversations = service()
  const first = await conversations.acquire(turn())
  await expect(conversations.acquire(turn())).rejects.toMatchObject({
    status: 409,
  })
  const stream = new RunStream()
  first.session.lastTurn.stream = stream
  const events = [
    { type: 'started' },
    { type: 'reasoning-delta', text: 'Inspecting the catalog.' },
    {
      type: 'tool-started',
      id: 'catalog',
      tool: 'inspect_component_catalog',
      summary: 'Searching',
      input: 'button',
    },
    {
      type: 'tool-completed',
      id: 'catalog',
      tool: 'inspect_component_catalog',
      summary: 'Searched',
      status: 'succeeded',
      output: 'Button',
    },
    { type: 'completed', message: 'Done.' },
  ]
  for (const event of events) stream.write(`${JSON.stringify(event)}\n`)
  stream.end()
  conversations.complete(first.session, first.control)
  conversations.release(first.session, first.control)
  const replay = (await conversations.acquire({ ...turn(), retry: true }))
    .replay
  expect(replay).toBe(stream)
  const response = {
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  }
  replay.attach(response)
  expect(response.write.mock.calls.map(([chunk]) => JSON.parse(chunk))).toEqual(
    events,
  )
  expect(response.end).toHaveBeenCalledOnce()
  await expect(
    conversations.acquire({ ...turn(), retry: true, input: 'changed' }),
  ).rejects.toBeInstanceOf(ConversationError)
})

it('does not let a delayed cancellation abort a newer turn', async () => {
  const conversations = service()
  const first = await conversations.acquire(turn())
  conversations.release(first.session, first.control)
  const next = await conversations.acquire({ ...turn(), turnId: 'turn-2' })
  expect(await conversations.cancel(turn().key, 'turn-1')).toBe(false)
  expect(next.control.abortController.signal.aborted).toBe(false)
  expect(await conversations.cancel(turn().key, 'turn-2')).toBe(true)
  expect(next.control.abortController.signal.aborted).toBe(true)
})

it('cancels, resets, prunes, and disposes sessions', async () => {
  let now = 0
  const disposeSession = vi.fn(async () => {})
  const conversations = service({ disposeSession, maxAge: 10, now: () => now })
  const acquired = await conversations.acquire(turn('one'))
  expect(await conversations.cancel('one', 'turn-1')).toBe(true)
  expect(acquired.control.abortController.signal.aborted).toBe(true)
  conversations.release(acquired.session, acquired.control)
  now = 11
  await conversations.prune()
  expect(disposeSession).toHaveBeenCalledTimes(1)
  const next = await conversations.acquire(turn('two'))
  conversations.release(next.session, next.control)
  await conversations.dispose()
  expect(disposeSession).toHaveBeenCalledTimes(2)
})

it('does not prune a conversation that became active while waiting for its lock', async () => {
  let now = 0
  const disposeSession = vi.fn(async () => {})
  const conversations = service({ disposeSession, maxAge: 10, now: () => now })
  const first = await conversations.acquire(turn())
  conversations.release(first.session, first.control)
  now = 11
  const next = conversations.acquire({ ...turn(), turnId: 'turn-2' })
  const pruning = conversations.prune()
  await next
  await pruning
  expect(disposeSession).not.toHaveBeenCalled()
  expect(await conversations.cancel(turn().key, 'turn-2')).toBe(true)
})
