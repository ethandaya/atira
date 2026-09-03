import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  Disclosure,
  Shimmer,
  Spinner,
  VisuallyHidden,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ReasoningState =
  | { status: 'thinking' }
  | { duration?: string; status: 'complete' }

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'style'
>

export type ReasoningProps = NativeDivProps & {
  children: ReactNode
  defaultOpen?: boolean
  label?: ReactNode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  state: ReasoningState
}

export function Reasoning({
  children,
  defaultOpen,
  label,
  onOpenChange,
  open,
  ref,
  state,
  ...props
}: ReasoningProps) {
  const isThinking = state.status === 'thinking'
  const summary = label ?? getDefaultLabel(state)

  return (
    <div
      {...props}
      ref={ref}
      aria-busy={isThinking || undefined}
      data-slot="reasoning"
      data-state={state.status}
      {...stylex.props(styles.root)}
    >
      <VisuallyHidden role="status">
        {isThinking ? 'Reasoning is in progress.' : 'Reasoning is complete.'}
      </VisuallyHidden>
      <Disclosure
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        {...(onOpenChange === undefined ? {} : { onOpenChange })}
        {...(open === undefined ? {} : { open })}
        variant="plain"
        summary={(
          <span data-slot="reasoning-summary" {...stylex.props(styles.summary)}>
            {isThinking && <Spinner size="small" />}
            {isThinking && typeof summary === 'string' ? (
              <Shimmer>{summary}</Shimmer>
            ) : (
              summary
            )}
          </span>
        )}
      >
        <div data-slot="reasoning-content" {...stylex.props(styles.content)}>
          {children}
        </div>
      </Disclosure>
    </div>
  )
}

function getDefaultLabel(state: ReasoningState) {
  if (state.status === 'thinking') return 'Thinking'
  return state.duration ? `Thought for ${state.duration}` : 'Reasoning complete'
}

const styles = stylex.create({
  root: {
    color: colors.textMuted,
    fontFamily: type.family,
    inlineSize: '100%',
  },
  summary: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: space.x2,
  },
  content: {
    maxInlineSize: '65ch',
    whiteSpace: 'pre-wrap',
  },
})
