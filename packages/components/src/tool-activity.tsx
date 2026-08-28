import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Disclosure, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ToolActivityState =
  | { status: 'queued' }
  | { status: 'running' }
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
  cancelled: 'Cancelled',
  failed: 'Failed',
  queued: 'Queued',
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
  const header = (
    <span data-slot="tool-activity-header" {...stylex.props(styles.header)}>
      <span data-slot="tool-activity-summary" {...stylex.props(styles.summary)}>
        {summary}
      </span>
      <span data-slot="tool-activity-state" {...stylex.props(styles.state)}>
        {stateLabels[state.status]}
      </span>
    </span>
  )

  return (
    <div
      {...props}
      id={id}
      role="group"
      aria-label={`${tool}: ${summary}`}
      data-slot="tool-activity"
      data-state={state.status}
      data-tool={tool}
      data-tool-activity-id={id}
      {...stylex.props(styles.root)}
    >
      <VisuallyHidden role="status">
        {summary}: {stateLabels[state.status]}.
      </VisuallyHidden>
      {children ? (
        <Disclosure
          summary={header}
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
        <div {...stylex.props(styles.staticHeader)}>{header}</div>
      )}
      {state.status === 'failed' && (
        <p role="status" {...stylex.props(styles.error)}>
          {state.error}
        </p>
      )}
    </div>
  )
}

const styles = stylex.create({
  root: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    color: colors.text,
    fontFamily: type.family,
    inlineSize: '100%',
  },
  staticHeader: {
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x2,
  },
  header: {
    alignItems: 'baseline',
    display: 'flex',
    gap: space.x3,
    inlineSize: '100%',
    justifyContent: 'space-between',
    minInlineSize: 0,
  },
  summary: {
    color: colors.text,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  state: {
    color: colors.textMuted,
    flexShrink: 0,
    fontSize: type.sizeCaption,
    fontWeight: type.weightRegular,
    lineHeight: type.lineCompact,
  },
  evidence: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    color: colors.textMuted,
    overflow: 'auto',
    padding: space.x3,
  },
  error: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlockEnd: space.x3,
    paddingInline: space.x2,
  },
})
