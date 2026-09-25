import {
  chatAppearance,
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { resolveStyleProps, type StyleProps } from '@pretty-amped/primitives'

export type MessageActor = 'user' | 'assistant' | 'system'

type NativeListItemProps = Omit<
  ComponentPropsWithRef<'li'>,
  'children' | 'className' | 'style'
>

export type MessageProps = NativeListItemProps &
  StyleProps & {
    actions?: ReactNode
    actor: MessageActor
    children: ReactNode
    label?: string
    meta?: ReactNode
  }

export function Message({
  actions,
  actor,
  children,
  className,
  label,
  meta,
  style,
  xstyle,
  ...props
}: MessageProps) {
  const rootStyle = resolveStyleProps(
    [styles.item, alignment[actor]],
    xstyle,
    className,
    style,
  )
  return (
    <li {...props} data-actor={actor} data-slot="message" {...rootStyle}>
      <article
        aria-label={label}
        data-slot="message-article"
        {...stylex.props(styles.article, articleStyles[actor])}
      >
        <div
          data-slot="message-content"
          {...stylex.props(styles.content, contentStyles[actor])}
        >
          {children}
        </div>
        {(meta || actions) && (
          <footer data-slot="message-meta" {...stylex.props(styles.meta)}>
            {meta && <span>{meta}</span>}
            {actions && (
              <div role="group" aria-label="Message actions">
                {actions}
              </div>
            )}
          </footer>
        )}
      </article>
    </li>
  )
}

const styles = stylex.create({
  item: {
    display: 'flex',
    inlineSize: '100%',
  },
  article: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    maxInlineSize: '100%',
    minInlineSize: 0,
  },
  content: {
    boxSizing: 'border-box',
    color: colors.text,
    fontFamily: type.family,
    fontSize: chatAppearance.readingSize,
    fontWeight: type.weightRegular,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
  meta: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontVariantNumeric: 'tabular-nums',
    gap: space.x2,
    justifyContent: 'flex-end',
    lineHeight: type.lineCompact,
    minBlockSize: space.x4,
    paddingInline: space.x1,
  },
})

const alignment = stylex.create({
  user: {
    justifyContent: 'flex-end',
  },
  assistant: {
    justifyContent: 'flex-start',
  },
  system: {
    justifyContent: 'center',
  },
})

const articleStyles = stylex.create({
  user: {
    alignItems: 'flex-end',
    maxInlineSize: '82%',
  },
  assistant: {
    alignItems: 'stretch',
    inlineSize: '100%',
  },
  system: {
    alignItems: 'center',
    maxInlineSize: '42rem',
    textAlign: 'center',
  },
})

const contentStyles = stylex.create({
  user: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.surface,
    color: colors.text,
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  assistant: {},
  system: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
  },
})
