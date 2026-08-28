import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './button'

export type IconButtonProps = Omit<ButtonProps, 'aria-label' | 'children'> & {
  'aria-label': string
  children: ReactNode
  iconSize?: 'small' | 'regular'
}

export function IconButton({
  'aria-label': label,
  children,
  iconSize = 'regular',
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      data-component="icon-button"
      size="icon"
    >
      <span
        aria-hidden="true"
        data-slot="icon-button-icon"
        {...stylex.props(iconSizes[iconSize])}
      >
        {children}
      </span>
    </Button>
  )
}

const iconSizes = stylex.create({
  small: {
    alignItems: 'center',
    display: 'inline-flex',
    fontSize: '1rem',
  },
  regular: {
    alignItems: 'center',
    display: 'inline-flex',
    fontSize: '1.25rem',
  },
})
