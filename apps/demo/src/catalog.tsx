import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

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

export type CatalogEntry = {
  accessibility: string
  description: string
  family: string
  id: CatalogId
  name: string
  props: string
}

export type CatalogId =
  | 'message'
  | 'reasoning'
  | 'tool-activity'
  | 'requests'
  | 'composer'
  | 'code-block'

export const catalog: readonly CatalogEntry[] = [
  {
    id: 'message',
    name: 'Message',
    family: 'Conversation',
    description: 'Actor-aware messages with accessible response states.',
    props:
      'Set actor to user, assistant, or system. Nest Response to describe streaming, complete, interrupted, or error output.',
    accessibility:
      'Give Message a label to name its article. Actor alone does not provide an accessible name. Response announces streaming, interrupted, and failed states; completed output has no separate status announcement.',
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
  },
] as const

const sources: Record<CatalogId, string> = {
  'code-block': codeBlockSource,
  composer: composerSource,
  message: messageSource,
  reasoning: reasoningSource,
  requests: requestsSource,
  'tool-activity': toolActivitySource,
}

function Example({ id, compact }: { id: CatalogId; compact: boolean }) {
  if (id === 'message') return <MessageExample />
  if (id === 'reasoning') return <ReasoningExample compact={compact} />
  if (id === 'tool-activity') return <ToolActivityExample compact={compact} />
  if (id === 'requests') return <RequestsExample compact={compact} />
  if (id === 'composer') return <ComposerExample compact={compact} />
  return <CodeBlockExample compact={compact} />
}

export function CatalogPreview({
  id,
  compact = false,
  showSource = false,
}: {
  id: CatalogId
  compact?: boolean
  showSource?: boolean
}) {
  return (
    <>
      <div {...stylex.props(styles.preview, compact && styles.compact)}>
        <Example id={id} compact={compact} />
      </div>
      {showSource && (
        <section aria-labelledby="code-heading" {...stylex.props(styles.usage)}>
          <h2 id="code-heading" {...stylex.props(styles.heading)}>
            Usage
          </h2>
          <p {...stylex.props(styles.status)}>Source used by this example.</p>
          <pre tabIndex={0} {...stylex.props(styles.source)}>
            <code>{sources[id]}</code>
          </pre>
        </section>
      )}
    </>
  )
}

const styles = stylex.create({
  preview: {
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    minInlineSize: 0,
    padding: 'clamp(1rem, 4vw, 3rem)',
  },
  compact: {
    alignItems: 'center',
    borderWidth: 0,
    display: 'flex',
    inlineSize: '100%',
    justifyContent: 'center',
    padding: 0,
  },
  status: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    margin: 0,
  },
  usage: { marginBlockStart: '4rem' },
  heading: { fontSize: type.sizeInput, marginBlock: `0 ${space.x4}` },
  source: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    lineHeight: 1.65,
    overflow: 'auto',
    padding: space.x5,
  },
})
