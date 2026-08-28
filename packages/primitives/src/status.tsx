import { colors, radii, space, type } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef } from 'react'

type NativeSpanProps = Omit<ComponentPropsWithRef<'span'>, 'className' | 'style'>
export type StatusProps = NativeSpanProps & { tone?: 'neutral' | 'danger' }

export function Status({ role = 'status', tone = 'neutral', ...props }: StatusProps) {
  return (
    <span
      {...props}
      role={role}
      data-slot="status"
      data-state={tone}
      data-tone={tone}
      {...stylex.props(styles.root, tones[tone])}
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
