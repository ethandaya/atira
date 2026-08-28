import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef } from 'react'

export type Citation = Readonly<{
  description?: string
  href?: string
  id: string
  source?: string
  title: string
}>

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'aria-label' | 'children' | 'className' | 'id' | 'style' | 'title'
>

export type CitationListProps = NativeSectionProps & {
  citations: readonly Citation[]
  headingLevel?: 2 | 3 | 4 | 5 | 6
  id: string
  title?: string
}

export function CitationList({
  citations,
  headingLevel = 2,
  id,
  title = 'Sources',
  ...props
}: CitationListProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      {...props}
      id={id}
      aria-labelledby={titleId}
      data-citation-list-id={id}
      data-slot="citation-list"
      data-state={citations.length === 0 ? 'empty' : 'populated'}
      {...stylex.props(styles.root)}
    >
      <Heading id={titleId} data-slot="citation-list-title" {...stylex.props(styles.title)}>
        {title}
      </Heading>
      {citations.length === 0 ? (
        <p data-slot="citation-list-empty" {...stylex.props(styles.empty)}>
          No sources provided.
        </p>
      ) : (
        <ol data-slot="citation-list-items" {...stylex.props(styles.list)}>
          {citations.map((citation) => {
            const hrefState = getHrefState(citation.href)
            return (
              <li
                key={citation.id}
                data-citation-id={citation.id}
                data-link-state={hrefState.status}
                data-slot="citation"
                {...stylex.props(styles.item)}
              >
                <div {...stylex.props(styles.heading)}>
                  {hrefState.status === 'valid' ? (
                    <a
                      href={hrefState.href}
                      rel="noreferrer noopener"
                      data-slot="citation-link"
                      {...stylex.props(styles.link)}
                    >
                      {citation.title}
                    </a>
                  ) : (
                    <span data-slot="citation-title" {...stylex.props(styles.itemTitle)}>
                      {citation.title}
                    </span>
                  )}
                  {citation.source && (
                    <span data-slot="citation-source" {...stylex.props(styles.source)}>
                      {citation.source}
                    </span>
                  )}
                </div>
                {citation.description && (
                  <p data-slot="citation-description" {...stylex.props(styles.description)}>
                    {citation.description}
                  </p>
                )}
                {hrefState.status !== 'valid' && (
                  <span data-slot="citation-link-status" {...stylex.props(styles.unavailable)}>
                    {hrefState.status === 'invalid' ? 'Invalid link' : 'Link unavailable'}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

type HrefState =
  | { status: 'absent' | 'invalid' }
  | { status: 'valid'; href: string }

function getHrefState(href: string | undefined): HrefState {
  if (!href) return { status: 'absent' }
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? { href: url.href, status: 'valid' }
      : { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.text,
    fontFamily: type.family,
    inlineSize: '100%',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  title: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    fontSize: type.sizeTitle,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
    padding: space.x3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    margin: 0,
    paddingBlock: space.x1,
    paddingInlineEnd: space.x3,
    paddingInlineStart: space.x8,
  },
  item: {
    paddingBlock: space.x3,
    paddingInlineStart: space.x1,
  },
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    minInlineSize: 0,
  },
  link: {
    color: colors.text,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    textDecorationColor: colors.borderStrong,
    textUnderlineOffset: '0.15em',
  },
  itemTitle: {
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  source: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  unavailable: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  empty: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    margin: 0,
    padding: space.x4,
  },
})
