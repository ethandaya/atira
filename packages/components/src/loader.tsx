import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Spinner } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type LoaderState =
  | { status: 'pending' }
  | { status: 'streaming' }
  | { status: 'complete' }

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'style'
>

export type LoaderProps = NativeDivProps & {
  label?: ReactNode
  state: LoaderState
}

const stateLabels: Record<LoaderState['status'], string> = {
  complete: 'Complete',
  pending: 'Waiting',
  streaming: 'Generating',
}

export function Loader({ label, ref, state, ...props }: LoaderProps) {
  const active = state.status === 'pending' || state.status === 'streaming'

  return (
    <div
      {...props}
      ref={ref}
      aria-atomic="true"
      aria-busy={active || undefined}
      aria-live="polite"
      role="status"
      data-slot="loader"
      data-state={state.status}
      {...stylex.props(styles.root)}
    >
      {active ? (
        <Spinner size="small" />
      ) : (
        <Check
          aria-hidden="true"
          data-slot="loader-complete-icon"
          focusable="false"
          strokeWidth={1.75}
          {...stylex.props(styles.icon)}
        />
      )}
      <span data-slot="loader-label">
        {label ?? stateLabels[state.status]}
      </span>
    </div>
  )
}

const styles = stylex.create({
  root: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'inline-flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x2,
    lineHeight: type.lineCompact,
    minBlockSize: '1.5rem',
  },
  icon: {
    blockSize: '0.875rem',
    color: colors.textMuted,
    flexShrink: 0,
    inlineSize: '0.875rem',
  },
})
