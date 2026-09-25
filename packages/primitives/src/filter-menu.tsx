import { Combobox } from '@base-ui/react/combobox'
import {
  colors,
  radii,
  shadows,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'

export type FilterMenuItem = Readonly<{
  description?: string
  disabled?: boolean
  id: string
  label: string
}>

export type FilterMenuProps<Item extends FilterMenuItem> = {
  disabled?: boolean
  emptyLabel?: string
  inputValue?: string
  items: readonly Item[]
  label: string
  onInputValueChange?: (value: string) => void
  onOpenChange?: (open: boolean) => void
  onSelect: (item: Item) => void
  open?: boolean
  placeholder?: string
  portalContainer?: ComponentProps<typeof Combobox.Portal>['container']
  triggerLabel: ReactNode
}

export function FilterMenu<Item extends FilterMenuItem>({
  disabled,
  emptyLabel = 'No matches.',
  inputValue,
  items,
  label,
  onInputValueChange,
  onOpenChange,
  onSelect,
  open,
  placeholder = 'Filter…',
  portalContainer,
  triggerLabel,
}: FilterMenuProps<Item>) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalValue, setInternalValue] = useState('')
  const resolvedOpen = open ?? internalOpen
  const resolvedValue = inputValue ?? internalValue

  function changeOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  function changeInput(next: string) {
    if (inputValue === undefined) setInternalValue(next)
    onInputValueChange?.(next)
  }

  useEffect(() => {
    if (!resolvedOpen) return
    const frame = requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [resolvedOpen])

  return (
    <span
      ref={portalContainerRef}
      data-slot="filter-menu"
      {...stylex.props(styles.container)}
    >
      <Combobox.Root<Item>
        autoHighlight
        inputValue={resolvedValue}
        itemToStringLabel={(item) => item.label}
        items={items}
        onInputValueChange={changeInput}
        onOpenChange={changeOpen}
        onValueChange={(item) => {
          if (!item) return
          onSelect(item)
          changeInput('')
          changeOpen(false)
        }}
        open={resolvedOpen}
        value={null}
      >
        <Combobox.Trigger
          aria-label={label}
          data-slot="filter-menu-trigger"
          disabled={disabled || items.length === 0}
          className={(state) =>
            stylex.props(styles.trigger, state.open && styles.triggerOpen)
              .className
          }
        >
          {triggerLabel}
        </Combobox.Trigger>
        <Combobox.Portal container={portalContainer ?? portalContainerRef}>
          <Combobox.Positioner
            align="start"
            side="top"
            sideOffset={6}
            {...stylex.props(styles.positioner)}
          >
            <Combobox.Popup
              aria-label={label}
              data-slot="filter-menu-popup"
              {...stylex.props(styles.popup)}
            >
              <Combobox.Label {...stylex.props(styles.label)}>
                {label}
              </Combobox.Label>
              <Combobox.Input
                ref={inputRef}
                aria-label={label}
                autoComplete="off"
                placeholder={placeholder}
                spellCheck={false}
                {...stylex.props(styles.input)}
              />
              <div
                data-slot="filter-menu-results"
                {...stylex.props(styles.results)}
              >
                <Combobox.Empty {...stylex.props(styles.empty)}>
                  {emptyLabel}
                </Combobox.Empty>
                <Combobox.List {...stylex.props(styles.list)}>
                  {(item: Item) => (
                    <Combobox.Item
                      disabled={item.disabled}
                      key={item.id}
                      value={item}
                      className={(state) =>
                        stylex.props(
                          styles.item,
                          state.highlighted && styles.itemHighlighted,
                        ).className
                      }
                    >
                      <span>{item.label}</span>
                      {item.description && (
                        <span {...stylex.props(styles.description)}>
                          {item.description}
                        </span>
                      )}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </div>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </span>
  )
}

const styles = stylex.create({
  container: {
    display: 'inline-flex',
  },
  trigger: {
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
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineCompact,
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    minInlineSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    opacity: { default: 1, ':disabled': 0.5 },
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineStyle: 'solid',
    outlineWidth: '3px',
    paddingInline: space.x2,
    touchAction: 'manipulation',
  },
  triggerOpen: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
  },
  positioner: {
    inlineSize: 'min(22rem, var(--available-width))',
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
    boxSizing: 'border-box',
    color: colors.text,
    inlineSize: '100%',
    outline: 'none',
    overflow: 'hidden',
    paddingBlockStart: space.x2,
  },
  label: {
    color: colors.textMuted,
    display: 'block',
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    paddingBlockEnd: space.x2,
    paddingInline: space.x3,
  },
  input: {
    appearance: 'none',
    backgroundColor: colors.surfaceInset,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeInput,
    inlineSize: 'calc(100% - 1rem)',
    lineHeight: type.lineBody,
    marginInline: space.x2,
    minBlockSize: '2.75rem',
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineStyle: 'solid',
    outlineWidth: '3px',
    paddingInline: space.x3,
  },
  results: {
    minBlockSize:
      'min(12rem, max(0px, calc(var(--available-height) - 6.5rem)))',
    maxBlockSize:
      'min(18rem, max(0px, calc(var(--available-height) - 6.5rem)))',
    overflowY: 'auto',
    marginBlockStart: space.x2,
    overscrollBehaviorY: 'contain',
  },
  list: {
    padding: space.x1,
  },
  item: {
    borderRadius: radii.control,
    color: colors.text,
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    gap: space.x1,
    justifyContent: 'center',
    minBlockSize: '2.75rem',
    opacity: { default: 1, '[data-disabled]': 0.45 },
    outline: 'none',
    paddingBlock: space.x3,
    paddingInline: space.x3,
    overflowWrap: 'anywhere',
    userSelect: 'none',
  },
  itemHighlighted: {
    backgroundColor: colors.surfaceSelected,
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightRegular,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    padding: space.x4,
    ':empty': { padding: 0 },
  },
})
