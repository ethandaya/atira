import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef } from 'react'

export type PlanStatus = 'proposed' | 'active' | 'partial' | 'complete'
export type PlanStepStatus =
  | 'queued'
  | 'active'
  | 'complete'
  | 'failed'
  | 'skipped'

export type PlanStep = Readonly<{
  detail?: string
  id: string
  status: PlanStepStatus
  title: string
}>

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'children' | 'className' | 'id' | 'style' | 'title'
>

export type PlanProps = NativeSectionProps & {
  headingLevel?: 2 | 3 | 4 | 5 | 6
  id: string
  status: PlanStatus
  steps: readonly PlanStep[]
  title: string
}

const planLabels: Record<PlanStatus, string> = {
  active: 'In progress',
  complete: 'Complete',
  partial: 'Partially complete',
  proposed: 'Proposed',
}

const stepLabels: Record<PlanStepStatus, string> = {
  active: 'In progress',
  complete: 'Complete',
  failed: 'Failed',
  queued: 'Queued',
  skipped: 'Skipped',
}

export function Plan({
  headingLevel = 2,
  id,
  status,
  steps,
  title,
  ...props
}: PlanProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      {...props}
      id={id}
      aria-labelledby={titleId}
      data-plan-id={id}
      data-slot="plan"
      data-state={status}
      {...stylex.props(styles.root)}
    >
      <header data-slot="plan-header" {...stylex.props(styles.header)}>
        <Heading
          id={titleId}
          data-slot="plan-title"
          {...stylex.props(styles.title)}
        >
          {title}
        </Heading>
        <span data-slot="plan-status" {...stylex.props(styles.status)}>
          {planLabels[status]}
        </span>
      </header>
      {steps.length === 0 ? (
        <p data-slot="plan-empty" {...stylex.props(styles.empty)}>
          No steps provided.
        </p>
      ) : (
        <ol data-slot="plan-steps" {...stylex.props(styles.steps)}>
          {steps.map((step) => (
            <li
              key={step.id}
              data-plan-step-id={step.id}
              data-slot="plan-step"
              data-state={step.status}
              {...stylex.props(styles.step)}
            >
              <div {...stylex.props(styles.stepContent)}>
                <span
                  data-slot="plan-step-title"
                  {...stylex.props(styles.stepTitle)}
                >
                  {step.title}
                </span>
                {step.detail && (
                  <span
                    data-slot="plan-step-detail"
                    {...stylex.props(styles.detail)}
                  >
                    {step.detail}
                  </span>
                )}
              </div>
              <span
                data-slot="plan-step-status"
                {...stylex.props(
                  styles.stepStatus,
                  step.status === 'failed' && styles.failed,
                )}
              >
                {stepLabels[step.status]}
              </span>
            </li>
          ))}
        </ol>
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
    fontFamily: type.family,
    inlineSize: '100%',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    display: 'flex',
    gap: space.x3,
    justifyContent: 'space-between',
    padding: space.x3,
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  status: {
    color: colors.textMuted,
    flexShrink: 0,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    listStylePosition: 'outside',
    margin: 0,
    paddingBlock: space.x2,
    paddingInlineEnd: space.x3,
    paddingInlineStart: space.x8,
  },
  step: {
    alignItems: 'baseline',
    display: 'grid',
    gap: space.x3,
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    paddingBlock: space.x3,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  stepTitle: {
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  detail: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  stepStatus: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  failed: { color: colors.danger },
  empty: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    margin: 0,
    padding: space.x4,
  },
})
