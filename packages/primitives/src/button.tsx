import { Button as BaseButton } from '@base-ui/react/button'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef } from 'react'

type NativeButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  'className' | 'style'
>

export type ButtonProps = NativeButtonProps & {
  focusableWhenDisabled?: boolean
  size?: 'compact' | 'regular'
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
}

export function Button({
  disabled = false,
  focusableWhenDisabled = false,
  size = 'regular',
  type: buttonType = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      disabled={disabled}
      type={buttonType}
      focusableWhenDisabled={focusableWhenDisabled}
      data-slot="button"
      data-state={disabled ? 'disabled' : 'enabled'}
      data-variant={variant}
      {...stylex.props(
        styles.root,
        sizes[size],
        variants[variant],
        disabled && styles.disabled,
      )}
    />
  )
}

const styles = stylex.create({
  root: {
    alignItems: 'center',
    appearance: 'none',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    gap: space.x2,
    justifyContent: 'center',
    lineHeight: type.lineCompact,
    minWidth: 0,
    opacity: 1,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    textDecoration: 'none',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, border-color, color, transform',
    transitionTimingFunction: motion.easingStandard,
    transform: {
      default: 'scale(1)',
      ':active': 'scale(0.96)',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    touchAction: 'manipulation',
    userSelect: 'none',
  },
  disabled: {
    cursor: 'not-allowed',
    opacity: 0.52,
  },
})

const sizes = stylex.create({
  compact: {
    borderRadius: radii.control,
    minHeight: '2.25rem',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  regular: {
    borderRadius: radii.control,
    minHeight: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x4,
  },
})

const variants = stylex.create({
  primary: {
    backgroundColor: {
      default: colors.accent,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.accentHover,
      },
      ':active': colors.accentPressed,
    },
    borderColor: 'transparent',
    color: colors.onAccent,
  },
  secondary: {
    backgroundColor: {
      default: colors.surface,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceMuted,
      },
      ':active': colors.surfaceMuted,
    },
    borderColor: colors.borderStrong,
    color: colors.text,
  },
  quiet: {
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceMuted,
      },
      ':active': colors.surfaceMuted,
    },
    borderColor: 'transparent',
    color: colors.text,
  },
  danger: {
    backgroundColor: {
      default: colors.danger,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.dangerHover,
      },
      ':active': colors.dangerPressed,
    },
    borderColor: 'transparent',
    color: colors.onDanger,
  },
})
