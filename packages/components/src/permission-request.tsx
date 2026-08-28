import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'

export type PermissionConsequence =
  | 'reversible'
  | 'destructive'
  | 'external'

export type PermissionRequestState =
  | { status: 'pending' }
  | { status: 'submitting'; decision: 'approve' | 'reject' }
  | { status: 'resolved'; decision: 'approved' | 'rejected' }
  | { status: 'expired' }

type PermissionRequestBaseProps = {
  approveLabel?: string
  consequence: PermissionConsequence
  effect: string
  id: string
  rejectLabel?: string
  state: PermissionRequestState
  title: string
}

type PendingPermissionRequestProps = PermissionRequestBaseProps & {
  state: { status: 'pending' }
  onApprove: () => void
  onReject: () => void
}

type SettledPermissionRequestProps = PermissionRequestBaseProps & {
  state: Exclude<PermissionRequestState, { status: 'pending' }>
  onApprove?: never
  onReject?: never
}

export type PermissionRequestProps =
  | PendingPermissionRequestProps
  | SettledPermissionRequestProps

const consequenceText: Record<PermissionConsequence, string> = {
  destructive: 'This action cannot be undone.',
  external: 'This action affects a system outside this workspace.',
  reversible: 'This action can be reversed.',
}

export function PermissionRequest(props: PermissionRequestProps) {
  const titleId = useId()
  const descriptionId = useId()
  const isSubmitting = props.state.status === 'submitting'
  const decision = 'decision' in props.state ? props.state.decision : undefined

  return (
    <section
      aria-busy={isSubmitting || undefined}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      data-consequence={props.consequence}
      data-decision={decision}
      data-permission-id={props.id}
      data-slot="permission-request"
      data-state={props.state.status}
      {...stylex.props(styles.root)}
    >
      <div data-slot="permission-request-content" {...stylex.props(styles.content)}>
        <h2
          id={titleId}
          data-slot="permission-request-title"
          {...stylex.props(styles.title)}
        >
          {props.title}
        </h2>
        <p
          id={descriptionId}
          data-slot="permission-request-effect"
          {...stylex.props(styles.effect)}
        >
          {props.effect}
        </p>
        <p
          data-slot="permission-request-consequence"
          {...stylex.props(
            styles.consequence,
            props.consequence === 'destructive' && styles.destructive,
          )}
        >
          {consequenceText[props.consequence]}
        </p>
      </div>

      <div data-slot="permission-request-footer" {...stylex.props(styles.footer)}>
        <p
          role="status"
          data-slot="permission-request-status"
          {...stylex.props(styles.status)}
        >
          {getStatusText(props.state)}
        </p>

        {(props.state.status === 'pending' || isSubmitting) && (
          <div
            role="group"
            aria-label="Permission decision"
            data-slot="permission-request-actions"
            {...stylex.props(styles.actions)}
          >
            <Button
              disabled={isSubmitting}
              focusableWhenDisabled={isSubmitting}
              onClick={
                props.state.status === 'pending' ? props.onReject : undefined
              }
              variant="secondary"
            >
              {isSubmitting && decision === 'reject'
                ? 'Denying…'
                : (props.rejectLabel ?? 'Deny')}
            </Button>
            <Button
              disabled={isSubmitting}
              focusableWhenDisabled={isSubmitting}
              onClick={
                props.state.status === 'pending' ? props.onApprove : undefined
              }
              variant="primary"
            >
              {isSubmitting && decision === 'approve'
                ? 'Allowing…'
                : (props.approveLabel ?? 'Allow once')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function getStatusText(state: PermissionRequestState) {
  switch (state.status) {
    case 'pending':
      return 'Waiting for your decision.'
    case 'submitting':
      return state.decision === 'approve'
        ? 'Allowing this action…'
        : 'Denying this action…'
    case 'resolved':
      return state.decision === 'approved'
        ? 'Permission allowed.'
        : 'Permission denied.'
    case 'expired':
      return 'This permission request expired.'
  }
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
    gap: space.x5,
    inlineSize: '100%',
    maxInlineSize: '34rem',
    padding: space.x5,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
    textWrap: 'balance',
  },
  effect: {
    color: colors.text,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  consequence: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  destructive: {
    color: colors.danger,
    fontWeight: type.weightMedium,
  },
  footer: {
    alignItems: {
      default: 'stretch',
      '@media (min-width: 30rem)': 'center',
    },
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 30rem)': 'row',
    },
    gap: space.x3,
    justifyContent: 'space-between',
  },
  status: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  actions: {
    display: 'flex',
    flexDirection: {
      default: 'column-reverse',
      '@media (min-width: 22rem)': 'row',
    },
    gap: space.x2,
  },
})
