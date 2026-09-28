import { space } from '@atiraui/foundations/tokens.stylex'
import {
  IconButton,
  StateTransition,
  type IconButtonProps,
  resolveStyleProps,
  type StyleProps,
} from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'children' | 'className' | 'style'
>

export type ActionsProps = NativeDivProps &
  StyleProps & {
    children: ReactNode
    label?: string
  }

export function Actions({
  children,
  className,
  label = 'Message actions',
  ref,
  style,
  xstyle,
  ...props
}: ActionsProps) {
  return (
    <div
      {...props}
      ref={ref}
      aria-label={label}
      role="group"
      data-slot="actions"
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      {children}
    </div>
  )
}

export type ActionProps = Omit<IconButtonProps, 'aria-label'> & {
  label: string
}

export function Action({
  children,
  iconSize = 'small',
  label,
  title = label,
  variant = 'quiet',
  ...props
}: ActionProps) {
  return (
    <span
      data-slot="action"
      data-action-label={label}
      {...stylex.props(styles.item)}
    >
      <IconButton
        {...props}
        aria-label={label}
        iconSize={iconSize}
        title={title}
        variant={variant}
      >
        <StateTransition state={label} size={iconSize === 'small' ? 16 : 20}>
          {children}
        </StateTransition>
      </IconButton>
    </span>
  )
}

const styles = stylex.create({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x1,
  },
  item: {
    display: 'inline-flex',
  },
})
