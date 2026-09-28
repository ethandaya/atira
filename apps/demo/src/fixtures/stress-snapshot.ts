import type { ChatSnapshot, ChatTurn } from '@atiraui/foundations/chat'

import { createDraft, createTurn, fixtureCapabilities } from './chat-fixture'

export function createStressSnapshot(): ChatSnapshot {
  const turns = Array.from({ length: 500 }, (_, index) =>
    createStressTurn(index, index === 499),
  )
  return {
    activity: { status: 'busy', turnId: 'fixture-turn:499' },
    capabilities: fixtureCapabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { status: 'complete' },
    queue: [],
    requests: [],
    sessionId: 'stress-fixture',
    turns,
  }
}

function createStressTurn(index: number, large: boolean): ChatTurn {
  const paragraph = 'Complete markdown source. '.repeat(20)
  const turn = createTurn(
    index,
    large
      ? `# Large response\n\n${`${paragraph}\n\n`.repeat(419)}${paragraph}`
      : `Response ${index + 1}`,
  )
  const assistant = turn.assistant[0]
  if (!assistant) return turn
  const notices = Array.from({ length: 8 }, (_, partIndex) => ({
    id: `${assistant.id}:notice:${partIndex}`,
    message: `Evidence ${index + 1}.${partIndex + 1}`,
    tone: 'neutral' as const,
    type: 'notice' as const,
  }))
  const parts = large
    ? [
        ...notices.slice(0, 7),
        {
          callId: 'large-output-call',
          id: 'large-output-tool',
          metadata: { truncated: false },
          presentation: {
            command: 'generate-large-output',
            kind: 'shell' as const,
            outputTruncated: false,
          },
          state: {
            endedAt: index + 2,
            input: { command: 'generate-large-output' },
            output: 'line\n'.repeat(200_000),
            status: 'succeeded' as const,
          },
          toolName: 'shell',
          type: 'tool' as const,
        },
        ...assistant.parts,
      ]
    : [...notices, ...assistant.parts]
  return {
    ...turn,
    assistant: [
      {
        ...assistant,
        parts: parts.map((part) =>
          large && part.type === 'text'
            ? { ...part, state: { status: 'streaming' } }
            : part,
        ),
      },
    ],
    state: large
      ? { startedAt: index * 10 + 1, status: 'running' }
      : turn.state,
  }
}
