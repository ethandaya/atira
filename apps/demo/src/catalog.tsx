import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

import { catalog, type CatalogId } from './catalog-definition'

export function CatalogPreview({
  id,
  compact = false,
  showSource = false,
}: {
  id: CatalogId
  compact?: boolean
  showSource?: boolean
}) {
  const entry = catalog.find((item) => item.id === id)
  if (!entry) throw new Error(`Unknown catalog example: ${id}`)
  const Example = entry.component
  return (
    <>
      <div {...stylex.props(styles.preview, compact && styles.compact)}>
        <Example />
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
            <code>{entry.source}</code>
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
