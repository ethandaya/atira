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
  size?: 'chip' | 'compact' | 'regular' | 'icon'
  variant?: 'primary' | 'secondary' | 'outline' | 'quiet' | 'danger'
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
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    textDecoration: 'none',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, border-color, color, transform',
    transitionTimingFunction: motion.easingStandard,
    transform: {
      default: 'translateY(0)',
      ':active': 'translateY(1px)',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    touchAction: 'manipulation',
    userSelect: 'none',
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    color: colors.textDisabled,
    cursor: 'not-allowed',
    opacity: 1,
    transform: 'none',
  },
})

const sizes = stylex.create({
  chip: {
    borderRadius: '999px',
    minHeight: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    paddingBlock: space.x1,
    paddingInline: space.x3,
  },
  icon: {
    borderRadius: radii.control,
    minHeight: {
      default: '2.25rem',
      '@media (hover: none)': '2.75rem',
    },
    padding: 0,
    width: {
      default: '2.25rem',
      '@media (hover: none)': '2.75rem',
    },
  },
  compact: {
    borderRadius: radii.control,
    minHeight: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    paddingBlock: space.x1,
    paddingInline: space.x3,
  },
  regular: {
    borderRadius: radii.control,
    minHeight: {
      default: '2.25rem',
      '@media (hover: none)': '2.75rem',
    },
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
      default: colors.surfaceMuted,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
      ':active': colors.surfaceSelected,
    },
    borderColor: 'transparent',
    color: colors.text,
  },
  outline: {
    backgroundColor: {
      default: colors.surfaceRaised,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
      ':active': colors.surfaceSelected,
    },
    borderColor: colors.border,
    color: colors.text,
  },
  quiet: {
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
      ':active': colors.surfaceSelected,
    },
    borderColor: 'transparent',
    color: colors.text,
  },
  danger: {
    backgroundColor: {
      default: colors.dangerSurface,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.dangerSurfaceHover,
      },
      ':active': colors.dangerSurfaceHover,
    },
    borderColor: 'transparent',
    color: colors.danger,
  },
})
