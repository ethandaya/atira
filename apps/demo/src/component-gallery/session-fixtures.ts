import type {
  PermissionRequestView,
  QuestionRequestView,
  QueuedPrompt,
  RevertedPrompt,
  TodoListView,
} from '@atira/foundations/chat'

import { createDraft, fixtureCapabilities } from '../fixtures/chat-fixture'
import { createWorkflowSnapshot } from '../fixtures/workflow-snapshot'

export const galleryTurn = createWorkflowSnapshot().turns.at(-1)!
export const galleryDraft = createDraft('Continue the interface audit.')
export const galleryCapabilities = fixtureCapabilities

export const galleryCommands = [
  {
    description: 'Condense earlier context before continuing.',
    id: 'compact',
    label: 'Compact context',
    value: '/compact',
  },
  {
    description: 'Start a design-focused review.',
    id: 'review',
    label: 'Review interface',
    value: '/review',
  },
] as const

export const galleryReferences = [
  {
    description: 'Turn and message presentation.',
    id: 'turn-source',
    label: 'turn.tsx',
    referenceType: 'file',
    value: 'packages/components/src/turn.tsx',
  },
  {
    description: 'Canonical chat contracts.',
    id: 'chat-contracts',
    label: 'chat.ts',
    referenceType: 'file',
    value: 'packages/foundations/src/chat.ts',
  },
] as const

export const galleryPromptHistory = [
  {
    draft: galleryDraft,
    id: 'history-audit',
    label: 'Continue the interface audit',
  },
] as const

export const galleryPermission: PermissionRequestView = {
  consequence: 'external',
  effect: 'Fetch https://example.com/design-system',
  id: 'gallery-chat-permission',
  order: 0,
  origin: { label: 'Main session', sessionId: 'gallery-session' },
  scope: 'This can be remembered for this project.',
  state: { status: 'pending' },
  title: 'Use the network?',
  type: 'permission',
}

export const galleryQuestion: QuestionRequestView = {
  id: 'gallery-chat-question',
  order: 1,
  origin: { label: 'Design review', sessionId: 'gallery-session' },
  questions: [
    {
      allowCustom: true,
      id: 'gallery-density',
      label: 'Choose an interface density',
      options: [
        { description: 'More room between turns.', id: 'calm', label: 'Calm' },
        {
          description: 'More context on screen.',
          id: 'compact',
          label: 'Compact',
        },
      ],
      required: true,
      type: 'single-choice',
    },
    {
      id: 'gallery-notes',
      label: 'Anything else to preserve?',
      multiline: true,
      required: false,
      type: 'text',
    },
  ],
  state: { status: 'pending' },
  type: 'question',
}

export const galleryTodos: TodoListView = {
  id: 'gallery-chat-todos',
  items: [
    { id: 'contracts', state: 'complete', title: 'Define contracts' },
    { id: 'events', state: 'in-progress', title: 'Reconcile event stream' },
    { id: 'review', state: 'pending', title: 'Review mobile layout' },
  ],
  state: 'active',
}

export const galleryRevert: RevertedPrompt = {
  draft: galleryDraft,
  id: 'gallery-reverted-prompt',
  turnId: galleryTurn.id,
}

export const galleryQueue: readonly QueuedPrompt[] = [
  { draft: galleryDraft, id: 'gallery-queued', state: 'queued' },
  {
    draft: createDraft('Retry the visual check.', 1),
    error: {
      kind: 'connection',
      message: 'The runtime disconnected.',
      retryable: true,
    },
    id: 'gallery-queue-failed',
    state: 'failed',
  },
]
