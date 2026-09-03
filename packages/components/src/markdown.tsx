import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Streamdown, type Components } from 'streamdown'
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  JSX,
} from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'style'
>

export type MarkdownProps = NativeDivProps & {
  children: string
  status: 'streaming' | 'complete'
}

const linkSafety = { enabled: false } as const
const disallowedElements = ['img'] as const

export function Markdown({ children, status, ...props }: MarkdownProps) {
  return (
    <div
      {...props}
      aria-busy={status === 'streaming' || undefined}
      data-slot="markdown"
      data-state={status}
      {...stylex.props(styles.root)}
    >
      <Streamdown
        className={stylex.props(styles.content).className ?? ''}
        components={markdownComponents}
        controls={false}
        dir="auto"
        disallowedElements={disallowedElements}
        isAnimating={false}
        linkSafety={linkSafety}
        mode="streaming"
        parseIncompleteMarkdown
        skipHtml
      >
        {children}
      </Streamdown>
    </div>
  )
}

type ElementProps<Tag extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<Tag> & {
    node?: unknown
  }

function Paragraph({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'p'>) {
  return <p {...props} {...stylex.props(styles.paragraph)} />
}

function Heading1({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h1'>) {
  return <h1 {...props} {...stylex.props(styles.heading, styles.heading1)} />
}

function Heading2({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h2'>) {
  return <h2 {...props} {...stylex.props(styles.heading, styles.heading2)} />
}

function Heading3({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h3'>) {
  return <h3 {...props} {...stylex.props(styles.heading, styles.heading3)} />
}

function Heading4({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h4'>) {
  return <h4 {...props} {...stylex.props(styles.heading, styles.heading4)} />
}

function Heading5({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h5'>) {
  return <h5 {...props} {...stylex.props(styles.heading, styles.heading4)} />
}

function Heading6({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'h6'>) {
  return <h6 {...props} {...stylex.props(styles.heading, styles.heading4)} />
}

function UnorderedList({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'ul'>) {
  return <ul {...props} {...stylex.props(styles.list)} />
}

function OrderedList({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'ol'>) {
  return <ol {...props} {...stylex.props(styles.list)} />
}

function ListItem({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'li'>) {
  return <li {...props} {...stylex.props(styles.listItem)} />
}

function Link({
  children,
  className: _className,
  href,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'a'>) {
  if (!href || href === 'streamdown:incomplete-link') {
    return <span>{children}</span>
  }

  return (
    <a
      {...props}
      href={href}
      rel="noreferrer"
      target="_blank"
      {...stylex.props(styles.link)}
    >
      {children}
    </a>
  )
}

function Strong({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'strong'>) {
  return <strong {...props} {...stylex.props(styles.strong)} />
}

function Blockquote({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'blockquote'>) {
  return <blockquote {...props} {...stylex.props(styles.blockquote)} />
}

function Code({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'code'>) {
  if ('data-block' in props) {
    return (
      <pre data-slot="markdown-code-block" {...stylex.props(styles.codeBlock)}>
        <code {...props} {...stylex.props(styles.blockCode)} />
      </pre>
    )
  }

  return <code {...props} {...stylex.props(styles.inlineCode)} />
}

function Table({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'table'>) {
  return (
    <div
      aria-label="Scrollable table"
      role="region"
      tabIndex={0}
      {...stylex.props(styles.tableScroller)}
    >
      <table {...props} {...stylex.props(styles.table)} />
    </div>
  )
}

function TableHead({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'thead'>) {
  return <thead {...props} {...stylex.props(styles.tableHead)} />
}

function TableHeader({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'th'>) {
  return <th {...props} {...stylex.props(styles.tableCell, styles.tableHeader)} />
}

function TableCell({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'td'>) {
  return <td {...props} {...stylex.props(styles.tableCell)} />
}

function HorizontalRule({
  className: _className,
  node: _node,
  style: _style,
  ...props
}: ElementProps<'hr'>) {
  return <hr {...props} {...stylex.props(styles.rule)} />
}

const markdownComponents = {
  a: Link,
  blockquote: Blockquote,
  code: Code,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  hr: HorizontalRule,
  li: ListItem,
  ol: OrderedList,
  p: Paragraph,
  strong: Strong,
  table: Table,
  td: TableCell,
  th: TableHeader,
  thead: TableHead,
  ul: UnorderedList,
} satisfies Components

const styles = stylex.create({
  root: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    inlineSize: '100%',
    lineHeight: type.lineBody,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    inlineSize: '100%',
    minInlineSize: 0,
  },
  paragraph: {
    margin: 0,
    maxInlineSize: '65ch',
  },
  heading: {
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
    maxInlineSize: '65ch',
    paddingBlockStart: space.x1,
    textWrap: 'balance',
  },
  heading1: {
    fontSize: '1.125rem',
  },
  heading2: {
    fontSize: '1rem',
  },
  heading3: {
    fontSize: '0.9375rem',
  },
  heading4: {
    fontSize: type.sizeBody,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    margin: 0,
    maxInlineSize: '65ch',
    paddingInlineStart: space.x5,
  },
  listItem: {
    paddingInlineStart: space.x1,
  },
  link: {
    color: colors.text,
    fontWeight: type.weightMedium,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    textDecorationLine: 'underline',
    textDecorationThickness: '0.08em',
    textUnderlineOffset: '0.16em',
  },
  strong: {
    fontWeight: type.weightStrong,
  },
  blockquote: {
    borderInlineStartColor: colors.borderStrong,
    borderInlineStartStyle: 'solid',
    borderInlineStartWidth: '2px',
    color: colors.textMuted,
    margin: 0,
    maxInlineSize: '65ch',
    paddingInlineStart: space.x3,
  },
  inlineCode: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    fontFamily: type.familyMono,
    fontSize: '0.9em',
    paddingBlock: '0.1em',
    paddingInline: '0.35em',
  },
  codeBlock: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    inlineSize: '100%',
    margin: 0,
    maxBlockSize: '25rem',
    overflow: 'auto',
    padding: space.x3,
  },
  blockCode: {
    direction: 'ltr',
    display: 'block',
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    tabSize: 2,
    textAlign: 'start',
    whiteSpace: 'pre',
  },
  tableScroller: {
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    maxInlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    overflowX: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    inlineSize: '100%',
  },
  tableHead: {
    backgroundColor: colors.surfaceMuted,
  },
  tableCell: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    paddingBlock: space.x2,
    paddingInline: space.x3,
    textAlign: 'start',
    verticalAlign: 'top',
  },
  tableHeader: {
    fontSize: type.sizeSmall,
    fontWeight: type.weightStrong,
  },
  rule: {
    borderBlockEndWidth: 0,
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    inlineSize: '100%',
    margin: 0,
  },
})
