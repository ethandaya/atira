import { Progress as BaseProgress } from '@base-ui/react/progress'
import { colors, motion, radii, space, type } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

export type ProgressProps = {
  label: ReactNode
  max?: number
  min?: number
  value: number | null
  valueLabel?: ReactNode
}

export function Progress({ label, max = 100, min = 0, value, valueLabel }: ProgressProps) {
  const state = value === null ? 'indeterminate' : value >= max ? 'complete' : 'progressing'
  return (
    <BaseProgress.Root max={max} min={min} value={value} data-slot="progress" data-state={state} {...stylex.props(styles.root)}>
      <BaseProgress.Label data-slot="progress-label" {...stylex.props(styles.label)}>{label}</BaseProgress.Label>
      <BaseProgress.Value data-slot="progress-value" {...stylex.props(styles.value)}>{valueLabel === undefined ? undefined : () => valueLabel}</BaseProgress.Value>
      <BaseProgress.Track data-slot="progress-track" {...stylex.props(styles.track)}>
        <BaseProgress.Indicator data-slot="progress-indicator" {...stylex.props(styles.indicator, value === null && styles.indeterminate)} />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}

const styles = stylex.create({
  root: { columnGap: space.x3, display: 'grid', fontFamily: type.family, gridTemplateColumns: '1fr auto', rowGap: space.x2, width: '100%' },
  label: { color: colors.text, fontSize: type.sizeSmall, lineHeight: type.lineCompact },
  value: { color: colors.textMuted, fontSize: type.sizeSmall, fontVariantNumeric: 'tabular-nums', lineHeight: type.lineCompact },
  track: { backgroundColor: colors.surfaceMuted, borderRadius: radii.control, gridColumn: '1 / -1', height: space.x2, overflow: 'hidden' },
  indicator: { backgroundColor: colors.accent, height: '100%', transitionDuration: { default: motion.durationModerate, '@media (prefers-reduced-motion: reduce)': '0ms' }, transitionProperty: 'width', transitionTimingFunction: motion.easingStandard, width: 'var(--progress-percentage)' },
  indeterminate: { animationName: { default: 'none', '@media (prefers-reduced-motion: no-preference)': stylex.keyframes({ '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(400%)' } }) }, animationDuration: '1.2s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out', width: '25%' },
})
