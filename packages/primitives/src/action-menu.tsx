import { Menu } from '@base-ui/react/menu'
import {
  colors,
  motion,
  radii,
  shadows,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

export type ActionMenuItem = Readonly<{
  description?: string
  disabled?: boolean
  icon?: ReactNode
  id: string
  label: string
  onSelect: () => void
}>

export type ActionMenuProps = {
  disabled?: boolean
  items: readonly ActionMenuItem[]
  label: string
  side?: 'top' | 'bottom'
  trigger: ReactNode
}

export function ActionMenu({
  disabled = false,
  items,
  label,
  side = 'bottom',
  trigger,
}: ActionMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        data-slot="action-menu-trigger"
        disabled={disabled || items.length === 0}
        className={(state) =>
          stylex.props(styles.trigger, state.open && styles.triggerOpen).className
        }
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="start"
          side={side}
          sideOffset={6}
          {...stylex.props(styles.positioner)}
        >
          <Menu.Popup
            aria-label={label}
            data-slot="action-menu-popup"
            {...stylex.props(styles.popup)}
          >
            {items.map((item) => (
              <Menu.Item
                disabled={item.disabled}
                key={item.id}
                label={item.label}
                onClick={item.onSelect}
                className={(state) =>
                  stylex.props(
                    styles.item,
                    state.highlighted && styles.itemHighlighted,
                  ).className
                }
              >
                {item.icon && (
                  <span aria-hidden="true" {...stylex.props(styles.icon)}>
                    {item.icon}
                  </span>
                )}
                <span {...stylex.props(styles.itemCopy)}>
                  <span>{item.label}</span>
                  {item.description && (
                    <span {...stylex.props(styles.description)}>
                      {item.description}
                    </span>
                  )}
                </span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

const styles = stylex.create({
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
    fontWeight: type.weightMedium,
    gap: space.x1,
    justifyContent: 'center',
    lineHeight: type.lineCompact,
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    minInlineSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineStyle: 'solid',
    outlineWidth: '3px',
    paddingInline: space.x2,
    touchAction: 'manipulation',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, color',
    transitionTimingFunction: motion.easingStandard,
  },
  triggerOpen: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
  },
  positioner: {
    maxInlineSize: 'min(18rem, var(--available-width))',
    outline: 'none',
    zIndex: 20,
  },
  popup: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: shadows.overlay,
    boxSizing: 'border-box',
    color: colors.text,
    maxBlockSize: 'min(24rem, var(--available-height))',
    minInlineSize: '12rem',
    outline: 'none',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    padding: space.x1,
    transformOrigin: 'var(--transform-origin)',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: motion.easingStandard,
    '@media (prefers-reduced-motion: no-preference)': {
      ':is([data-starting-style], [data-ending-style])': {
        opacity: 0,
        transform: 'scale(0.98)',
      },
    },
  },
  item: {
    alignItems: 'center',
    borderRadius: radii.control,
    color: colors.text,
    cursor: 'default',
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x2,
    minBlockSize: {
      default: '2.25rem',
      '@media (hover: none)': '2.75rem',
    },
    opacity: { default: 1, '[data-disabled]': 0.45 },
    outline: 'none',
    paddingBlock: space.x1,
    paddingInline: space.x2,
    userSelect: 'none',
  },
  itemHighlighted: {
    backgroundColor: colors.surfaceHover,
  },
  icon: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'inline-flex',
    flexShrink: 0,
    inlineSize: '1rem',
    justifyContent: 'center',
  },
  itemCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minInlineSize: 0,
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightRegular,
  },
})
