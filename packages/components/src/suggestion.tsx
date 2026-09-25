import { space } from '@pretty-amped/foundations/tokens.stylex'
import {
  Button,
  resolveStyleProps,
  type ButtonProps,
  type StyleProps,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'children' | 'className' | 'style'
>

export type SuggestionsProps = NativeDivProps &
  StyleProps & {
    children: ReactNode
    label?: string
  }

export function Suggestions({
  children,
  className,
  label = 'Suggested prompts',
  ref,
  style,
  xstyle,
  ...props
}: SuggestionsProps) {
  return (
    <div
      {...props}
      ref={ref}
      aria-label={label}
      role="group"
      data-slot="suggestions"
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      {children}
    </div>
  )
}

export type SuggestionProps = Omit<
  ButtonProps,
  'children' | 'onClick' | 'onSelect' | 'size'
> & {
  children?: ReactNode
  onSelect: (value: string) => void
  value: string
}

export function Suggestion({
  children,
  onSelect,
  value,
  variant = 'outline',
  ...props
}: SuggestionProps) {
  return (
    <span
      data-slot="suggestion"
      data-suggestion-value={value}
      {...stylex.props(styles.item)}
    >
      <Button
        {...props}
        onClick={() => onSelect(value)}
        size="chip"
        variant={variant}
      >
        {children ?? value}
      </Button>
    </span>
  )
}

const styles = stylex.create({
  root: {
    display: 'flex',
    gap: space.x2,
    inlineSize: '100%',
    minInlineSize: 0,
    overflowX: 'auto',
    overscrollBehaviorInline: 'contain',
    paddingBlock: space.x1,
    scrollbarWidth: 'none',
  },
  item: {
    display: 'inline-flex',
    flexShrink: 0,
  },
})
