import { Field } from '@base-ui/react/field'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

type NativeTextareaProps = Omit<
  ComponentPropsWithRef<'textarea'>,
  'className' | 'defaultValue' | 'disabled' | 'id' | 'name' | 'style' | 'value'
>

export type TextareaFieldProps = NativeTextareaProps & {
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

export function TextareaField({
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
  value,
  variant = 'outlined',
  ...props
}: TextareaFieldProps) {
  return (
    <Field.Root
      disabled={disabled}
      invalid={invalid}
      name={name}
      data-slot="textarea-field"
      data-variant={variant}
      {...stylex.props(styles.root)}
    >
      <Field.Label
        data-slot="textarea-field-label"
        {...stylex.props(styles.label, labelHidden && styles.labelHidden)}
      >
        {label}
      </Field.Label>
      <Field.Control
        defaultValue={defaultValue}
        id={id}
        onValueChange={(nextValue) => onValueChange?.(nextValue)}
        render={<textarea {...props} ref={ref} />}
        value={value}
        data-slot="textarea-field-control"
        {...stylex.props(
          styles.control,
          variant === 'outlined' ? styles.outlined : styles.plain,
          invalid && styles.invalid,
        )}
      />
      {description && (
        <Field.Description
          data-slot="textarea-field-description"
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
  labelHidden: {
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
    fieldSizing: 'content',
    fontFamily: type.family,
    fontSize: {
      default: type.sizeInput,
      '@media (min-width: 48rem)': type.sizeBody,
    },
    fontWeight: type.weightRegular,
    inlineSize: '100%',
    lineHeight: type.lineBody,
    maxBlockSize: '10rem',
    minBlockSize: '4rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    opacity: {
      default: 1,
      ':disabled': 0.5,
    },
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
    '::placeholder': {
      color: colors.textMuted,
      opacity: 1,
    },
  },
  outlined: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    paddingBlock: space.x3,
    paddingInline: space.x3,
    resize: 'vertical',
  },
  plain: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
    borderStyle: 'solid',
    borderWidth: 0,
    minBlockSize: {
      default: '2.75rem',
      '@media (hover: none)': '3rem',
    },
    outlineWidth: 0,
    resize: 'none',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  invalid: {
    borderColor: colors.danger,
  },
  description: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
  },
})
