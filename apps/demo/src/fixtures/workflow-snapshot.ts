import type {
  ChatSnapshot,
  ChatTurn,
  JsonValue,
  ToolPart,
  ToolPresentation,
} from '@atira/foundations/chat'

import { createDraft, createTurn, fixtureCapabilities } from './chat-fixture'

export function createWorkflowSnapshot(): ChatSnapshot {
  const turns = Array.from({ length: 18 }, (_, index) =>
    createTurn(index, `Fixture response ${index + 1}`),
  )
  turns[17] = createToolFixtureTurn(17)
  return {
    activity: { status: 'idle' },
    capabilities: fixtureCapabilities,
    composer: createDraft(),
    connection: { status: 'connected' },
    history: { hasPrevious: true, status: 'ready' },
    queue: [],
    requests: [],
    sessionId: 'workflow-fixture',
    turns,
  }
}

function createToolFixtureTurn(index: number): ChatTurn {
  const turn = createTurn(index, 'The coding evidence is available below.')
  const assistant = turn.assistant[0]
  if (!assistant) return turn
  const tools: ToolPart[] = [
    completedTool(
      'context-read',
      'read',
      {
        kind: 'context',
        operation: 'read',
        target: 'packages/components/src/turn.tsx',
      },
      { path: 'packages/components/src/turn.tsx' },
      'export function Turn() {}',
    ),
    completedTool(
      'context-grep',
      'grep',
      { kind: 'context', operation: 'grep', target: 'data-slot' },
      { pattern: 'data-slot' },
      '12 matches',
    ),
    completedTool(
      'shell',
      'shell',
      {
        command: 'pnpm typecheck',
        durationMs: 420,
        exitCode: 0,
        kind: 'shell',
        outputTruncated: false,
        workingDirectory: '/workspace',
      },
      { command: 'pnpm typecheck' },
      'Done',
    ),
    completedTool(
      'file-change',
      'edit',
      {
        diagnostics: [],
        files: [
          {
            additions: 1,
            deletions: 1,
            hunks: [
              {
                header: '@@ -1 +1 @@',
                id: 'fixture-hunk',
                lines: [
                  {
                    content: 'const density = "compact"',
                    id: 'fixture-deletion',
                    kind: 'deletion',
                    oldLine: 1,
                  },
                  {
                    content: 'const density = "comfortable"',
                    id: 'fixture-addition',
                    kind: 'addition',
                    newLine: 1,
                  },
                ],
              },
            ],
            id: 'fixture-file',
            path: 'src/interface.ts',
            status: 'modified',
          },
        ],
        kind: 'file-change',
        operation: 'edit',
        path: 'src/interface.ts',
        content: 'const density = "comfortable"',
      },
      { path: 'src/interface.ts' },
      'Updated',
    ),
    completedTool(
      'task',
      'task',
      {
        agent: { id: 'review', label: 'Review agent' },
        childSessionId: 'fixture-child-session',
        description: 'Review the chat surface',
        kind: 'task',
        transcript: {
          reasoning: 'I compared the activity states and transcript hierarchy.',
          result:
            '**No blocking issues.** The activity rail remains stable across states.',
          steps: [
            {
              id: 'fixture-child-inspect',
              input: 'activity hierarchy',
              output: 'Reasoning, ToolActivity, MessageParts',
              status: 'succeeded',
              summary: 'Searched component catalog',
              tool: 'inspect_component_catalog',
            },
          ],
        },
      },
      { description: 'Review the chat surface' },
      'No blocking issues.',
    ),
    completedTool(
      'web',
      'webfetch',
      {
        kind: 'web',
        operation: 'fetch',
        target: 'https://example.com/reference',
      },
      { url: 'https://example.com/reference' },
      'Reference loaded.',
    ),
    completedTool(
      'skill',
      'skill',
      { kind: 'skill', name: 'ui-review' },
      { name: 'ui-review' },
      'Skill loaded.',
    ),
    completedTool(
      'generic',
      'mcp_custom_tool',
      { kind: 'generic' },
      { query: 'component contract' },
      { matches: 2 },
    ),
  ]
  return {
    ...turn,
    assistant: [{ ...assistant, parts: [...assistant.parts, ...tools] }],
  }
}

function completedTool(
  id: string,
  toolName: string,
  presentation: ToolPresentation,
  input: JsonValue,
  output: JsonValue,
): ToolPart {
  return {
    callId: `fixture:${id}:call`,
    id: `fixture:${id}`,
    presentation,
    state: {
      endedAt: 180,
      input,
      output,
      status: 'succeeded',
    },
    toolName,
    type: 'tool',
  }
}
