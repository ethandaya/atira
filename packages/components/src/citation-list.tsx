import { colors, radii, space, type } from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'

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

type NativeSupProps = Omit<
  ComponentPropsWithRef<'sup'>,
  'children' | 'className' | 'style' | 'title'
>

export type InlineCitationProps = NativeSupProps & {
  citation: Citation
  marker?: ReactNode
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
      <Heading
        id={titleId}
        data-slot="citation-list-title"
        {...stylex.props(styles.title)}
      >
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
            const content = (
              <>
                <span {...stylex.props(styles.heading)}>
                  <span
                    data-slot="citation-title"
                    {...stylex.props(styles.itemTitle)}
                  >
                    {citation.title}
                  </span>
                  {citation.source && (
                    <span
                      data-slot="citation-source"
                      {...stylex.props(styles.source)}
                    >
                      {citation.source}
                    </span>
                  )}
                </span>
                {citation.description && (
                  <span
                    data-slot="citation-description"
                    {...stylex.props(styles.description)}
                  >
                    {citation.description}
                  </span>
                )}
              </>
            )
            return (
              <li
                key={citation.id}
                data-citation-id={citation.id}
                data-link-state={hrefState.status}
                data-slot="citation"
                {...stylex.props(styles.item)}
              >
                {hrefState.status === 'valid' ? (
                  <a
                    aria-label={citation.title}
                    href={hrefState.href}
                    rel="noreferrer noopener"
                    data-slot="citation-link"
                    {...stylex.props(styles.link)}
                  >
                    {content}
                  </a>
                ) : (
                  <span {...stylex.props(styles.entry)}>
                    {content}
                    <span
                      data-slot="citation-link-status"
                      {...stylex.props(styles.unavailable)}
                    >
                      {hrefState.status === 'invalid'
                        ? 'Invalid link'
                        : 'Link unavailable'}
                    </span>
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

export function InlineCitation({
  citation,
  marker,
  ref,
  ...props
}: InlineCitationProps) {
  const hrefState = getHrefState(citation.href)
  const content = marker ?? citation.source ?? 'Source'
  const label = citation.source
    ? `Source: ${citation.title}, ${citation.source}`
    : `Source: ${citation.title}`

  return (
    <sup
      {...props}
      ref={ref}
      data-citation-id={citation.id}
      data-link-state={hrefState.status}
      data-slot="inline-citation"
      {...stylex.props(styles.inlineRoot)}
    >
      {hrefState.status === 'valid' ? (
        <a
          aria-label={label}
          href={hrefState.href}
          rel="noreferrer noopener"
          title={citation.title}
          data-slot="inline-citation-link"
          {...stylex.props(styles.inlineMarker)}
        >
          {content}
        </a>
      ) : (
        <span
          aria-label={`${label}; link unavailable`}
          data-slot="inline-citation-unavailable"
          {...stylex.props(styles.inlineMarker, styles.inlineUnavailable)}
        >
          {content}
        </span>
      )}
    </sup>
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
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    ':last-child': { borderBlockEndWidth: 0 },
    paddingBlock: space.x1,
    paddingInlineStart: space.x1,
  },
  heading: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  entry: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    paddingBlock: space.x3,
  },
  link: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    borderRadius: radii.control,
    marginInline: '-0.5rem',
    padding: '0.75rem 0.5rem',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
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
    textDecoration: 'none',
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
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    fontWeight: type.weightRegular,
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
  inlineRoot: {
    fontSize: 'inherit',
    lineHeight: 0,
    verticalAlign: 'baseline',
  },
  inlineMarker: {
    backgroundColor: {
      default: colors.surfaceMuted,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.border,
      },
    },
    borderRadius: '0.3rem',
    color: colors.textMuted,
    display: 'inline-flex',
    fontFamily: type.family,
    fontSize: '0.6875rem',
    fontWeight: type.weightMedium,
    lineHeight: '1.25rem',
    marginInline: '0.125rem',
    maxInlineSize: '12rem',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '1px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    overflow: 'hidden',
    paddingInline: '0.375rem',
    textDecoration: 'none',
    textOverflow: 'ellipsis',
    touchAction: 'manipulation',
    verticalAlign: '0.08em',
    whiteSpace: 'nowrap',
  },
  inlineUnavailable: {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
})
