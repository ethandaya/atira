import { space } from '@pretty-amped/foundations/tokens.stylex'
import {
  IconButton,
  type IconButtonProps,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'children' | 'className' | 'style'
>

export type ActionsProps = NativeDivProps & {
  children: ReactNode
  label?: string
}

export function Actions({
  children,
  label = 'Message actions',
  ref,
  ...props
}: ActionsProps) {
  return (
    <div
      {...props}
      ref={ref}
      aria-label={label}
      role="group"
      data-slot="actions"
      {...stylex.props(styles.root)}
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
  label,
  title = label,
  variant = 'quiet',
  ...props
}: ActionProps) {
  return (
    <span data-slot="action" data-action-label={label} {...stylex.props(styles.item)}>
      <IconButton
        {...props}
        aria-label={label}
        iconSize="small"
        title={title}
        variant={variant}
      >
        {children}
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
