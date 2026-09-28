import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef } from 'react'

export type VisuallyHiddenProps = Omit<
  ComponentPropsWithRef<'span'>,
  'className' | 'style'
>

export function VisuallyHidden(props: VisuallyHiddenProps) {
  return (
    <span
      {...props}
      data-slot="visually-hidden"
      {...stylex.props(styles.root)}
    />
  )
}

const styles = stylex.create({
  root: {
    blockSize: '1px',
    borderWidth: 0,
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    inlineSize: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
})
