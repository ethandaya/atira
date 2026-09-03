import { Select } from '@base-ui/react/select'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export type SelectPickerOption = Readonly<{
  description?: string
  disabled?: boolean
  label: string
  value: string
}>

export type SelectPickerProps = {
  disabled?: boolean
  label: string
  name?: string
  onValueChange: (value: string) => void
  options: readonly SelectPickerOption[]
  placeholder?: string
  value?: string
}

export function SelectPicker({
  disabled,
  label,
  name,
  onValueChange,
  options,
  placeholder = 'Select',
  value,
}: SelectPickerProps) {
  return (
    <Select.Root
      disabled={disabled}
      items={options}
      name={name}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next)
      }}
      value={value ?? null}
    >
      <Select.Label {...stylex.props(styles.visuallyHidden)}>
        {label}
      </Select.Label>
      <Select.Trigger
        aria-label={label}
        data-slot="select-picker-trigger"
        className={(state) =>
          stylex.props(styles.trigger, state.open && styles.triggerOpen).className
        }
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon aria-hidden="true" {...stylex.props(styles.icon)}>
          ▾
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          alignItemWithTrigger={false}
          sideOffset={4}
          {...stylex.props(styles.positioner)}
        >
          <Select.Popup data-slot="select-picker-popup" {...stylex.props(styles.popup)}>
            <Select.List {...stylex.props(styles.list)}>
              {options.map((option) => (
                <Select.Item
                  disabled={option.disabled}
                  key={option.value}
                  value={option.value}
                  className={(state) =>
                    stylex.props(
                      styles.item,
                      state.highlighted && styles.itemHighlighted,
                      state.selected && styles.itemSelected,
                    ).className
                  }
                >
                  <Select.ItemText {...stylex.props(styles.itemCopy)}>
                    <span>{option.label}</span>
                    {option.description && (
                      <span {...stylex.props(styles.description)}>
                        {option.description}
                      </span>
                    )}
                  </Select.ItemText>
                  <Select.ItemIndicator aria-hidden="true">✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

const styles = stylex.create({
  visuallyHidden: {
    blockSize: '1px',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    inlineSize: '1px',
    margin: '-1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
  trigger: {
    alignItems: 'center',
    appearance: 'none',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceMuted,
      },
    },
    borderColor: 'transparent',
    borderRadius: radii.control,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x1,
    justifyContent: 'space-between',
    lineHeight: type.lineCompact,
    maxInlineSize: '12rem',
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    opacity: { default: 1, ':disabled': 0.5 },
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineStyle: 'solid',
    outlineWidth: '3px',
    overflow: 'hidden',
    paddingInline: space.x2,
    textOverflow: 'ellipsis',
    touchAction: 'manipulation',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, color',
    whiteSpace: 'nowrap',
  },
  triggerOpen: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  icon: {
    flexShrink: 0,
    fontSize: type.sizeCaption,
  },
  positioner: {
    maxInlineSize: 'min(20rem, var(--available-width))',
    outline: 'none',
    zIndex: 20,
  },
  popup: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: '0 0.5rem 1.5rem oklch(0 0 0 / 0.12)',
    color: colors.text,
    minInlineSize: 'max(10rem, var(--anchor-width))',
    outline: 'none',
    overflow: 'hidden',
  },
  list: {
    maxBlockSize: 'min(20rem, var(--available-height))',
    overflowY: 'auto',
    padding: space.x1,
  },
  item: {
    alignItems: 'center',
    borderRadius: radii.control,
    color: colors.text,
    cursor: 'default',
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x3,
    justifyContent: 'space-between',
    minBlockSize: '2.5rem',
    opacity: { default: 1, '[data-disabled]': 0.45 },
    outline: 'none',
    paddingBlock: space.x2,
    paddingInline: space.x2,
    userSelect: 'none',
  },
  itemHighlighted: {
    backgroundColor: colors.surfaceMuted,
  },
  itemSelected: {
    color: colors.text,
    fontWeight: type.weightMedium,
  },
  itemCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightRegular,
  },
})
