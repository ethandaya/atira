import { Collapsible } from '@base-ui/react/collapsible'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { ChevronRight } from 'lucide-react'
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { AnimatePresence, PresenceSurface } from './presence'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'style'
>

export type DisclosureProps = NativeDivProps & {
  children: ReactNode
  defaultOpen?: boolean
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  summary: ReactNode
  variant?: 'default' | 'plain'
}

export function Disclosure({
  children,
  defaultOpen,
  disabled,
  onOpenChange,
  open,
  summary,
  variant = 'default',
  ...props
}: DisclosureProps) {
  const [immediate, setImmediate] = useState(true)
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false)
  const isOpen = !disabled && (open ?? localOpen)
  return (
    <Collapsible.Root
      {...props}
      disabled={disabled}
      onOpenChange={(nextOpen, details) => {
        setImmediate(details.event.type.startsWith('key'))
        setLocalOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }}
      open={isOpen}
      data-slot="disclosure"
      {...stylex.props(styles.root)}
    >
      <Collapsible.Trigger
        render={(triggerProps, state) => (
          <button
            {...triggerProps}
            data-slot="disclosure-trigger"
            {...stylex.props(
              styles.trigger,
              variant === 'plain' && styles.triggerPlain,
              disabled && styles.triggerDisabled,
            )}
          >
            <span
              data-slot="disclosure-summary"
              {...stylex.props(
                styles.summary,
                variant === 'plain' && styles.summaryPlain,
              )}
            >
              {summary}
            </span>
            <ChevronRight
              aria-hidden="true"
              data-slot="disclosure-indicator"
              focusable="false"
              strokeWidth={1.75}
              {...stylex.props(
                styles.indicator,
                state.open && styles.indicatorOpen,
                disabled && styles.indicatorDisabled,
              )}
            />
          </button>
        )}
      />
      <AnimatePresence initial={false}>
      {isOpen && <Collapsible.Panel
        keepMounted
        render={<PresenceSurface kind="content" immediate={immediate} />}
        data-slot="disclosure-panel"
        {...stylex.props(
          styles.panel,
          variant === 'plain' && styles.panelPlain,
        )}
      >
        {children}
      </Collapsible.Panel>}
      </AnimatePresence>
    </Collapsible.Root>
  )
}

const styles = stylex.create({
  root: {
    inlineSize: '100%',
  },
  trigger: {
    alignItems: 'center',
    appearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    gap: space.x2,
    inlineSize: '100%',
    justifyContent: 'space-between',
    lineHeight: type.lineCompact,
    minBlockSize: '2.75rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '-3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    paddingBlock: space.x2,
    paddingInline: space.x3,
    textAlign: 'start',
    touchAction: 'manipulation',
  },
  summary: {
    flex: 1,
    minInlineSize: 0,
  },
  summaryPlain: {
    flex: 1,
  },
  triggerPlain: {
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
    borderRadius: radii.control,
    inlineSize: '100%',
    justifyContent: 'space-between',
    maxInlineSize: '100%',
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    paddingBlock: space.x1,
    paddingInline: space.x2,
  },
  indicator: {
    blockSize: '1rem',
    color: colors.textMuted,
    flexShrink: 0,
    inlineSize: '1rem',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: motion.easingStandard,
  },
  indicatorOpen: {
    transform: 'rotate(90deg)',
  },
  triggerDisabled: {
    cursor: 'default',
    backgroundColor: 'transparent',
  },
  indicatorDisabled: {
    visibility: 'hidden',
  },
  panel: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    padding: space.x3,
  },
  panelPlain: {
    borderBlockStartStyle: 'none',
    paddingBlock: space.x2,
    paddingInline: space.x1,
  },
})
