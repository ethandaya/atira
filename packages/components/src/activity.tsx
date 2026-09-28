import { colors, space, type } from '@atiraui/foundations/tokens.stylex'
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
    color: colors.textMuted,
    display: 'grid',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    columnGap: space.x3,
    rowGap: space.x1,
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    lineHeight: type.lineBody,
    minBlockSize: '2rem',
    paddingBlock: space.x2,
  },
  label: {
    color: colors.text,
    fontWeight: type.weightMedium,
  },
  status: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
  },
  failed: {
    color: colors.danger,
  },
  detail: {
    fontSize: type.sizeSmall,
    gridColumn: '1 / -1',
    overflowWrap: 'anywhere',
  },
})
