import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef } from 'react'
import { resolveStyleProps, type StyleProps } from './style-props'

type NativeSpanProps = Omit<
  ComponentPropsWithRef<'span'>,
  'className' | 'style'
>
export type StatusProps = NativeSpanProps &
  StyleProps & { tone?: 'neutral' | 'danger' }

export function Status({
  className,
  role = 'status',
  style,
  tone = 'neutral',
  xstyle,
  ...props
}: StatusProps) {
  return (
    <span
      {...props}
      role={role}
      data-slot="status"
      data-state={tone}
      data-tone={tone}
      {...resolveStyleProps(
        [styles.root, tones[tone]],
        xstyle,
        className,
        style,
      )}
    />
  )
}

const styles = stylex.create({
  root: {
    alignItems: 'center',
    borderRadius: radii.control,
    display: 'inline-flex',
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    minBlockSize: '1.5rem',
    paddingInline: space.x2,
  },
})

const tones = stylex.create({
  neutral: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
  },
  danger: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
  },
})
