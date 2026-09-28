import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Check } from 'lucide-react'
// react-doctor-disable-next-line react-doctor/use-lazy-motion -- Standalone choices own layout animations; requiring a consumer LazyMotion provider would change their API.
import { motion, useReducedMotion } from 'motion/react'
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const RadioSelection = createContext<{
  id: string
  immediate: boolean
  value: string | undefined
} | null>(null)

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
  const controlId = useId()

  return (
    <label
      htmlFor={controlId}
      data-slot="checkbox-field"
      {...stylex.props(styles.option)}
    >
      <BaseCheckbox.Root
        id={controlId}
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
  const reducedMotion = useReducedMotion()
  const [immediate, setImmediate] = useState(true)
  const selection = useMemo(
    () => ({
      id: labelId,
      immediate: immediate || !!reducedMotion,
      value,
    }),
    [immediate, labelId, reducedMotion, value],
  )

  return (
    <div data-slot="radio-field" {...stylex.props(styles.group)}>
      <div
        id={labelId}
        data-slot="radio-group-label"
        {...stylex.props(styles.legend)}
      >
        {label}
      </div>
      <BaseRadioGroup
        aria-labelledby={labelId}
        disabled={disabled}
        name={name}
        onKeyDownCapture={() => setImmediate(true)}
        onPointerDownCapture={() => setImmediate(false)}
        onValueChange={(next) => {
          if (typeof next === 'string') onValueChange(next)
        }}
        required={required}
        value={value ?? null}
        data-slot="radio-group"
        {...stylex.props(styles.options)}
      >
        <RadioSelection value={selection}>{children}</RadioSelection>
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
  const selection = useContext(RadioSelection)
  return (
    <label
      data-slot="radio-option"
      {...stylex.props(styles.option, selection && styles.radioOption)}
    >
      {selection?.value === value && (
        <motion.span
          aria-hidden="true"
          data-slot="radio-selection"
          data-motion={selection.immediate ? 'immediate' : 'pointer'}
          layoutId={`${selection.id}-selection`}
          initial={false}
          transition={{
            type: 'spring',
            duration: selection.immediate ? 0 : 0.24,
            bounce: 0,
          }}
          style={{ borderRadius: radii.control }}
          {...stylex.props(styles.selection)}
        />
      )}
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
        <span
          data-slot="choice-description"
          {...stylex.props(styles.description)}
        >
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
  radioOption: {
    isolation: 'isolate',
    position: 'relative',
    ':has([data-checked])': {
      backgroundColor: 'transparent',
    },
  },
  selection: {
    backgroundColor: colors.surfaceSelected,
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: -1,
  },
  option: {
    alignItems: 'flex-start',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceMuted,
      },
    },
    borderRadius: radii.control,
    cursor: 'pointer',
    display: 'flex',
    gap: space.x3,
    minBlockSize: '2.75rem',
    paddingBlock: space.x3,
    paddingInline: space.x3,
    ':has([data-checked])': {
      backgroundColor: colors.surfaceSelected,
    },
    ':has([data-disabled])': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
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
    marginBlockStart: '0.1875rem',
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
    blockSize: '0.375rem',
    borderRadius: '999px',
    inlineSize: '0.375rem',
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
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  description: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
})
