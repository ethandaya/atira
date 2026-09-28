import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'

export type OutcomeState =
  | { status: 'complete' }
  | { status: 'failed' }
  | { status: 'cancelled' }
  | { status: 'blocked' }
  | { status: 'reviewable' }

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'children' | 'className' | 'id' | 'style' | 'title'
>

export type OutcomeProps = NativeSectionProps & {
  actions?: ReactNode
  children?: ReactNode
  headingLevel?: 2 | 3 | 4 | 5 | 6
  id: string
  state: OutcomeState
  title: ReactNode
}

const stateLabels: Record<OutcomeState['status'], string> = {
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  complete: 'Complete',
  failed: 'Failed',
  reviewable: 'Ready for review',
}

export function Outcome({
  actions,
  children,
  headingLevel = 2,
  id,
  state,
  title,
  ...props
}: OutcomeProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      {...props}
      id={id}
      role="status"
      aria-labelledby={titleId}
      data-outcome-id={id}
      data-slot="outcome"
      data-state={state.status}
      {...stylex.props(styles.root)}
    >
      <p
        data-slot="outcome-state"
        {...stylex.props(
          styles.state,
          state.status === 'failed' && styles.failed,
        )}
      >
        {stateLabels[state.status]}
      </p>
      <Heading
        id={titleId}
        data-slot="outcome-title"
        {...stylex.props(styles.title)}
      >
        {title}
      </Heading>
      {children && (
        <div data-slot="outcome-content" {...stylex.props(styles.content)}>
          {children}
        </div>
      )}
      {actions && (
        <div
          role="group"
          aria-label="Outcome actions"
          data-slot="outcome-actions"
          {...stylex.props(styles.actions)}
        >
          {actions}
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
    gap: space.x2,
    inlineSize: '100%',
    padding: space.x3,
  },
  state: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  failed: {
    color: colors.danger,
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
    textWrap: 'balance',
  },
  content: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    maxInlineSize: '65ch',
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    paddingBlockStart: space.x1,
  },
})
