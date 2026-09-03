import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'style'
>

type ResponseBaseProps = NativeDivProps & {
  children: ReactNode
}

type ActiveResponseProps = ResponseBaseProps & {
  error?: never
  status: 'streaming' | 'complete'
}

type InterruptedResponseProps = ResponseBaseProps & {
  error?: never
  status: 'interrupted'
}

type FailedResponseProps = ResponseBaseProps & {
  error: string
  status: 'failed'
}

export type ResponseProps =
  | ActiveResponseProps
  | InterruptedResponseProps
  | FailedResponseProps

export function Response({ children, error, status, ...props }: ResponseProps) {
  return (
    <div
      {...props}
      aria-busy={status === 'streaming' || undefined}
      data-slot="response"
      data-state={status}
      {...stylex.props(styles.root)}
    >
      <div data-slot="response-content" {...stylex.props(styles.content)}>
        {children}
      </div>
      {status === 'streaming' && (
        <VisuallyHidden role="status">Response is streaming.</VisuallyHidden>
      )}
      {status === 'interrupted' && (
        <p role="status" {...stylex.props(styles.status)}>
          Response stopped.
        </p>
      )}
      {status === 'failed' && (
        <p role="status" {...stylex.props(styles.status, styles.error)}>
          {error}
        </p>
      )}
    </div>
  )
}

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    inlineSize: '100%',
    minInlineSize: 0,
  },
  status: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  error: {
    color: colors.danger,
  },
})
