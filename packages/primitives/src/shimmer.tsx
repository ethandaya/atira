import { chatAppearance, colors } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { resolveStyleProps, type StyleProps } from './style-props'

type NativeSpanProps = Omit<
  ComponentPropsWithRef<'span'>,
  'children' | 'className' | 'style'
>

export type ShimmerProps = NativeSpanProps &
  StyleProps & {
    active?: boolean
    children: ReactNode
    duration?: 'fast' | 'regular' | 'slow'
  }

export function Shimmer({
  active = true,
  children,
  className,
  duration = 'regular',
  ref,
  style,
  xstyle,
  ...props
}: ShimmerProps) {
  return (
    <span
      {...props}
      ref={ref}
      data-slot="shimmer"
      data-state={active ? 'active' : 'idle'}
      {...resolveStyleProps(
        [
          styles.root,
          active && styles.active,
          active && durations[duration],
        ] as stylex.StyleXStyles,
        xstyle,
        className,
        style,
      )}
    >
      {children}
    </span>
  )
}

const shimmer = stylex.keyframes({
  from: { backgroundPositionX: '100%' },
  to: { backgroundPositionX: '-100%' },
})

const styles = stylex.create({
  root: {
    color: colors.textMuted,
  },
  active: {
    animationIterationCount: chatAppearance.shimmerIterations,
    animationName: {
      default: 'none',
      '@media (prefers-reduced-motion: no-preference)': shimmer,
    },
    animationTimingFunction: 'linear',
    backgroundClip: {
      default: 'text',
      '@media (forced-colors: active)': 'border-box',
      '@media (prefers-reduced-motion: reduce)': 'border-box',
    },
    backgroundImage: {
      default: `linear-gradient(100deg, ${colors.textMuted} 20%, ${colors.text} 48%, ${colors.textMuted} 76%)`,
      '@media (forced-colors: active)': 'none',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    backgroundPositionX: '100%',
    backgroundSize: '200% 100%',
    color: {
      default: 'transparent',
      '@media (forced-colors: active)': 'CanvasText',
      '@media (prefers-reduced-motion: reduce)': colors.textMuted,
    },
  },
})

const durations = stylex.create({
  fast: { animationDuration: '1.1s' },
  regular: { animationDuration: '1.8s' },
  slow: { animationDuration: '2.6s' },
})
