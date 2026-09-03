import { selectActiveRequest } from '@pretty-amped/foundations/chat-invariants'
import { describe, expect, it } from 'vitest'

import {
  assistantMessage,
  assistantTextPart,
  completedToolPart,
  messageEvent,
  nativeLifecycleEvents,
  ordinaryConversationEvents,
  outOfOrderEvents,
  partEvent,
  requestEvents,
  sessionId,
  userMessage,
} from './fixtures'
import { projectOpenCodeState } from './project'
import {
  createOpenCodeAdapterState,
  mergeOpenCodeMessagePage,
  reduceOpenCodeEvent,
} from './state'

describe('OpenCode event reduction', () => {
  it('projects a complete turn and ignores duplicate event replay', () => {
    const reduced = reduceEvents(ordinaryConversationEvents)
    const replayed = ordinaryConversationEvents.reduce(reduceOpenCodeEvent, reduced)
    const projection = projectOpenCodeState(replayed)

    expect(replayed).toBe(reduced)
    expect(projection.activity).toEqual({ status: 'idle' })
    expect(projection.turns).toHaveLength(1)
    expect(projection.turns[0]?.state).toEqual({
      endedAt: 1_900,
      startedAt: 1_100,
      status: 'complete',
      stopReason: 'stop',
    })
    expect(projection.turns[0]?.assistant[0]?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: { durationMs: 250, lineCount: 2 },
          presentation: { kind: 'context', operation: 'read' },
          state: expect.objectContaining({ status: 'succeeded' }),
          type: 'tool',
        }),
      ]),
    )
  })

  it('buffers a delta and part until their parent message arrives', () => {
    const state = reduceEvents(outOfOrderEvents)
    const part = state.messages[assistantMessage.id]?.parts[0]

    expect(state.orphanParts).toEqual({})
    expect(state.pendingDeltas).toEqual({})
    expect(part).toMatchObject({
      id: assistantTextPart.id,
      text: 'Arrived before its parent.',
      type: 'text',
    })
  })

  it('keeps newer event state while merging missing parts from an older page', () => {
    let state = reduceEvents([
      messageEvent('message', assistantMessage),
      partEvent('part', { ...assistantTextPart, text: 'New' }, 2_000),
    ])

    state = mergeOpenCodeMessagePage(state, [
      {
        info: { ...assistantMessage, time: { created: 900 } },
        parts: [{ ...assistantTextPart, text: 'Old' }, completedToolPart],
      },
    ])

    expect(state.messages[assistantMessage.id]?.info.time.created).toBe(1_100)
    expect(state.messages[assistantMessage.id]?.parts).toHaveLength(2)
    expect(state.messages[assistantMessage.id]?.parts[0]).toMatchObject({ text: 'New' })
  })

  it('does not resurrect tombstoned entities from a stale page', () => {
    let state = reduceEvents([
      messageEvent('message', userMessage),
      {
        id: 'remove',
        properties: { messageID: userMessage.id, sessionID: sessionId },
        type: 'message.removed',
      },
    ])

    state = mergeOpenCodeMessagePage(state, [{ info: userMessage, parts: [] }])

    expect(state.messages[userMessage.id]).toBeUndefined()
    expect(state.messageTombstones.has(userMessage.id)).toBe(true)
  })

  it('prioritizes permission requests and preserves structured decisions', () => {
    let state = reduceEvents(requestEvents)
    expect(selectActiveRequest(state.requests)?.id).toBe('request-permission')

    state = reduceOpenCodeEvent(state, {
      id: 'permission-resolved',
      properties: {
        reply: 'once',
        requestID: 'request-permission',
        sessionID: sessionId,
      },
      type: 'permission.v2.replied',
    })
    state = reduceOpenCodeEvent(state, {
      id: 'question-resolved',
      properties: {
        answers: [['StyleX']],
        requestID: 'request-question',
        sessionID: sessionId,
      },
      type: 'question.replied',
    })

    expect(state.requests).toEqual([
      expect.objectContaining({
        id: 'request-question',
        state: {
          decision: {
            response: {
              answers: [
                {
                  optionIds: ['request-question:question:0:option:0'],
                  questionId: 'request-question:question:0',
                  type: 'choice',
                },
              ],
            },
            type: 'answer',
          },
          status: 'resolved',
        },
      }),
      expect.objectContaining({
        id: 'request-permission',
        state: { decision: 'once', status: 'resolved' },
      }),
    ])
  })

  it('clears canonical todos when OpenCode clears the list', () => {
    let state = reduceOpenCodeEvent(createOpenCodeAdapterState(sessionId), {
      id: 'todo-set',
      properties: {
        sessionID: sessionId,
        todos: [{ content: 'Build reducer', priority: 'high', status: 'in_progress' }],
      },
      type: 'todo.updated',
    })
    expect(state.todos?.items[0]?.state).toBe('in-progress')

    state = reduceOpenCodeEvent(state, {
      id: 'todo-clear',
      properties: { sessionID: sessionId, todos: [] },
      type: 'todo.updated',
    })
    expect(state.todos).toBeUndefined()
  })

  it('reduces native next-generation reasoning, tool, text, and step events', () => {
    const state = reduceEvents(nativeLifecycleEvents)
    const projection = projectOpenCodeState(state)
    const parts = projection.turns[0]?.assistant[0]?.parts

    expect(projection.turns[0]?.state).toEqual({
      endedAt: 1_400,
      startedAt: 1_100,
      status: 'complete',
      stopReason: 'stop',
    })
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: { status: 'complete' },
          text: 'Inspecting.',
          type: 'reasoning',
        }),
        expect.objectContaining({
          callId: 'native-call',
          state: expect.objectContaining({
            input: { filePath: '/workspace/app.tsx' },
            output: 'export function App() {}',
            status: 'succeeded',
          }),
          toolName: 'read',
          type: 'tool',
        }),
        expect.objectContaining({
          markdown: 'Done.',
          state: { status: 'complete' },
          type: 'text',
        }),
      ]),
    )
  })

  it('projects structured native tool progress before completion', () => {
    const progressIndex = nativeLifecycleEvents.findIndex(
      (event) => event.type === 'session.next.tool.progress',
    )
    const state = reduceEvents(nativeLifecycleEvents.slice(0, progressIndex + 1))
    const parts = projectOpenCodeState(state).turns[0]?.assistant[0]?.parts

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: expect.objectContaining({
            progress: { current: 1, total: 1 },
            status: 'running',
          }),
          type: 'tool',
        }),
      ]),
    )
  })

  it('reconciles generated tool parts with canonical message parts by call ID', () => {
    const state = reduceEvents([
      ...nativeLifecycleEvents.slice(0, 10),
      partEvent(
        'canonical-tool-part',
        {
          ...completedToolPart,
          callID: 'native-call',
          id: 'canonical-native-tool',
        },
        1_350,
      ),
    ])
    const tools = state.messages[assistantMessage.id]?.parts.filter(
      (part) => part.type === 'tool' && part.callID === 'native-call',
    )

    expect(tools).toHaveLength(1)
    expect(tools?.[0]?.id).toBe('canonical-native-tool')
  })

  it('tracks native staged revert lifecycle without stale state', () => {
    let state = reduceOpenCodeEvent(createOpenCodeAdapterState(sessionId), {
      id: 'revert-staged',
      properties: {
        revert: { messageID: userMessage.id },
        sessionID: sessionId,
        timestamp: 2_000,
      },
      type: 'session.next.revert.staged',
    })
    expect(state.revert).toEqual({ messageID: userMessage.id })

    state = reduceOpenCodeEvent(state, {
      id: 'revert-cleared',
      properties: { sessionID: sessionId, timestamp: 2_100 },
      type: 'session.next.revert.cleared',
    })
    expect(state.revert).toBeUndefined()
  })
})

function reduceEvents(events: Parameters<typeof reduceOpenCodeEvent>[1][]) {
  return events.reduce(reduceOpenCodeEvent, createOpenCodeAdapterState(sessionId))
}
