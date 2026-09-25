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
          <pre
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll the source example.
            tabIndex={0}
            {...stylex.props(styles.source)}
          >
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
