import { Collapsible } from '@base-ui/react/collapsible'
import {
  colors,
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
        <span data-slot="disclosure-summary" {...stylex.props(styles.summary)}>
          {summary}
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 16 16"
          data-slot="disclosure-indicator"
          {...stylex.props(styles.indicator)}
        >
          <path
            d="m5.75 3.5 4.5 4.5-4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
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
  indicator: {
    blockSize: '1rem',
    color: colors.textMuted,
    flexShrink: 0,
    inlineSize: '1rem',
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
})
