import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Children, type ComponentPropsWithRef, type ReactNode } from 'react'

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'aria-label' | 'children' | 'className' | 'style'
>

export type ThreadProps = NativeSectionProps & {
  busy?: boolean
  children?: ReactNode
  empty?: ReactNode
  label: string
}

export function Thread({
  busy = false,
  children,
  empty = 'No messages yet.',
  label,
  ...props
}: ThreadProps) {
  const isEmpty = Children.count(children) === 0

  return (
    <section
      {...props}
      aria-busy={busy || undefined}
      aria-label={label}
      data-slot="thread"
      data-state={busy ? 'busy' : isEmpty ? 'empty' : 'populated'}
      {...stylex.props(styles.root)}
    >
      {isEmpty ? (
        <div data-slot="thread-empty" {...stylex.props(styles.empty)}>
          {empty}
        </div>
      ) : (
        <ol data-slot="thread-list" {...stylex.props(styles.list)}>
          {children}
        </ol>
      )}
    </section>
  )
}

const styles = stylex.create({
  root: {
    inlineSize: '100%',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x6,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    paddingBlock: space.x8,
    textAlign: 'center',
  },
})
