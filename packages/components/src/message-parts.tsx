import type {
  ChatMessage,
  MessagePart,
  ToolPart,
} from '@pretty-amped/foundations/chat'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Shimmer } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'

import {
  ContextTool,
  ContextToolGroup,
  FileChangeTool,
  GenericTool,
  ShellTool,
  SkillTool,
  TaskTool,
  WebTool,
} from './chat-tools'
import { Markdown } from './markdown'
import { Reasoning } from './reasoning'

export type ToolRenderer = Readonly<{
  id: string
  render: (part: ToolPart, actions: ToolActions) => ReactNode
  supports: (part: ToolPart) => boolean
}>

export type ToolActions = Readonly<{
  onOpenChild?: (sessionId: string) => void
}>

export type MessagePartsProps = {
  message: ChatMessage
  suppressTodoTools?: boolean
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
}

export function MessageParts({
  message,
  suppressTodoTools = true,
  toolActions = {},
  toolRenderers = [],
}: MessagePartsProps) {
  const renderers = [...toolRenderers, ...defaultToolRenderers]
  const content: ReactNode[] = []

  for (let index = 0; index < message.parts.length; index += 1) {
    const part = message.parts[index]
    if (!part) continue

    if (isActivityPart(part)) {
      const activityParts: MessagePart[] = [part]
      while (index + 1 < message.parts.length) {
        const next = message.parts[index + 1]
        if (!next || !isActivityPart(next)) break
        activityParts.push(next)
        index += 1
      }

      const visibleParts = suppressTodoTools
        ? activityParts.filter(
            (item) => item.type !== 'tool' || item.presentation.kind !== 'todo',
          )
        : activityParts
      if (visibleParts.length > 0) {
        content.push(
          <ActivitySequence
            key={part.id}
            parts={visibleParts}
            renderers={renderers}
            toolActions={toolActions}
          />,
        )
      }
      continue
    }

    content.push(
      <Part
        key={part.id}
        part={part}
        toolActions={toolActions}
        renderers={renderers}
      />,
    )
  }

  return (
    <div
      data-message-id={message.id}
      data-slot="message-parts"
      data-state={message.delivery.status}
      {...stylex.props(styles.root)}
    >
      {content}
    </div>
  )
}

function ActivitySequence({
  parts,
  renderers,
  toolActions,
}: {
  parts: readonly MessagePart[]
  renderers: readonly ToolRenderer[]
  toolActions: ToolActions
}) {
  const content: ReactNode[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (!part) continue

    if (part.type === 'tool') {
      const tools: ToolPart[] = [part]
      while (index + 1 < parts.length) {
        const next = parts[index + 1]
        if (next?.type !== 'tool') break
        tools.push(next)
        index += 1
      }
      content.push(
        <ToolSequence
          key={part.id}
          parts={tools}
          renderers={renderers}
          toolActions={toolActions}
        />,
      )
      continue
    }

    content.push(
      <Part
        key={part.id}
        part={part}
        toolActions={toolActions}
        renderers={renderers}
      />,
    )
  }

  const active = parts.some(isActiveActivityPart)

  return (
    <div
      data-slot="activity-sequence"
      data-state={active ? 'active' : 'complete'}
      {...stylex.props(styles.activitySequence, active && styles.activitySequenceActive)}
    >
      {content}
    </div>
  )
}

function ToolSequence({
  parts,
  renderers,
  toolActions,
}: {
  parts: readonly ToolPart[]
  renderers: readonly ToolRenderer[]
  toolActions: ToolActions
}) {
  const content: ReactNode[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (!part) continue

    if (part.presentation.kind === 'context') {
      const contextParts: ToolPart[] = [part]
      while (index + 1 < parts.length) {
        const next = parts[index + 1]
        if (next?.presentation.kind !== 'context') break
        contextParts.push(next)
        index += 1
      }
      content.push(
        <div
          data-renderer="context"
          data-slot="tool-renderer"
          data-tool-kind="context"
          key={part.id}
        >
          {contextParts.length === 1 ? (
            <ContextTool part={part} />
          ) : (
            <ContextToolGroup parts={contextParts} />
          )}
        </div>,
      )
      continue
    }

    content.push(
      <Part
        key={part.id}
        part={part}
        toolActions={toolActions}
        renderers={renderers}
      />,
    )
  }

  return (
    <div data-slot="tool-sequence" {...stylex.props(styles.toolSequence)}>
      {content}
    </div>
  )
}

