import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ActivityState =
  | { status: 'queued' }
  | { status: 'running' }
  | { status: 'waiting' }
  | { status: 'succeeded' }
  | { status: 'failed' }
  | { status: 'cancelled' }

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'id' | 'style'
>

export type ActivityProps = NativeDivProps & {
  detail?: ReactNode
  id: string
  label: ReactNode
  state: ActivityState
}

const stateLabels: Record<ActivityState['status'], string> = {
  cancelled: 'Cancelled',
  failed: 'Failed',
  queued: 'Queued',
  running: 'Working',
  succeeded: 'Complete',
  waiting: 'Waiting',
}

export function Activity({
  detail,
  id,
  label,
  state,
  ...props
}: ActivityProps) {
  return (
    <div
      {...props}
      id={id}
      role="status"
      aria-atomic="true"
      aria-live="polite"
      data-activity-id={id}
      data-slot="activity"
      data-state={state.status}
      {...stylex.props(styles.root)}
    >
      <span data-slot="activity-label" {...stylex.props(styles.label)}>
        {label}
      </span>
      <span
        data-slot="activity-status"
        {...stylex.props(
          styles.status,
          state.status === 'failed' && styles.failed,
        )}
      >
        {stateLabels[state.status]}
      </span>
      {detail && (
        <span data-slot="activity-detail" {...stylex.props(styles.detail)}>
          {detail}
        </span>
      )}
    </div>
  )
}

const styles = stylex.create({
  root: {
    alignItems: 'baseline',
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    color: colors.textMuted,
    display: 'grid',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x2,
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    lineHeight: type.lineBody,
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x2,
  },
  label: {
    color: colors.text,
    fontWeight: type.weightMedium,
  },
  status: {
    color: colors.textMuted,
  },
  failed: {
    color: colors.danger,
  },
  detail: {
    gridColumn: '1 / -1',
    overflowWrap: 'anywhere',
  },
})
