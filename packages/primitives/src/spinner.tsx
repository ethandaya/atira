import { colors } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef } from 'react'

type NativeSvgProps = Omit<
  ComponentPropsWithRef<'svg'>,
  'children' | 'className' | 'height' | 'style' | 'width'
>

export type SpinnerProps = NativeSvgProps & {
  size?: 'small' | 'regular' | 'large'
}

const spokeOpacities = [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.28, 0.16]

export function Spinner({
  'aria-label': label,
  'aria-labelledby': labelledBy,
  ref,
  size = 'regular',
  ...props
}: SpinnerProps) {
  const isLabelled = Boolean(label || labelledBy)

  return (
    <svg
      {...props}
      ref={ref}
      aria-hidden={isLabelled ? undefined : true}
      aria-label={label}
      aria-labelledby={labelledBy}
      focusable="false"
      role={isLabelled ? 'img' : undefined}
      viewBox="0 0 24 24"
      data-slot="spinner"
      data-state="spinning"
      data-size={size}
      {...stylex.props(styles.root, sizes[size])}
    >
      {spokeOpacities.map((opacity, index) => (
        <line
          key={opacity}
          x1="12"
          x2="12"
          y1="2.75"
          y2="6.25"
          opacity={opacity}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          transform={`rotate(${index * 45} 12 12)`}
        />
      ))}
    </svg>
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
