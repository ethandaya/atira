import type {
  FileChangeFile,
  FileChangeHunk,
  FileChangeLine,
  FileChangeStatus,
} from '@pretty-amped/foundations/chat'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Disclosure, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useId, type ComponentPropsWithRef } from 'react'

export type DiffFileStatus = FileChangeStatus
export type DiffLineKind = FileChangeLine['kind']
export type DiffLine = FileChangeLine
export type DiffHunk = FileChangeHunk
export type DiffFile = FileChangeFile &
  Readonly<{
    defaultOpen?: boolean
  }>

type NativeSectionProps = Omit<
  ComponentPropsWithRef<'section'>,
  'children' | 'className' | 'id' | 'style' | 'title'
>

export type DiffProps = NativeSectionProps & {
  files: readonly DiffFile[]
  headingLevel?: 2 | 3 | 4 | 5 | 6
  id: string
  title?: string
  variant?: 'default' | 'plain'
}

const fileStatusLabels: Record<DiffFileStatus, string> = {
  added: 'Added',
  modified: 'Modified',
  moved: 'Moved',
  removed: 'Removed',
}

const lineKindLabels: Record<DiffLineKind, string> = {
  addition: 'Addition',
  context: 'Context',
  deletion: 'Deletion',
}

export function Diff({
  files,
  headingLevel = 2,
  id,
  title = 'Changes',
  variant = 'default',
  ...props
}: DiffProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      {...props}
      id={id}
      aria-labelledby={titleId}
      data-diff-id={id}
      data-slot="diff"
      data-state={files.length === 0 ? 'empty' : 'populated'}
      data-variant={variant}
      {...stylex.props(styles.root, variant === 'plain' && styles.rootPlain)}
    >
      <Heading
        id={titleId}
        data-slot="diff-title"
        {...stylex.props(
          styles.title,
          variant === 'plain' && styles.titlePlain,
        )}
      >
        {title}
      </Heading>
      {files.length === 0 ? (
        <p data-slot="diff-empty" {...stylex.props(styles.empty)}>
          No changes provided.
        </p>
      ) : (
        <ul data-slot="diff-files" {...stylex.props(styles.files)}>
          {files.map((file) => (
            <li
              key={file.id}
              data-diff-file-id={file.id}
              data-file-status={file.status}
              data-slot="diff-file"
              {...stylex.props(styles.file)}
            >
              <Disclosure
                defaultOpen={file.defaultOpen ?? true}
                summary={<FileSummary file={file} />}
              >
                <div
                  role="region"
                  aria-label={`${file.path} changed lines`}
                  tabIndex={0}
                  data-slot="diff-file-content"
                  {...stylex.props(styles.fileContent)}
                >
                  {file.hunks.length === 0 ? (
                    <p
                      data-slot="diff-file-empty"
                      {...stylex.props(styles.fileEmpty)}
                    >
                      No line changes provided.
                    </p>
                  ) : (
                    file.hunks.map((hunk) => <Hunk key={hunk.id} hunk={hunk} />)
                  )}
                </div>
              </Disclosure>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FileSummary({ file }: { file: DiffFile }) {
  return (
    <span data-slot="diff-file-summary" {...stylex.props(styles.fileSummary)}>
      <span data-slot="diff-file-path" {...stylex.props(styles.filePath)}>
        {file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}
      </span>
      <span {...stylex.props(styles.fileMetadata)}>
        <span data-slot="diff-file-status">
          {fileStatusLabels[file.status]}
        </span>
        {file.additions !== undefined && (
          <span data-slot="diff-file-additions">+{file.additions}</span>
        )}
        {file.deletions !== undefined && (
          <span
            data-slot="diff-file-deletions"
            {...stylex.props(styles.deletions)}
          >
            −{file.deletions}
          </span>
        )}
      </span>
    </span>
  )
}

function Hunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <div
      role="group"
      aria-label={`Diff hunk ${hunk.header}`}
      data-diff-hunk-id={hunk.id}
      data-slot="diff-hunk"
    >
      <p data-slot="diff-hunk-header" {...stylex.props(styles.hunkHeader)}>
        {hunk.header}
      </p>
      <ol
        aria-label="Changed lines"
        data-slot="diff-lines"
        {...stylex.props(styles.lines)}
      >
        {hunk.lines.map((line) => (
          <li
            key={line.id}
            data-diff-line-id={line.id}
            data-line-kind={line.kind}
            data-new-line={line.newLine}
            data-old-line={line.oldLine}
            data-slot="diff-line"
            {...stylex.props(
              styles.line,
              line.kind === 'addition' && styles.addition,
              line.kind === 'deletion' && styles.deletion,
            )}
          >
            <span aria-hidden="true" {...stylex.props(styles.lineNumber)}>
              {line.oldLine ?? ''}
            </span>
            <span aria-hidden="true" {...stylex.props(styles.lineNumber)}>
              {line.newLine ?? ''}
            </span>
            <code data-slot="diff-line-code" {...stylex.props(styles.lineCode)}>
              <VisuallyHidden>{getLineLabel(line)}</VisuallyHidden>
              <span
                aria-hidden="true"
                data-prefix={getLinePrefix(line.kind)}
                {...stylex.props(styles.prefix)}
              />
              {line.content || ' '}
            </code>
          </li>
        ))}
      </ol>
    </div>
  )
}

function getLineLabel(line: DiffLine) {
  const numbers = [
    line.oldLine === undefined ? null : `old line ${line.oldLine}`,
    line.newLine === undefined ? null : `new line ${line.newLine}`,
  ].filter(Boolean)

  return `${lineKindLabels[line.kind]}${numbers.length > 0 ? `, ${numbers.join(', ')}` : ''}: `
}

function getLinePrefix(kind: DiffLineKind) {
  if (kind === 'addition') return '+ '
  if (kind === 'deletion') return '− '
  return '  '
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
  rootPlain: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
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
  titlePlain: {
    fontSize: type.sizeSmall,
    paddingInline: 0,
  },
  files: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  file: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    ':last-child': {
      borderBlockEndWidth: 0,
    },
  },
  fileSummary: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x3,
    inlineSize: '100%',
    justifyContent: 'space-between',
    minInlineSize: 0,
  },
  filePath: {
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  fileMetadata: {
    color: colors.textMuted,
    display: 'flex',
    flexShrink: 0,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    gap: space.x2,
  },
  deletions: {
    color: colors.danger,
  },
  fileContent: {
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '-3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    overflowX: 'auto',
  },
  fileEmpty: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    margin: 0,
    padding: space.x3,
  },
  hunkHeader: {
    backgroundColor: colors.surfaceMuted,
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    color: colors.textMuted,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    margin: 0,
    minInlineSize: '100%',
    paddingBlock: space.x2,
    paddingInline: space.x3,
    width: 'max-content',
  },
  lines: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  line: {
    display: 'grid',
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    gridTemplateColumns: '3rem 3rem minmax(max-content, 1fr)',
    inlineSize: 'max-content',
    lineHeight: '1.65',
    minInlineSize: '100%',
  },
  addition: {
    backgroundColor: colors.surfaceMuted,
  },
  deletion: {
    backgroundColor: colors.dangerSurface,
  },
  lineNumber: {
    borderInlineEndColor: colors.border,
    borderInlineEndStyle: 'solid',
    borderInlineEndWidth: '1px',
    color: colors.textMuted,
    fontVariantNumeric: 'tabular-nums',
    paddingInline: space.x2,
    textAlign: 'end',
    userSelect: 'none',
  },
  lineCode: {
    color: colors.text,
    fontFamily: 'inherit',
    paddingInline: space.x3,
    whiteSpace: 'pre',
  },
  prefix: {
    '::before': {
      content: 'attr(data-prefix)',
    },
    userSelect: 'none',
  },
  empty: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    margin: 0,
    padding: space.x4,
  },
})
