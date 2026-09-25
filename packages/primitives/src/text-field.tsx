import { Field } from '@base-ui/react/field'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { resolveStyleProps, type StyleProps } from './style-props'

type NativeInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'className' | 'defaultValue' | 'disabled' | 'id' | 'name' | 'style' | 'value'
>

export type TextFieldProps = NativeInputProps &
  StyleProps & {
    defaultValue?: string
    description?: ReactNode
    disabled?: boolean
    id?: string
    invalid?: boolean
    label: ReactNode
    labelHidden?: boolean
    name?: string
    onValueChange?: (value: string) => void
    value?: string
    variant?: 'outlined' | 'plain'
  }

export function TextField({
  className,
  defaultValue,
  description,
  disabled,
  id,
  invalid,
  label,
  labelHidden = false,
  name,
  onValueChange,
  ref,
  style,
  value,
  variant = 'outlined',
  xstyle,
  ...props
}: TextFieldProps) {
  const controlStyle = resolveStyleProps(
    [
      styles.control,
      variant === 'outlined' ? styles.outlined : styles.plain,
      invalid && styles.invalid,
    ],
    xstyle,
    className,
    style,
  )
  return (
    <Field.Root
      disabled={disabled}
      invalid={invalid}
      name={name}
      data-slot="text-field"
      data-state={invalid ? 'invalid' : disabled ? 'disabled' : 'valid'}
      data-variant={variant}
      {...stylex.props(styles.root)}
    >
      <Field.Label
        data-slot="text-field-label"
        {...stylex.props(styles.label, labelHidden && styles.hidden)}
      >
        {label}
      </Field.Label>
      <Field.Control
        defaultValue={defaultValue}
        id={id}
        onValueChange={(next) => onValueChange?.(next)}
        render={<input {...props} ref={ref} />}
        value={value}
        data-slot="text-field-control"
        {...controlStyle}
      />
      {description && (
        <Field.Description
          data-slot="text-field-description"
          {...stylex.props(styles.description)}
        >
          {description}
        </Field.Description>
      )}
    </Field.Root>
  )
}

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
  },
  label: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
  },
  hidden: {
    blockSize: '1px',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    inlineSize: '1px',
    margin: '-1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
  control: {
    appearance: 'none',
    boxSizing: 'border-box',
    color: colors.text,
    fontFamily: type.family,
    fontSize: {
      default: type.sizeInput,
      '@media (min-width: 48rem) and (hover: hover) and (pointer: fine)':
        type.sizeBody,
    },
    inlineSize: '100%',
    lineHeight: type.lineBody,
    minBlockSize: { default: '2.5rem', '@media (hover: none)': '2.75rem' },
    opacity: { default: 1, ':disabled': 0.5 },
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    touchAction: 'manipulation',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, border-color, color',
    transitionTimingFunction: motion.easingStandard,
    '::placeholder': { color: colors.textMuted, opacity: 1 },
  },
  outlined: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderStyle: 'solid',
    borderWidth: '1px',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  plain: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
    borderStyle: 'solid',
    borderWidth: 0,
    outlineWidth: 0,
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  invalid: { borderColor: colors.danger },
  description: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
  },
})