function Part({
  part,
  renderers,
  toolActions,
}: {
  part: MessagePart
  renderers: readonly ToolRenderer[]
  toolActions: ToolActions
}) {
  switch (part.type) {
    case 'text':
      return (
        <Markdown status={part.state.status === 'streaming' ? 'streaming' : 'complete'}>
          {part.markdown}
        </Markdown>
      )
    case 'reasoning':
      return (
        <Reasoning
          state={
            part.state.status === 'streaming'
              ? { status: 'thinking' }
              : {
                  ...(part.startedAt !== undefined && part.endedAt !== undefined
                    ? { duration: formatDuration(part.endedAt - part.startedAt) }
                    : {}),
                  status: 'complete',
                }
          }
        >
          {part.text}
        </Reasoning>
      )
    case 'tool': {
      const renderer = renderers.find((candidate) => candidate.supports(part))
      return (
        <div
          data-renderer={renderer?.id ?? 'generic'}
          data-slot="tool-renderer"
          data-tool-kind={part.presentation.kind}
        >
          {(renderer ?? genericRenderer).render(part, toolActions)}
        </div>
      )
    }
    case 'attachment':
      return (
        <div
          data-attachment-id={part.attachment.id}
          data-slot="message-attachment"
          data-state={part.state.status}
          {...stylex.props(styles.attachment)}
        >
          {part.attachment.previewUrl && part.attachment.kind === 'image' && (
            <img
              alt=""
              src={part.attachment.previewUrl}
              {...stylex.props(styles.preview)}
            />
          )}
          <span dir="auto" {...stylex.props(styles.attachmentName)}>
            {part.attachment.name}
          </span>
          <span {...stylex.props(styles.partStatus)}>{part.state.status}</span>
        </div>
      )
    case 'compaction':
      return (
        <p data-slot="compaction-notice" {...stylex.props(styles.notice)}>
          {part.summary ?? 'Earlier context was compacted.'}
        </p>
      )
    case 'retry':
      return (
        <p
          role="status"
          data-slot="retry-notice"
          data-state="retrying"
          {...stylex.props(styles.retry)}
        >
          <Shimmer>Retrying · attempt {part.attempt}</Shimmer>
          <span>{part.error.message}</span>
        </p>
      )
    case 'notice':
      return (
        <p
          data-slot="message-notice"
          data-tone={part.tone}
          {...stylex.props(
            styles.notice,
            part.tone === 'warning' && styles.warning,
            part.tone === 'danger' && styles.danger,
          )}
        >
          {part.message}
        </p>
      )
    case 'unknown':
      return (
        <details data-slot="unknown-part" {...stylex.props(styles.unknown)}>
          <summary {...stylex.props(styles.unknownSummary)}>
            Unsupported part · {part.partType}
          </summary>
          {part.data !== undefined && (
            <pre dir="ltr" {...stylex.props(styles.unknownData)}>
              {formatJson(part.data)}
            </pre>
          )}
        </details>
      )
  }
}

const defaultToolRenderers: readonly ToolRenderer[] = [
  renderer('shell', (part) => part.presentation.kind === 'shell', ShellTool),
  renderer(
    'file-change',
    (part) => part.presentation.kind === 'file-change',
    FileChangeTool,
  ),
  {
    id: 'task',
    render: (part, actions) => (
      <TaskTool
        part={part}
        {...(actions.onOpenChild === undefined
          ? {}
          : { onOpenChild: actions.onOpenChild })}
      />
    ),
    supports: (part) => part.presentation.kind === 'task',
  },
  renderer('web', (part) => part.presentation.kind === 'web', WebTool),
  renderer('skill', (part) => part.presentation.kind === 'skill', SkillTool),
  renderer('generic', () => true, GenericTool),
]

const genericRenderer = defaultToolRenderers[defaultToolRenderers.length - 1]!

function renderer(
  id: string,
  supports: ToolRenderer['supports'],
  Component: (props: { part: ToolPart }) => ReactNode,
): ToolRenderer {
  return {
    id,
    render: (part) => <Component part={part} />,
    supports,
  }
}

function formatJson(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function formatDuration(durationMs: number) {
  const seconds = durationMs / 1_000
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
}

function isActivityPart(part: MessagePart) {
  return part.type === 'reasoning' || part.type === 'tool'
}

function isActiveActivityPart(part: MessagePart) {
  if (part.type === 'reasoning') return part.state.status === 'streaming'
  if (part.type !== 'tool') return false
  return (
    part.state.status === 'receiving-input' ||
    part.state.status === 'queued' ||
    part.state.status === 'running'
  )
}

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
    minInlineSize: 0,
  },
  activitySequence: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.inset,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    inlineSize: '100%',
    padding: space.x1,
  },
  activitySequenceActive: {
    backgroundColor: colors.surfaceMuted,
  },
  toolSequence: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  attachment: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    gap: space.x2,
    maxInlineSize: '24rem',
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  preview: {
    blockSize: '2rem',
    borderRadius: '0.25rem',
    inlineSize: '2rem',
    objectFit: 'cover',
  },
  attachmentName: {
    color: colors.text,
    flex: 1,
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    minInlineSize: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  partStatus: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    textTransform: 'capitalize',
  },
  notice: {
    borderInlineStartColor: colors.borderStrong,
    borderInlineStartStyle: 'solid',
    borderInlineStartWidth: '2px',
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingInlineStart: space.x3,
  },
  warning: {
    borderInlineStartColor: colors.warning,
    color: colors.warning,
  },
  danger: {
    borderInlineStartColor: colors.danger,
    color: colors.danger,
  },
  retry: {
    color: colors.textMuted,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x1,
    lineHeight: type.lineBody,
    margin: 0,
  },
  unknown: {
    borderBlockColor: colors.border,
    borderBlockStyle: 'solid',
    borderBlockWidth: '1px',
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    paddingBlock: space.x2,
  },
  unknownSummary: {
    cursor: 'pointer',
    minBlockSize: '2rem',
  },
  unknownData: {
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    margin: 0,
    maxBlockSize: '18rem',
    overflow: 'auto',
    paddingBlock: space.x2,
    whiteSpace: 'pre-wrap',
  },
})
