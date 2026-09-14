import { afterEach, expect, it, vi } from 'vitest'
import type { ChatSnapshot, MessagePart } from '@pretty-amped/foundations/chat'
import { NanocodexChatStore } from '../nanocodex-store'
import { captureThread, playbackStore, type Frame } from './thread-recording'

afterEach(() => vi.useRealTimers())

it('coalesces tokens but retains subagent steps, results and terminal states immediately', () => {
  vi.useFakeTimers()
  const initial = new NanocodexChatStore({ getItem: () => null, setItem: () => {} }).getSnapshot()
  const source = playbackStore(initial)
  const frames: Frame[] = []
  const stop = captureThread(source.store, frame => frames.push(frame))
  const update = (parts: MessagePart[]) => source.update({ ...initial, activity: { status: 'busy', turnId: 'turn' }, turns: [{
    id: 'turn', state: { status: 'running', startedAt: Date.now() },
    user: { id: 'user', role: 'user', turnId: 'turn', createdAt: Date.now(), delivery: { status: 'confirmed' }, parts: [] },
    assistant: [{ id: 'assistant', role: 'assistant', turnId: 'turn', createdAt: Date.now(), delivery: { status: 'confirmed' }, parts }],
  }] })
  update([{ id: 'response', type: 'text', markdown: 'First', state: { status: 'streaming' } }])
  const count = frames.length
  update([{ id: 'response', type: 'text', markdown: 'First second', state: { status: 'streaming' } }])
  update([{ id: 'response', type: 'text', markdown: 'First second third', state: { status: 'streaming' } }])
  expect(frames).toHaveLength(count)
  vi.advanceTimersByTime(150)
  expect(frames).toHaveLength(count + 1)
  const tool: Extract<MessagePart, { type: 'tool' }> = {
    id: 'tool', callId: 'call', toolName: 'run_subagent', type: 'tool',
    presentation: { kind: 'task', activity: { summary: 'Reviewing' }, transcript: { result: '', steps: [] } },
    state: { status: 'running', startedAt: Date.now(), input: {} },
  }
  update([tool])
  const beforeStep = frames.length
  update([{ ...tool, presentation: { kind: 'task', activity: { summary: 'Reviewing' }, transcript: { result: '', steps: [{ id: 'read', tool: 'read', summary: 'Read styles', status: 'succeeded' }] } } }])
  expect(frames).toHaveLength(beforeStep + 1)
  update([{ ...tool, state: { status: 'succeeded', input: {}, endedAt: Date.now() } }])
  expect(frames.at(-1)?.label).toBe('Subagent · succeeded')
  stop()
  vi.runAllTimers()
  expect(frames).toHaveLength(beforeStep + 2)
})

it('cannot mutate a playback store and keeps recorded snapshots separate', () => {
  const initial = new NanocodexChatStore({ getItem: () => null, setItem: () => {} }).getSnapshot()
  const replay = playbackStore(initial)
  const next: ChatSnapshot = { ...initial, activity: { status: 'busy', turnId: 'new' } }
  const notified = vi.fn()
  const unsubscribe = replay.store.subscribe(notified)
  replay.update(next)
  expect(replay.store.getSnapshot()).toBe(next)
  expect(initial.activity.status).toBe('idle')
  expect(notified).toHaveBeenCalledOnce()
  expect(() => replay.store.submit(initial.composer, 'send')).toThrow('read-only')
  expect(() => replay.store.stop('new')).toThrow('read-only')
  expect(() => replay.store.updateDraft(initial.composer)).toThrow('read-only')
  unsubscribe()
})
