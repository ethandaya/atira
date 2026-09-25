import type {
  ChatError,
  ConnectionState,
  SessionActivity,
} from '@atira/foundations/chat'
import { colors, radii, space, type } from '@atira/foundations/tokens.stylex'
import { Button, VisuallyHidden } from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'

export type ConnectionNoticeProps = {
  onRetry?: () => void
  state: ConnectionState
}

export function ConnectionNotice({ onRetry, state }: ConnectionNoticeProps) {
  if (state.status === 'connected') return null
  const offline = state.status === 'offline'

  return (
    <aside
      aria-atomic="true"
      role={offline ? 'alert' : 'status'}
      data-slot="connection-notice"
      data-state={state.status}
      {...stylex.props(styles.notice, offline && styles.danger)}
    >
      <span>
        {state.status === 'reconnecting'
          ? `Reconnecting · attempt ${state.attempt}`
          : (state.error?.message ?? 'You are offline.')}
      </span>
      {offline && onRetry && (
        <Button onClick={onRetry} size="compact" variant="quiet">
          Retry
        </Button>
      )}
    </aside>
  )
}

export type SubmissionErrorProps = {
  error: ChatError
  onDismiss?: () => void
  onRetry?: () => void
}

export function SubmissionError({
  error,
  onDismiss,
  onRetry,
}: SubmissionErrorProps) {
  return (
    <aside
      role="alert"
      data-error-kind={error.kind}
      data-slot="submission-error"
      {...stylex.props(styles.notice, styles.danger)}
    >
      <span>{error.message}</span>
      <span {...stylex.props(styles.actions)}>
        {error.retryable && onRetry && (
          <Button onClick={onRetry} size="compact" variant="quiet">
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button onClick={onDismiss} size="compact" variant="quiet">
            Dismiss
          </Button>
        )}
      </span>
    </aside>
  )
}

export type StreamStatusProps = {
  activity: SessionActivity
}

export function StreamStatus({ activity }: StreamStatusProps) {
  return (
    <VisuallyHidden
      aria-atomic="true"
      aria-live="polite"
      data-slot="stream-status"
      role="status"
    >
      {activity.status === 'busy'
        ? 'Response started.'
        : activity.status === 'retrying'
          ? `Response retrying, attempt ${activity.attempt}.`
          : 'Response complete.'}
    </VisuallyHidden>
  )
}

const styles = stylex.create({
  notice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    color: colors.textMuted,
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x3,
    justifyContent: 'space-between',
    lineHeight: type.lineBody,
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
  },
  actions: {
    display: 'inline-flex',
    flexShrink: 0,
    gap: space.x1,
  },
})
