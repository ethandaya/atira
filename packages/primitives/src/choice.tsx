import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'

export type CheckboxFieldProps = {
  checked: boolean
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  name?: string
  onCheckedChange: (checked: boolean) => void
  required?: boolean
  value?: string
}

export function CheckboxField({
  checked,
  description,
  disabled = false,
  label,
  name,
  onCheckedChange,
  required = false,
  value,
}: CheckboxFieldProps) {
  return (
    <label data-slot="checkbox-field" {...stylex.props(styles.option)}>
      <BaseCheckbox.Root
        checked={checked}
        disabled={disabled}
        name={name}
        onCheckedChange={(next) => onCheckedChange(next)}
        required={required}
        value={value}
        data-slot="checkbox"
        {...stylex.props(styles.control, styles.checkbox)}
      >
        <BaseCheckbox.Indicator
          data-slot="checkbox-indicator"
          {...stylex.props(styles.indicator)}
        >
          <Check aria-hidden="true" size={12} strokeWidth={2.25} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <OptionCopy label={label} description={description} />
    </label>
  )
}

export type RadioGroupProps = {
  children: ReactNode
  disabled?: boolean
  label: ReactNode
  name?: string
  onValueChange: (value: string) => void
  required?: boolean
  value?: string
}

export function RadioGroup({
  children,
  disabled = false,
  label,
  name,
  onValueChange,
  required = false,
  value,
}: RadioGroupProps) {
  const labelId = useId()

  return (
    <div data-slot="radio-field" {...stylex.props(styles.group)}>
      <div id={labelId} data-slot="radio-group-label" {...stylex.props(styles.legend)}>
        {label}
      </div>
      <BaseRadioGroup
        aria-labelledby={labelId}
        disabled={disabled}
        name={name}
        onValueChange={(next) => {
          if (typeof next === 'string') onValueChange(next)
        }}
        required={required}
        value={value ?? null}
        data-slot="radio-group"
        {...stylex.props(styles.options)}
      >
        {children}
      </BaseRadioGroup>
    </div>
  )
}

export type RadioOptionProps = {
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  value: string
}

export function RadioOption({
  description,
  disabled = false,
  label,
  value,
}: RadioOptionProps) {
  return (
    <label data-slot="radio-option" {...stylex.props(styles.option)}>
      <BaseRadio.Root
        disabled={disabled}
        value={value}
        data-slot="radio"
        {...stylex.props(styles.control, styles.radio)}
      >
        <BaseRadio.Indicator
          data-slot="radio-indicator"
          {...stylex.props(styles.radioIndicator)}
        />
      </BaseRadio.Root>
      <OptionCopy label={label} description={description} />
    </label>
  )
}

function OptionCopy({
  description,
  label,
}: Pick<RadioOptionProps, 'description' | 'label'>) {
  return (
    <span {...stylex.props(styles.copy)}>
      <span data-slot="choice-label" {...stylex.props(styles.label)}>
        {label}
      </span>
      {description && (
        <span data-slot="choice-description" {...stylex.props(styles.description)}>
          {description}
        </span>
      )}
    </span>
  )
}

const styles = stylex.create({
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  legend: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  option: {
    alignItems: 'flex-start',
    borderRadius: radii.control,
    cursor: 'pointer',
    display: 'flex',
    gap: space.x3,
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x2,
  },
  control: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.onAccent,
    display: 'inline-flex',
    flexShrink: 0,
    justifyContent: 'center',
    marginBlockStart: '0.125rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
  },
  checkbox: {
    blockSize: '1rem',
    borderRadius: '0.25rem',
    inlineSize: '1rem',
    ':is([data-checked])': {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
  },
  radio: {
    blockSize: '1rem',
    borderRadius: '999px',
    inlineSize: '1rem',
    ':is([data-checked])': {
      borderColor: colors.accent,
    },
  },
  indicator: {
    blockSize: '0.75rem',
    inlineSize: '0.75rem',
  },
  radioIndicator: {
    backgroundColor: colors.accent,
    blockSize: '0.5rem',
    borderRadius: '999px',
    inlineSize: '0.5rem',
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  label: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
  },
  description: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
  },
})
