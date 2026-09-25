import { Progress as BaseProgress } from '@base-ui/react/progress'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { resolveStyleProps, type StyleProps } from './style-props'

type NativeProgressProps = Omit<
  ComponentPropsWithRef<typeof BaseProgress.Root>,
  'children' | 'className' | 'max' | 'min' | 'style' | 'value'
>

export type ProgressProps = NativeProgressProps &
  StyleProps & {
    label: ReactNode
    max?: number
    min?: number
    value: number | null
    valueLabel?: ReactNode
  }

export function Progress({
  className,
  label,
  max = 100,
  min = 0,
  style,
  value,
  valueLabel,
  xstyle,
  ...props
}: ProgressProps) {
  const state =
    value === null ? 'indeterminate' : value >= max ? 'complete' : 'progressing'
  return (
    <BaseProgress.Root
      {...props}
      max={max}
      min={min}
      value={value}
      data-slot="progress"
      data-state={state}
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      <BaseProgress.Label
        data-slot="progress-label"
        {...stylex.props(styles.label)}
      >
        {label}
      </BaseProgress.Label>
      <BaseProgress.Value
        data-slot="progress-value"
        {...stylex.props(styles.value)}
      >
        {valueLabel === undefined ? undefined : () => valueLabel}
      </BaseProgress.Value>
      <BaseProgress.Track
        data-slot="progress-track"
        {...stylex.props(styles.track)}
      >
        <BaseProgress.Indicator
          data-slot="progress-indicator"
          {...stylex.props(
            styles.indicator,
            value === null && styles.indeterminate,
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}

const styles = stylex.create({
  root: {
    columnGap: space.x3,
    display: 'grid',
    fontFamily: type.family,
    gridTemplateColumns: '1fr auto',
    rowGap: space.x2,
    width: '100%',
  },
  label: {
    color: colors.text,
    fontSize: type.sizeSmall,
    lineHeight: type.lineCompact,
  },
  value: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: type.lineCompact,
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    gridColumn: '1 / -1',
    height: space.x2,
    overflow: 'hidden',
  },
  indicator: {
    backgroundColor: colors.accent,
    height: '100%',
    transform: 'translateX(calc(var(--progress-percentage) - 100%))',
    transitionDuration: {
      default: motion.durationModerate,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: motion.easingStandard,
    width: '100%',
  },
  indeterminate: {
    animationName: {
      default: 'none',
      '@media (prefers-reduced-motion: no-preference)': stylex.keyframes({
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(400%)' },
      }),
    },
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
    transform: 'translateX(-100%)',
    width: '25%',
  },
})
