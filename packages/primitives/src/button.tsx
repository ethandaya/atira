import { Button as BaseButton } from '@base-ui/react/button'
import {
  colors,
  motion,
  radii,
  shadows,
  space,
  type,
} from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
// react-doctor-disable-next-line react-doctor/use-lazy-motion -- Public primitives animate without requiring consumers to install a LazyMotion provider.
import { motion as animate, useReducedMotion } from 'motion/react'
import { useState, type ComponentPropsWithRef } from 'react'
import { resolveStyleProps, type StyleProps } from './style-props'

type NativeButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  'className' | 'style'
>

export type ButtonProps = NativeButtonProps &
  StyleProps & {
    focusableWhenDisabled?: boolean
    size?: 'chip' | 'compact' | 'regular' | 'icon'
    variant?: 'primary' | 'secondary' | 'outline' | 'quiet' | 'danger'
  }

export function Button({
  disabled = false,
  focusableWhenDisabled = false,
  className,
  size = 'regular',
  style,
  type: buttonType = 'button',
  variant = 'secondary',
  xstyle,
  ...props
}: ButtonProps) {
  const reduced = useReducedMotion()
  const [pressed, setPressed] = useState(false)
  const resolvedStyle = resolveStyleProps(
    [styles.root, sizes[size], variants[variant], disabled && styles.disabled],
    xstyle,
    className,
    style,
  )
  return (
    <BaseButton
      render={
        <animate.button
          initial={false}
          animate={{
            transform:
              pressed && !disabled && !reduced && variant !== 'quiet'
                ? size === 'icon'
                  ? 'translateY(0px) scale(0.98)'
                  : 'translateY(1px) scale(1)'
                : 'translateY(0px) scale(1)',
          }}
          transition={{ duration: reduced ? 0 : 0.1, ease: 'easeOut' }}
          onPointerDown={(event) => {
            if (event.button === 0) setPressed(true)
          }}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onBlur={() => setPressed(false)}
        />
      }
      {...props}
      disabled={disabled}
      type={buttonType}
      focusableWhenDisabled={focusableWhenDisabled}
      data-slot="button"
      data-state={disabled ? 'disabled' : 'enabled'}
      data-variant={variant}
      {...resolvedStyle}
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
    outlineWidth: '3px',
    textDecoration: 'none',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, border-color, color',
    transitionTimingFunction: motion.easingStandard,
    touchAction: 'manipulation',
    userSelect: 'none',
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    boxShadow: 'none',
    color: colors.textDisabled,
    cursor: 'not-allowed',
    opacity: 1,
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
    boxShadow: shadows.control,
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
    boxShadow: shadows.control,
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
