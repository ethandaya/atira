import { colors } from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { LoaderCircle } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'

type NativeSvgProps = Omit<
  ComponentPropsWithRef<typeof LoaderCircle>,
  'children' | 'className' | 'height' | 'size' | 'style' | 'width'
>

export type SpinnerProps = NativeSvgProps & {
  size?: 'small' | 'regular' | 'large'
}

export function Spinner({
  'aria-label': label,
  'aria-labelledby': labelledBy,
  ref,
  size = 'regular',
  ...props
}: SpinnerProps) {
  const isLabelled = Boolean(label || labelledBy)

  return (
    <LoaderCircle
      {...props}
      ref={ref}
      aria-hidden={isLabelled ? undefined : true}
      aria-label={label}
      aria-labelledby={labelledBy}
      focusable="false"
      role={isLabelled ? 'img' : undefined}
      strokeWidth={1.75}
      data-slot="spinner"
      data-state="spinning"
      data-size={size}
      {...stylex.props(styles.root, sizes[size])}
    />
  )
}

const styles = stylex.create({
  root: {
    animationDuration: '800ms',
    animationIterationCount: 'infinite',
    animationName: {
      default: 'none',
      '@media (prefers-reduced-motion: no-preference)': stylex.keyframes({
        to: { transform: 'rotate(360deg)' },
      }),
    },
    animationTimingFunction: 'linear',
    color: colors.textMuted,
    display: 'inline-block',
    flexShrink: 0,
    transformOrigin: 'center',
  },
})

const sizes = stylex.create({
  small: {
    blockSize: '0.875rem',
    inlineSize: '0.875rem',
  },
  regular: {
    blockSize: '1rem',
    inlineSize: '1rem',
  },
  large: {
    blockSize: '1.25rem',
    inlineSize: '1.25rem',
  },
})
