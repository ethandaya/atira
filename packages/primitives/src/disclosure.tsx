import { Collapsible } from '@base-ui/react/collapsible'
import {
  colors,
  motion,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

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
}

export function Disclosure({
  children,
  defaultOpen,
  disabled,
  onOpenChange,
  open,
  summary,
  ...props
}: DisclosureProps) {
  return (
    <Collapsible.Root
      {...props}
      defaultOpen={defaultOpen}
      disabled={disabled}
      onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)}
      open={open}
      data-slot="disclosure"
      {...stylex.props(styles.root)}
    >
      <Collapsible.Trigger
        data-slot="disclosure-trigger"
        {...stylex.props(styles.trigger)}
      >
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Panel
        data-slot="disclosure-panel"
        {...stylex.props(styles.panel)}
      >
        {children}
      </Collapsible.Panel>
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
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceMuted,
      },
    },
    borderColor: 'transparent',
    borderRadius: '0.375rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    inlineSize: '100%',
    justifyContent: 'space-between',
    lineHeight: type.lineCompact,
    minBlockSize: '2.75rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    paddingBlock: space.x2,
    paddingInline: space.x2,
    textAlign: 'start',
    touchAction: 'manipulation',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, color',
    transitionTimingFunction: motion.easingStandard,
  },
  panel: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    paddingBlockEnd: space.x3,
    paddingInline: space.x2,
  },
})
