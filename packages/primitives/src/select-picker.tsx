import { Select } from '@base-ui/react/select'
import {
  colors,
  motion,
  radii,
  shadows,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Check, ChevronDown } from 'lucide-react'
import { useRef, type ComponentProps } from 'react'

/** Unstyled Base UI parts for custom select composition. */
export const SelectPickerParts = Select

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
  portalContainer?: ComponentProps<typeof Select.Portal>['container']
  value?: string
}

export function SelectPicker({
  disabled,
  label,
  name,
  onValueChange,
  options,
  placeholder = 'Select',
  portalContainer,
  value,
}: SelectPickerProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  return (
    <span ref={portalContainerRef} data-slot="select-picker" {...stylex.props(styles.container)}>
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
        <Select.Icon aria-hidden="true" {...stylex.props(styles.iconSlot)}>
          <ChevronDown
            strokeWidth={1.75}
            {...stylex.props(styles.icon)}
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer ?? portalContainerRef}>
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
                  <Select.ItemIndicator aria-hidden="true">
                    <Check strokeWidth={1.75} {...stylex.props(styles.icon)} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    </span>
  )
}

const styles = stylex.create({
  container: {
    display: 'inline-flex',
  },
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
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
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
    gap: space.x2,
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
    backgroundColor: colors.surfaceHover,
    color: colors.text,
  },
  icon: {
    blockSize: '0.875rem',
    flexShrink: 0,
    inlineSize: '0.875rem',
  },
  iconSlot: {
    alignItems: 'center',
    blockSize: '1rem',
    display: 'inline-flex',
    flexShrink: 0,
    inlineSize: '1rem',
    justifyContent: 'center',
    lineHeight: 0,
  },
  positioner: {
    maxInlineSize: 'min(20rem, var(--available-width))',
    outline: 'none',
    zIndex: 20,
  },
  popup: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: radii.popover,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: shadows.overlay,
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
    backgroundColor: colors.surfaceHover,
  },
  itemSelected: {
    backgroundColor: colors.surfaceSelected,
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
