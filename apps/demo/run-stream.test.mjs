import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { RunStream } from './run-stream.mjs'

afterEach(() => vi.useRealTimers())

function response() {
  const client = new EventEmitter()
  client.writeHead = vi.fn()
  client.flushHeaders = vi.fn()
  client.write = vi.fn()
  client.end = vi.fn(() => client.emit('close'))
  return client
}

it('replays buffered events before live events and survives a disconnected client', () => {
  vi.useFakeTimers()
  const stream = new RunStream()
  stream.write('{"type":"started"}\n')
  const first = response()
  const second = response()
  stream.attach(first)
  vi.advanceTimersByTime(15_000)
  first.emit('close')
  stream.attach(second)
  stream.write('{"type":"completed"}\n')
  stream.end()
  stream.write('ignored')
  expect(first.write.mock.calls).toEqual([['{"type":"started"}\n'], ['\n']])
  expect(second.write.mock.calls).toEqual([
    ['{"type":"started"}\n'],
    ['{"type":"completed"}\n'],
  ])
  expect(second.end).toHaveBeenCalledOnce()
  const replay = response()
  stream.attach(replay)
  expect(replay.write.mock.calls).toEqual(second.write.mock.calls)
  expect(replay.end).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps live output but refuses partial replay above the byte limit', () => {
  vi.useFakeTimers()
  const stream = new RunStream(4)
  const live = response()
  stream.attach(live)
  stream.write('éé')
  const atLimit = response()
  stream.attach(atLimit)
  expect(atLimit.write).toHaveBeenCalledWith('éé')
  stream.write('x')
  const overLimit = response()
  stream.attach(overLimit)
  expect(overLimit.writeHead).toHaveBeenCalledWith(409, expect.any(Object))
  expect(overLimit.write).not.toHaveBeenCalled()
  expect(JSON.parse(overLimit.end.mock.calls[0][0]).error).toContain(
    'replay limit',
  )
  expect(live.write.mock.calls).toEqual([['éé'], ['x']])
  stream.end()
  expect(vi.getTimerCount()).toBe(0)
})
