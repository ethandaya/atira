import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import type { ToolProgress } from '@pretty-amped/foundations/chat'
import { Disclosure, Shimmer, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check, Minus, X } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ToolActivityState =
  | { status: 'receiving-input' }
  | { status: 'queued' }
  | { progress?: ToolProgress; status: 'running' }
  | { status: 'awaiting-permission' }
  | { status: 'awaiting-approval' }
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' }

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'children' | 'className' | 'id' | 'style'
>

export type ToolActivityProps = NativeDivProps & {
  children?: ReactNode
  defaultOpen?: boolean
  id: string
  state: ToolActivityState
  summary: string
  tool: string
}

const stateLabels: Record<ToolActivityState['status'], string> = {
  'awaiting-approval': 'Needs approval',
  'awaiting-permission': 'Needs permission',
  cancelled: 'Cancelled',
  failed: 'Failed',
  queued: 'Queued',
  'receiving-input': 'Preparing',
  running: 'Running',
  succeeded: 'Complete',
}

export function ToolActivity({
  children,
  defaultOpen,
  id,
  state,
  summary,
  tool,
  ...props
}: ToolActivityProps) {
  const stateLabel = toolStateLabel(state)
  const terminalMark = toolStateMark(state)
  const active =
    state.status === 'receiving-input' ||
    state.status === 'queued' ||
    state.status === 'running'
  const canDisclose =
    Boolean(children) &&
    (state.status === 'succeeded' ||
      state.status === 'failed' ||
      state.status === 'cancelled')
  const header = (
    <span data-slot="tool-activity-header" {...stylex.props(styles.header)}>
      <span
        data-slot="tool-activity-state"
        {...stylex.props(
          styles.state,
          state.status === 'failed' && styles.stateDanger,
        )}
      >
        {terminalMark}
        {!active && <VisuallyHidden>{stateLabel}</VisuallyHidden>}
      </span>
      <span {...stylex.props(styles.heading)}>
        <span
          data-slot="tool-activity-summary"
          {...stylex.props(
            styles.summary,
            !active && state.status !== 'failed' && styles.summaryComplete,
            state.status === 'failed' && styles.summaryFailed,
          )}
        >
          {active ? <Shimmer>{summary}</Shimmer> : summary}
        </span>
      </span>
    </span>
  )

  return (
    <div
      {...props}
      id={id}
      role="group"
      aria-busy={active || undefined}
      aria-label={`${tool}: ${summary}`}
      data-slot="tool-activity"
      data-state={state.status}
      data-tool={tool}
      data-tool-activity-id={id}
      {...stylex.props(styles.root)}
    >
      {active && (
        <VisuallyHidden role="status">
          {summary}. {stateLabel}.
        </VisuallyHidden>
      )}
      {canDisclose ? (
        <Disclosure
          summary={header}
          variant="plain"
          {...(defaultOpen === undefined ? {} : { defaultOpen })}
        >
          <div
            data-slot="tool-activity-evidence"
            {...stylex.props(styles.evidence)}
          >
            {children}
          </div>
        </Disclosure>
      ) : (
        <div {...stylex.props(styles.staticHeader)}>
          {header}
          <span aria-hidden="true" {...stylex.props(styles.indicatorSlot)} />
        </div>
      )}
      {state.status === 'failed' && (
        <p role="alert" {...stylex.props(styles.error)}>
          {state.error}
        </p>
      )}
    </div>
  )
}

function toolStateLabel(state: ToolActivityState) {
  if (state.status !== 'running' || !state.progress) {
    return stateLabels[state.status]
  }
  const { current, label, total } = state.progress
  const count =
    current === undefined
      ? undefined
      : total === undefined
        ? String(current)
        : `${current}/${total}`
  return [label ?? 'Running', count].filter(Boolean).join(' · ')
}

function toolStateMark(state: ToolActivityState) {
  switch (state.status) {
    case 'succeeded':
      return (
        <Check
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    case 'failed':
      return (
        <X
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    case 'cancelled':
      return (
        <Minus
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    default:
      return undefined
  }
}

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const styles = stylex.create({
  root: {
    color: colors.text,
    fontFamily: type.family,
    inlineSize: '100%',
  },
  staticHeader: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'grid',
    gap: space.x1,
    gridTemplateColumns: 'minmax(0, 1fr) 1rem',
    inlineSize: 'fit-content',
    maxInlineSize: '100%',
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    paddingBlock: space.x1,
    paddingInline: space.x1,
  },
  indicatorSlot: {
    blockSize: '1rem',
    flexShrink: 0,
    inlineSize: '1rem',
  },
  header: {
    alignItems: 'center',
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: '1rem minmax(0, 1fr)',
    maxInlineSize: '100%',
    minInlineSize: 0,
  },
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    flex: '0 1 auto',
    flexWrap: 'nowrap',
    gap: space.x2,
    minInlineSize: 0,
  },
  summary: {
    color: colors.text,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    minInlineSize: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summaryComplete: {
    color: colors.textMuted,
    fontWeight: type.weightRegular,
  },
  summaryFailed: {
    color: colors.danger,
  },
  state: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    justifyContent: 'center',
    lineHeight: type.lineCompact,
    minBlockSize: '0.875rem',
    minInlineSize: '0.875rem',
  },
  stateIcon: {
    animationDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    animationName: {
      default: fadeIn,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationTimingFunction: 'ease-out',
    blockSize: '0.875rem',
    inlineSize: '0.875rem',
  },
  stateDanger: {
    color: colors.danger,
  },
  evidence: {
    borderInlineStartColor: colors.border,
    borderInlineStartStyle: 'solid',
    borderInlineStartWidth: '1px',
    color: colors.textMuted,
    marginInlineStart: '0.4375rem',
    overflow: 'auto',
    paddingBlock: space.x2,
    paddingInlineEnd: space.x2,
    paddingInlineStart: space.x4,
  },
  error: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlock: space.x2,
    paddingInlineStart: '1.375rem',
  },
})
