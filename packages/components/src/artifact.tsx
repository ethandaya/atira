import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, resolveStyleProps, type StyleProps } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef } from 'react'

export type ArtifactKind = 'file' | 'image' | 'portal' | 'result'
export type ArtifactMetadata = Readonly<{
  id: string
  label: string
  value: string
}>
export type ArtifactState =
  | { status: 'generating' }
  | { status: 'ready' }
  | { error: string; status: 'failed' }

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'children' | 'className' | 'id' | 'style' | 'title'
>

type ArtifactBaseProps = NativeSectionProps & StyleProps & {
  description?: string
  headingLevel?: 2 | 3 | 4 | 5 | 6
  id: string
  kind: ArtifactKind
  metadata?: readonly ArtifactMetadata[]
  openLabel?: string
  title: string
}

type ReadyArtifactProps = ArtifactBaseProps & {
  onOpen?: () => void
  state: { status: 'ready' }
}

type UnavailableArtifactProps = ArtifactBaseProps & {
  onOpen?: never
  state: Exclude<ArtifactState, { status: 'ready' }>
}

export type ArtifactProps = ReadyArtifactProps | UnavailableArtifactProps

const kindLabels: Record<ArtifactKind, string> = {
  file: 'File',
  image: 'Image',
  portal: 'Portal',
  result: 'Result',
}

const stateLabels: Record<ArtifactState['status'], string> = {
  failed: 'Failed',
  generating: 'Generating',
  ready: 'Ready',
}

export function Artifact(props: ArtifactProps) {
  const {
    description,
    className,
    headingLevel = 2,
    id,
    kind,
    metadata,
    onOpen,
    openLabel = 'Open artifact',
    state,
    style,
    title,
    xstyle,
    ...sectionProps
  } = props
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      {...sectionProps}
      id={id}
      aria-busy={state.status === 'generating' || undefined}
      aria-labelledby={titleId}
      data-artifact-id={id}
      data-kind={kind}
      data-slot="artifact"
      data-state={state.status}
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      <div data-slot="artifact-content" {...stylex.props(styles.content)}>
        <div data-slot="artifact-heading" {...stylex.props(styles.heading)}>
          <div {...stylex.props(styles.headingText)}>
            <span data-slot="artifact-kind" {...stylex.props(styles.kind)}>
              {kindLabels[kind]}
            </span>
            <Heading id={titleId} data-slot="artifact-title" {...stylex.props(styles.title)}>
              {title}
            </Heading>
          </div>
          <span
            role="status"
            data-slot="artifact-status"
            {...stylex.props(
              styles.status,
              state.status === 'failed' && styles.failed,
            )}
          >
            {stateLabels[state.status]}
          </span>
        </div>
        {description && (
          <p data-slot="artifact-description" {...stylex.props(styles.description)}>
            {description}
          </p>
        )}
        {state.status === 'failed' && (
          <p data-slot="artifact-error" {...stylex.props(styles.error)}>
            {state.error}
          </p>
        )}
        {metadata && metadata.length > 0 && (
          <dl data-slot="artifact-metadata" {...stylex.props(styles.metadata)}>
            {metadata.map((item) => (
              <div key={item.id} {...stylex.props(styles.metadataItem)}>
                <dt {...stylex.props(styles.metadataLabel)}>{item.label}</dt>
                <dd {...stylex.props(styles.metadataValue)}>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {state.status === 'ready' && onOpen && (
        <div data-slot="artifact-actions" {...stylex.props(styles.actions)}>
          <Button onClick={onOpen} size="compact" variant="outline">
            {openLabel}
          </Button>
        </div>
      )}
    </section>
  )
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    inlineSize: '100%',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    padding: space.x4,
  },
  heading: {
    alignItems: 'start',
    display: 'flex',
    gap: space.x3,
    justifyContent: 'space-between',
  },
  headingText: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  kind: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  status: {
    color: colors.textMuted,
    flexShrink: 0,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  failed: {
    color: colors.danger,
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  error: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x3,
    margin: 0,
  },
  metadataItem: {
    alignItems: 'baseline',
    display: 'flex',
    gap: space.x1,
  },
  metadataLabel: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
  },
  metadataValue: {
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    margin: 0,
  },
  actions: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    display: 'flex',
    justifyContent: 'flex-end',
    paddingBlock: space.x2,
    paddingInline: space.x4,
  },
})
