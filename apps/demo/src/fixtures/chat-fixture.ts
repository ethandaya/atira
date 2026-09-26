import type {
  ChatCapabilities,
  ChatTurn,
  ComposerDraft,
} from '@atira/foundations/chat'

export const fixtureCapabilities: ChatCapabilities = {
  agents: [
    { id: 'build', label: 'Build' },
    { id: 'plan', label: 'Plan' },
  ],
  busySubmission: ['queue'],
  canAttach: true,
  canStop: true,
  canSubmit: true,
  canUseShell: true,
  models: [{ label: 'Fixture 1', modelId: 'fixture-1', providerId: 'fixture' }],
  permissionDecisions: ['once', 'always', 'reject'],
  referenceTypes: ['file', 'range', 'resource', 'agent'],
  variants: [{ id: 'precise', label: 'Precise' }],
}

export function createTurn(index: number, response: string): ChatTurn {
  const id = `fixture-turn:${index}`
  const userId = `${id}:user`
  const assistantId = `${id}:assistant`
  return {
    assistant: [
      {
        createdAt: index * 10 + 2,
        delivery: { status: 'confirmed' },
        id: assistantId,
        parts: [
          {
            id: `${assistantId}:text`,
            markdown: response,
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'assistant',
        turnId: id,
      },
    ],
    id,
    state: {
      endedAt: index * 10 + 3,
      startedAt: index * 10 + 1,
      status: 'complete',
    },
    user: {
      createdAt: index * 10 + 1,
      delivery: { status: 'confirmed' },
      id: userId,
      parts: [
        {
          id: `${userId}:text`,
          markdown: `Fixture prompt ${index + 1}`,
          state: { status: 'complete' },
          type: 'text',
        },
      ],
      role: 'user',
      turnId: id,
    },
  }
}

export function createDraft(text = '', revision = 0): ComposerDraft {
  const id = `fixture-draft:${revision}:text`
  const agent = fixtureCapabilities.agents[0]
  const model = fixtureCapabilities.models[0]
  const variant = fixtureCapabilities.variants[0]
  return {
    ...(agent === undefined ? {} : { agent }),
    attachments: [],
    mode: 'prompt',
    ...(model === undefined ? {} : { model }),
    revision,
    segments: [{ id, text, type: 'text' }],
    selection: {
      anchor: { offset: text.length, segmentId: id },
      focus: { offset: text.length, segmentId: id },
    },
    ...(variant === undefined ? {} : { variant: variant.id }),
  }
}
