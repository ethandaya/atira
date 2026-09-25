import type {
  ChatMessage,
  MessagePart,
  ToolPart,
} from '@pretty-amped/foundations/chat'
import {
  chatAppearance,
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  ActivityPresence,
  ActivitySlot,
  AnimatePresence,
  Disclosure,
  Shimmer,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { type ReactElement, type ReactNode } from 'react'

import {
  ContextTool,
  ContextToolGroup,
  FileChangeTool,
  GenericTool,
  ImageGenerationTool,
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
  activityPresentation?: 'expanded' | 'summary'
  message: ChatMessage
  suppressTodoTools?: boolean
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
}

/** One ordered presence owner for the whole turn, including its next activity.
 * Provider message boundaries must not create separate animation timelines. */
export function AssistantSequence({
  messages,
  pending,
  activityPresentation = 'expanded',
  toolActions = {},
  toolRenderers = [],
}: {
  messages: readonly ChatMessage[]
  pending?: ReactNode
  activityPresentation?: 'expanded' | 'summary'
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
}) {
  const renderers = [...toolRenderers, ...defaultToolRenderers]
  const rows: { key: string; message: ChatMessage; parts: MessagePart[] }[] = []
  for (const message of messages) {
    const visible = message.parts.filter((part) =>
      part.type === 'text'
        ? part.markdown.trim().length > 0
        : part.type !== 'tool' || part.presentation.kind !== 'todo',
    )
    for (let index = 0; index < visible.length; index++) {
      const part = visible[index]!
      const parts = [part]
      // Keep existing context receipts and opt-in summary disclosures intact.
      while (index + 1 < visible.length) {
        const next = visible[index + 1]!
        const grouped =
          activityPresentation === 'summary'
            ? isActivityPart(part) && isActivityPart(next)
            : part.type === 'tool' &&
              next.type === 'tool' &&
              isDefaultContextPart(part, renderers) &&
              isDefaultContextPart(next, renderers)
        if (!grouped) break
        parts.push(next)
        index++
      }
      rows.push({ key: `${message.id}:${part.id}`, message, parts })
    }
  }
  return (
    <div
      data-slot="assistant-sequence"
      {...stylex.props(styles.assistantSequence)}
    >
      {Array.from({ length: rows.length + (pending ? 1 : 0) }, (_, index) => {
        const row = rows[index]
        // These append-only positions persist when pending becomes an activity.
        // Keep the outer slot out of AnimatePresence: it must never fade away.
        if (!row)
          return (
            <ActivitySlot
              key={index}
              state="pending"
              data-handoff-slot={index}
              data-slot="activity-pending"
              {...stylex.props(styles.assistantRow)}
            >
              {pending}
            </ActivitySlot>
          )
        const part = row.parts[0]!
        const activity = isActivityPart(part)
        // Static attachments and notices are not activity handoffs.
        if (!activity && part.type !== 'text')
          return (
            <Part
              key={index}
              part={part}
              renderers={renderers}
              toolActions={toolActions}
            />
          )
        const context =
          part.type === 'tool' && part.presentation.kind === 'context'
        return (
          <ActivitySlot
            key={index}
            state={row.key}
            data-handoff-slot={index}
            data-slot="turn-assistant-message"
            data-message-id={row.message.id}
            data-state={row.message.delivery.status}
            {...stylex.props(styles.assistantRow)}
          >
            {activity ? (
              <div
                data-slot="activity-sequence"
                data-state={
                  row.parts.some(isActiveActivityPart) ? 'active' : 'complete'
                }
                {...stylex.props(styles.activitySequence)}
              >
                {activityPresentation === 'summary' ? (
                  <ActivitySummary
                    parts={row.parts}
                    renderers={renderers}
                    toolActions={toolActions}
                  />
                ) : context &&
                  part.type === 'tool' &&
                  isDefaultContextPart(part, renderers) ? (
                  <DefaultContextParts
                    parts={collectDefaultContextParts(row.parts, renderers)}
                  />
                ) : (
                  <Part
                    part={part}
                    renderers={renderers}
                    toolActions={toolActions}
                  />
                )}
              </div>
            ) : (
              <Part
                part={part}
                renderers={renderers}
                toolActions={toolActions}
              />
            )}
          </ActivitySlot>
        )
      })}
    </div>
  )
}

export function MessageParts({
  activityPresentation = 'expanded',
  message,
  suppressTodoTools = true,
  toolActions = {},
  toolRenderers = [],
}: MessagePartsProps) {
  const renderers = [...toolRenderers, ...defaultToolRenderers]
  const content: ReactElement[] = []

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
            presentation={activityPresentation}
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
  presentation,
  parts,
  renderers,
  toolActions,
}: {
  presentation: 'expanded' | 'summary'
  parts: readonly MessagePart[]
  renderers: readonly ToolRenderer[]
  toolActions: ToolActions
}) {
  if (presentation === 'summary') {
    return (
      <ActivitySummary
        parts={parts}
        renderers={renderers}
        toolActions={toolActions}
      />
    )
  }
  const content: ReactElement[] = []

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
      {...stylex.props(styles.activitySequence)}
    >
      <AnimatePresence initial={false}>
        {content.map((item) => (
          <ActivityPresence key={item.key} layoutDependency={content.length}>
            {item}
          </ActivityPresence>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ActivitySummary({
  parts,
  renderers,
  toolActions,
}: {
  parts: readonly MessagePart[]
  renderers: readonly ToolRenderer[]
  toolActions: ToolActions
}) {
  const completed = parts.filter((part) =>
    part.type === 'tool'
      ? part.state.status === 'succeeded'
      : part.type === 'reasoning' && part.state.status !== 'streaming',
  )
  const attention = parts.filter((part) => !completed.includes(part))
  const tools = completed.filter((part) => part.type === 'tool')
  const reasoning = completed.filter((part) => part.type === 'reasoning')
  return (
    <div data-slot="activity-summary" {...stylex.props(styles.summaryRoot)}>
      {attention.map((part) => (
        <div
          key={part.id}
          data-slot="activity-current"
          {...stylex.props(styles.current)}
        >
          <Part part={part} renderers={renderers} toolActions={toolActions} />
        </div>
      ))}
      {reasoning.map((part) => (
        <Part
          key={part.id}
          part={part}
          renderers={renderers}
          toolActions={toolActions}
        />
      ))}
      {tools.length > 0 && (
        <Disclosure
          variant="plain"
          summary={
            <span {...stylex.props(styles.receipt)}>
              {tools.length} {tools.length === 1 ? 'action' : 'actions'}{' '}
              completed
            </span>
          }
        >
          <div data-slot="activity-completed">
            <ToolSequence
              parts={tools}
              renderers={renderers}
              toolActions={toolActions}
            />
          </div>
        </Disclosure>
      )}
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
  const content: ReactElement[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (!part) continue

    if (isDefaultContextPart(part, renderers)) {
      const contextParts: ToolPart[] = [part]
      while (index + 1 < parts.length) {
        const next = parts[index + 1]
        if (!next || !isDefaultContextPart(next, renderers)) break
        contextParts.push(next)
        index += 1
      }
      content.push(<DefaultContextParts key={part.id} parts={contextParts} />)
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
      <AnimatePresence initial={false}>
        {content.map((item) => (
          <ActivityPresence key={item.key} layoutDependency={content.length}>
            {item}
          </ActivityPresence>
        ))}
      </AnimatePresence>
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
        <Markdown
          status={part.state.status === 'streaming' ? 'streaming' : 'complete'}
        >
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
                    ? {
                        duration: formatDuration(part.endedAt - part.startedAt),
                      }
                    : {}),
                  status: 'complete',
                }
          }
        >
          {part.text}
        </Reasoning>
      )
    case 'tool': {
      const renderer = selectedToolRenderer(part, renderers)
      return (
        <div
          data-renderer={renderer.id}
          data-slot="tool-renderer"
          data-tool-kind={part.presentation.kind}
          {...stylex.props(
            part.presentation.kind === 'image' && styles.imageOutput,
          )}
        >
          {renderer.render(part, toolActions)}
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

const contextRenderer: ToolRenderer = renderer(
  'context',
  (part) => part.presentation.kind === 'context',
  ContextTool,
)

const defaultToolRenderers: readonly ToolRenderer[] = [
  renderer(
    'image',
    (part) => part.presentation.kind === 'image',
    ImageGenerationTool,
  ),
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
  contextRenderer,
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

function selectedToolRenderer(
  part: ToolPart,
  renderers: readonly ToolRenderer[],
) {
  return (
    renderers.find((candidate) => candidate.supports(part)) ?? genericRenderer
  )
}

function isDefaultContextPart(
  part: ToolPart,
  renderers: readonly ToolRenderer[],
) {
  return selectedToolRenderer(part, renderers) === contextRenderer
}

function collectDefaultContextParts(
  parts: readonly MessagePart[],
  renderers: readonly ToolRenderer[],
) {
  return parts.filter(
    (part): part is ToolPart =>
      part.type === 'tool' && isDefaultContextPart(part, renderers),
  )
}

function DefaultContextParts({ parts }: { parts: readonly ToolPart[] }) {
  const first = parts[0]
  if (!first) return null
  return (
    <div
      data-slot="tool-renderer"
      data-renderer="context"
      data-tool-kind="context"
    >
      {parts.length === 1 ? (
        <ContextTool part={first} />
      ) : (
        <ContextToolGroup parts={parts} />
      )}
    </div>
  )
}

function formatJson(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function formatDuration(durationMs: number) {
  const seconds = durationMs / 1_000
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
}

function isActivityPart(part: MessagePart) {
  return (
    part.type === 'reasoning' ||
    (part.type === 'tool' && part.presentation.kind !== 'image')
  )
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
  assistantSequence: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    position: 'relative',
    minInlineSize: 0,
  },
  assistantRow: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    position: 'relative',
    minBlockSize: '2rem',
    minInlineSize: 0,
  },
  summaryRoot: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    minInlineSize: 0,
  },
  current: {
    borderInlineStart: `2px solid ${colors.accent}`,
    paddingInlineStart: space.x2,
  },
  receipt: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: 1.6,
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
    minInlineSize: 0,
  },
  activitySequence: {
    backgroundColor: stylex.firstThatWorks(
      chatAppearance.activitySurface,
      colors.surface,
    ),
    borderColor: stylex.firstThatWorks(
      chatAppearance.activityBorder,
      colors.border,
    ),
    borderRadius: radii.inset,
    borderStyle: 'solid',
    borderWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    inlineSize: '100%',
    padding: 0,
  },
  toolSequence: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  imageOutput: {
    marginBlockStart: space.x4,
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
