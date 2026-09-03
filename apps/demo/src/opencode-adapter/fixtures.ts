import type { Event, Message, Part } from '@opencode-ai/sdk/v2'

export const sessionId = 'session-fixture'

export const userMessage: Extract<Message, { role: 'user' }> = {
  agent: 'build',
  id: 'message-user',
  model: { modelID: 'fixture-model', providerID: 'fixture-provider' },
  role: 'user',
  sessionID: sessionId,
  time: { created: 1_000 },
}

export const assistantMessage: Extract<Message, { role: 'assistant' }> = {
  agent: 'build',
  cost: 0,
  id: 'message-assistant',
  mode: 'build',
  modelID: 'fixture-model',
  parentID: userMessage.id,
  path: { cwd: '/workspace', root: '/workspace' },
  providerID: 'fixture-provider',
  role: 'assistant',
  sessionID: sessionId,
  time: { created: 1_100 },
  tokens: {
    cache: { read: 0, write: 0 },
    input: 12,
    output: 8,
    reasoning: 4,
  },
}

export const completedAssistantMessage: typeof assistantMessage = {
  ...assistantMessage,
  finish: 'stop',
  time: { completed: 1_900, created: 1_100 },
}

export const userTextPart: Extract<Part, { type: 'text' }> = {
  id: 'part-user-text',
  messageID: userMessage.id,
  sessionID: sessionId,
  text: 'Inspect the adapter.',
  type: 'text',
}

export const reasoningPart: Extract<Part, { type: 'reasoning' }> = {
  id: 'part-reasoning',
  messageID: assistantMessage.id,
  sessionID: sessionId,
  text: 'I will inspect the source.',
  time: { end: 1_300, start: 1_150 },
  type: 'reasoning',
}

export const pendingToolPart: Extract<Part, { type: 'tool' }> = {
  callID: 'call-read',
  id: 'part-tool',
  messageID: assistantMessage.id,
  sessionID: sessionId,
  state: {
    input: {},
    raw: '{"filePath":"/workspace/src/app.tsx"}',
    status: 'pending',
  },
  tool: 'read',
  type: 'tool',
}

export const runningToolPart: typeof pendingToolPart = {
  ...pendingToolPart,
  state: {
    input: { filePath: '/workspace/src/app.tsx' },
    status: 'running',
    time: { start: 1_350 },
    title: 'Read src/app.tsx',
  },
}

export const completedToolPart: typeof pendingToolPart = {
  ...pendingToolPart,
  state: {
    input: { filePath: '/workspace/src/app.tsx' },
    metadata: { lineCount: 2 },
    output: 'export function App() {}',
    status: 'completed',
    time: { end: 1_600, start: 1_350 },
    title: 'Read src/app.tsx',
  },
}

export const assistantTextPart: Extract<Part, { type: 'text' }> = {
  id: 'part-assistant-text',
  messageID: assistantMessage.id,
  sessionID: sessionId,
  text: 'The adapter preserves event state.',
  time: { end: 1_850, start: 1_650 },
  type: 'text',
}

export const ordinaryConversationEvents = [
  messageEvent('event-message-user', userMessage),
  partEvent('event-part-user', userTextPart, 1_010),
  messageEvent('event-message-assistant', assistantMessage),
  partEvent('event-part-reasoning', reasoningPart, 1_300),
  partEvent('event-tool-pending', pendingToolPart, 1_320),
  partEvent('event-tool-running', runningToolPart, 1_350),
  partEvent('event-tool-complete', completedToolPart, 1_600),
  partEvent('event-part-assistant', assistantTextPart, 1_850),
  messageEvent('event-message-assistant-complete', completedAssistantMessage),
  {
    id: 'event-session-idle',
    properties: { sessionID: sessionId },
    type: 'session.idle',
  },
] satisfies readonly Event[]

export const outOfOrderEvents = [
  {
    id: 'event-early-text-delta',
    properties: {
      delta: 'Arrived before its parent.',
      field: 'text',
      messageID: assistantMessage.id,
      partID: assistantTextPart.id,
      sessionID: sessionId,
    },
    type: 'message.part.delta',
  },
  partEvent(
    'event-late-part',
    { ...assistantTextPart, text: '', time: { start: 1_650 } },
    1_700,
  ),
  messageEvent('event-late-message', assistantMessage),
] satisfies readonly Event[]

export const requestEvents = [
  {
    id: 'event-question',
    properties: {
      id: 'request-question',
      questions: [
        {
          custom: true,
          header: 'Framework',
          multiple: false,
          options: [
            { description: 'Keep the current stack.', label: 'StyleX' },
            { description: 'Use utility classes.', label: 'Tailwind' },
          ],
          question: 'Which styling system should be used?',
        },
      ],
      sessionID: sessionId,
    },
    type: 'question.asked',
  },
  {
    id: 'event-permission',
    properties: {
      action: 'write',
      id: 'request-permission',
      resources: ['/workspace/src/app.tsx'],
      save: ['project'],
      sessionID: sessionId,
    },
    type: 'permission.v2.asked',
  },
] satisfies readonly Event[]

export function messageEvent(id: string, info: Message): Event {
  return {
    id,
    properties: { info, sessionID: info.sessionID },
    type: 'message.updated',
  }
}

export function partEvent(id: string, part: Part, time: number): Event {
  return {
    id,
    properties: { part, sessionID: part.sessionID, time },
    type: 'message.part.updated',
  }
}
