import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'className' | 'onCopy' | 'style'
>

type CopyState =
  | { status: 'idle' }
  | { code: string; status: 'copying' | 'copied' | 'failed' }

export type CodeBlockProps = NativeDivProps & {
  code: string
  copyable?: boolean
  filename?: string
  label?: string
  language?: string
  onCopy?: (code: string) => Promise<void> | void
  wrap?: boolean
}

export function CodeBlock({
  code,
  copyable = true,
  filename,
  label = filename ? `Code in ${filename}` : 'Code block',
  language,
  onCopy,
  wrap = false,
  ...props
}: CodeBlockProps) {
  const [copyState, setCopyState] = useState<CopyState>({ status: 'idle' })
  const copyStatus =
    'code' in copyState && copyState.code !== code
      ? 'idle'
      : copyState.status
  const hasHeader = Boolean(filename || language || copyable)

  async function copyCode() {
    if (copyStatus === 'copying') return

    setCopyState({ code, status: 'copying' })

    try {
      if (onCopy) {
        await onCopy(code)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(code)
      } else {
        throw new Error('Clipboard access is unavailable.')
      }

      setCopyState({ code, status: 'copied' })
    } catch {
      setCopyState({ code, status: 'failed' })
    }
  }

  return (
    <div
      {...props}
      role="region"
      aria-label={label}
      data-language={language}
      data-slot="code-block"
      data-state={copyStatus}
      data-wrap={wrap ? 'true' : 'false'}
      {...stylex.props(styles.root)}
    >
      {hasHeader && (
        <div data-slot="code-block-header" {...stylex.props(styles.header)}>
          <span {...stylex.props(styles.metadata)}>
            {filename && (
              <span data-slot="code-block-filename" {...stylex.props(styles.filename)}>
                {filename}
              </span>
            )}
            {language && (
              <span data-slot="code-block-language" {...stylex.props(styles.language)}>
                {language}
              </span>
            )}
          </span>
          {copyable && (
            <Button
              disabled={copyStatus === 'copying'}
              focusableWhenDisabled={copyStatus === 'copying'}
              onClick={copyCode}
              size="compact"
              variant="quiet"
            >
              {getCopyLabel(copyStatus)}
            </Button>
          )}
        </div>
      )}
      <pre
        role="region"
        tabIndex={wrap ? undefined : 0}
        aria-label={`${label} contents`}
        data-slot="code-block-scroll-area"
        {...stylex.props(styles.pre, wrap ? styles.wrapped : styles.scrollable)}
      >
        <code data-slot="code-block-code" {...stylex.props(styles.code)}>
          {code}
        </code>
      </pre>
      <VisuallyHidden role="status" aria-live="polite">
        {getCopyAnnouncement(copyStatus)}
      </VisuallyHidden>
    </div>
  )
}

function getCopyLabel(status: CopyState['status']) {
  switch (status) {
    case 'idle':
      return 'Copy'
    case 'copying':
      return 'Copying…'
    case 'copied':
      return 'Copied'
    case 'failed':
      return 'Try copy again'
  }
}

function getCopyAnnouncement(status: CopyState['status']): ReactNode {
  switch (status) {
    case 'idle':
      return null
    case 'copying':
      return 'Copying code.'
    case 'copied':
      return 'Code copied to the clipboard.'
    case 'failed':
      return 'Code could not be copied.'
  }
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surfaceMuted,
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
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    display: 'flex',
    gap: space.x3,
    justifyContent: 'space-between',
    minBlockSize: '2.75rem',
    paddingBlock: space.x1,
    paddingInline: space.x3,
  },
  metadata: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    minInlineSize: 0,
  },
  filename: {
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    overflowWrap: 'anywhere',
  },
  language: {
    color: colors.textMuted,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  pre: {
    boxSizing: 'border-box',
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    lineHeight: '1.6',
    margin: 0,
    maxInlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '-3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    padding: space.x4,
  },
  code: {
    fontFamily: 'inherit',
  },
  scrollable: {
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  wrapped: {
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
})
