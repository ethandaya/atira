import type { ComponentType } from 'react'

import { CodeBlockExample } from './catalog-examples/code-block-example'
import codeBlockSource from './catalog-examples/code-block-example.tsx?raw'
import { ComposerExample } from './catalog-examples/composer-example'
import composerSource from './catalog-examples/composer-example.tsx?raw'
import { MessageExample } from './catalog-examples/message-example'
import messageSource from './catalog-examples/message-example.tsx?raw'
import { ReasoningExample } from './catalog-examples/reasoning-example'
import reasoningSource from './catalog-examples/reasoning-example.tsx?raw'
import { RequestsExample } from './catalog-examples/requests-example'
import requestsSource from './catalog-examples/requests-example.tsx?raw'
import { ToolActivityExample } from './catalog-examples/tool-activity-example'
import toolActivitySource from './catalog-examples/tool-activity-example.tsx?raw'

type CatalogExample = ComponentType

export const catalog = [
  {
    id: 'message',
    name: 'Message',
    family: 'Conversation',
    description: 'Actor-aware messages with accessible response states.',
    props:
      'Set actor to user, assistant, or system. Nest Response to describe streaming, complete, interrupted, or error output.',
    accessibility:
      'Give Message a label to name its article. Actor alone does not provide an accessible name. Response announces streaming, interrupted, and failed states; completed output has no separate status announcement.',
    component: MessageExample,
    source: messageSource,
  },
  {
    id: 'reasoning',
    name: 'Reasoning',
    family: 'Conversation',
    description: 'A disclosure for active and completed reasoning.',
    props:
      'Pass state.status and optional duration. Use defaultOpen only when the evidence should begin expanded.',
    accessibility:
      'The disclosure is a keyboard-operable button with an announced expanded state.',
    component: ReasoningExample,
    source: reasoningSource,
  },
  {
    id: 'tool-activity',
    name: 'ToolActivity',
    family: 'Agent workflow',
    description: 'Collapsible tool evidence with an explicit status.',
    props:
      'Provide a stable id, tool name, summary, and state. Put logs or output in children.',
    accessibility:
      'Write summaries that make sense without the icon; status and disclosure state are announced.',
    component: ToolActivityExample,
    source: toolActivitySource,
  },
  {
    id: 'requests',
    name: 'Permission & Question',
    family: 'Agent workflow',
    description: 'Focused approval and structured question boundaries.',
    props:
      'Pending permissions require onApprove and onReject. Keep QuestionRequest state controlled and resolve every answer or dismissal.',
    accessibility:
      'Effects and consequences are linked to their headings. Return focus or expose a visible outcome after resolving a request.',
    component: RequestsExample,
    source: requestsSource,
  },
  {
    id: 'composer',
    name: 'Composer',
    family: 'Input',
    description: 'A controlled multiline prompt with explicit submission.',
    props:
      'Control value with onValueChange and handle onSubmit. Disable submission in the runtime adapter while work is unavailable.',
    accessibility:
      'The textarea has a persistent accessible name. Ctrl+Enter or Cmd+Enter submits; Enter inserts a line.',
    component: ComposerExample,
    source: composerSource,
  },
  {
    id: 'code-block',
    name: 'CodeBlock',
    family: 'Output',
    description: 'Copyable code with language and filename context.',
    props:
      'Supply code, language, and an optional filename. The component owns copy feedback.',
    accessibility:
      'Use an accurate language and filename so the code region and copy action have useful context.',
    component: CodeBlockExample,
    source: codeBlockSource,
  },
] as const satisfies readonly {
  accessibility: string
  component: CatalogExample
  description: string
  family: string
  id: string
  name: string
  props: string
  source: string
}[]

export type CatalogEntry = (typeof catalog)[number]
export type CatalogId = CatalogEntry['id']
