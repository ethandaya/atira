import type {
  JsonValue,
  ToolPart,
  ToolState,
} from '@pretty-amped/foundations/chat'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'

import { CodeBlock } from './code-block'
import { ToolActivity, type ToolActivityState } from './tool-activity'

export type ChatToolProps = {
  defaultOpen?: boolean
  outputCharacterLimit?: number
  part: ToolPart
}

export function ContextTool(props: ChatToolProps) {
  const { part } = props
  const operation =
    part.presentation.kind === 'context'
      ? part.presentation.operation
      : 'read'
  const target = firstString(toolInput(part.state), [
    'filePath',
    'path',
    'pattern',
    'query',
  ])

  return (
    <ToolShell
      {...props}
      summary={`${capitalize(operation)}${target ? ` ${target}` : ''}`}
    />
  )
}

export type ContextToolGroupProps = {
  parts: readonly ToolPart[]
}

export function ContextToolGroup({ parts }: ContextToolGroupProps) {
  const running = parts.some((part) => !isTerminal(part.state))

  return (
    <section
      aria-label={`${parts.length} context operations`}
      data-slot="context-tool-group"
      data-state={running ? 'running' : 'complete'}
      {...stylex.props(styles.group)}
    >
      <p {...stylex.props(styles.groupSummary)}>
        {running ? 'Loading context' : 'Context loaded'}
        <span {...stylex.props(styles.muted)}> · {parts.length} operations</span>
      </p>
      <div {...stylex.props(styles.groupItems)}>
        {parts.map((part) => (
          <ContextTool key={part.id} part={part} />
        ))}
      </div>
    </section>
  )
}

export function ShellTool({
  defaultOpen,
  outputCharacterLimit,
  part,
}: ChatToolProps) {
  const input = toolInput(part.state)
  const command =
    firstString(input, ['command', 'cmd']) ??
    (input === undefined ? '' : formatJson(input))
  const output = toolOutput(part.state)
  const workingDirectory = firstString(input, ['cwd', 'workdir', 'workingDirectory'])
  const exitCode = firstNumber(part.metadata, ['exitCode', 'exit'])
  const durationMs = firstNumber(part.metadata, ['durationMs', 'duration'])
  const truncated = firstBoolean(part.metadata, ['truncated'])

  return (
    <ToolActivity
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      id={part.id}
      state={activityState(part.state)}
      summary={command || 'Run shell command'}
      tool={part.toolName}
    >
      <div data-slot="shell-tool-evidence" {...stylex.props(styles.stack)}>
        {command && (
          <CodeBlock code={command} copyable label="Shell command" language="shell" />
        )}
        {output !== undefined && (
          <BoundedToolOutput
            label="Shell output"
            value={output}
            {...(outputCharacterLimit === undefined
              ? {}
              : { characterLimit: outputCharacterLimit })}
          />
        )}
        {(workingDirectory || exitCode !== undefined || durationMs !== undefined) && (
          <dl {...stylex.props(styles.evidence)}>
            {workingDirectory && (
              <EvidenceRow label="Directory" value={workingDirectory} />
            )}
            {exitCode !== undefined && (
              <EvidenceRow label="Exit" value={String(exitCode)} />
            )}
            {durationMs !== undefined && (
              <EvidenceRow label="Duration" value={formatDuration(durationMs)} />
            )}
          </dl>
        )}
        {truncated && (
          <p data-slot="tool-output-truncated" {...stylex.props(styles.notice)}>
            The runtime truncated this output.
          </p>
        )}
        <ToolTiming state={part.state} />
      </div>
    </ToolActivity>
  )
}

export function FileChangeTool(props: ChatToolProps) {
  const input = toolInput(props.part.state)
  const path = firstString(input, ['filePath', 'path', 'filename'])
  const operation =
    props.part.presentation.kind === 'file-change'
      ? props.part.presentation.operation
      : 'edit'

  return (
    <ToolShell
      {...props}
      summary={`${capitalize(operation)}${path ? ` ${path}` : ' file'}`}
    />
  )
}

export type TaskToolProps = ChatToolProps & {
  onOpenChild?: (sessionId: string) => void
}

export function TaskTool({
  defaultOpen,
  onOpenChild,
  outputCharacterLimit,
  part,
}: TaskToolProps) {
  const presentation =
    part.presentation.kind === 'task' ? part.presentation : undefined
  const input = toolInput(part.state)
  const description = firstString(input, ['description', 'prompt']) ?? 'Run task'
  const childSessionId = presentation?.childSessionId

  return (
    <ToolActivity
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      id={part.id}
      state={activityState(part.state)}
      summary={description}
      tool={presentation?.agent?.label ?? part.toolName}
    >
      <ToolEvidence
        part={part}
        {...(outputCharacterLimit === undefined
          ? {}
          : { outputCharacterLimit })}
      />
      {childSessionId && onOpenChild && (
        <div {...stylex.props(styles.actions)}>
          <Button
            onClick={() => onOpenChild(childSessionId)}
            size="compact"
            variant="outline"
          >
            Open child session
          </Button>
        </div>
      )}
      {childSessionId && !onOpenChild && (
        <p {...stylex.props(styles.notice)}>Child session unavailable.</p>
      )}
    </ToolActivity>
  )
}

export function WebTool(props: ChatToolProps) {
  const input = toolInput(props.part.state)
  const target = firstString(input, ['url', 'query'])
  const operation =
    props.part.presentation.kind === 'web'
      ? props.part.presentation.operation
      : 'fetch'

  return (
    <ToolShell
      {...props}
      summary={`${capitalize(operation)}${target ? ` ${target}` : ' web'}`}
      extra={
        target && safeHttpUrl(target) ? (
          <a
            href={target}
            rel="noreferrer"
            target="_blank"
            {...stylex.props(styles.link)}
          >
            Open source
          </a>
        ) : null
      }
    />
  )
}

export function SkillTool(props: ChatToolProps) {
  const input = toolInput(props.part.state)
  const name = firstString(input, ['name', 'skill'])
  return <ToolShell {...props} summary={name ? `Load ${name}` : 'Load skill'} />
}

export function GenericTool(props: ChatToolProps) {
  return <ToolShell {...props} summary={humanize(props.part.toolName)} />
}

type ToolShellProps = ChatToolProps & {
  extra?: ReactNode
  summary: string
}

function ToolShell({
  defaultOpen,
  extra,
  outputCharacterLimit,
  part,
  summary,
}: ToolShellProps) {
  return (
    <ToolActivity
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      id={part.id}
      state={activityState(part.state)}
      summary={summary}
      tool={part.toolName}
    >
      <ToolEvidence
        part={part}
        {...(outputCharacterLimit === undefined
          ? {}
          : { outputCharacterLimit })}
      />
      {extra}
    </ToolActivity>
  )
}

function ToolEvidence({
  outputCharacterLimit,
  part,
}: {
  outputCharacterLimit?: number
  part: ToolPart
}) {
  const { state } = part
  const input = toolInput(state)
  const output = toolOutput(state)

  return (
    <dl data-slot="tool-evidence" {...stylex.props(styles.evidence)}>
      {state.status === 'receiving-input' && state.rawInput && (
        <EvidenceRow label="Input" value={state.rawInput} />
      )}
      {input !== undefined && <BoundedEvidenceRow label="Input" value={input} />}
      {output !== undefined && (
        <BoundedEvidenceRow
          label="Result"
          value={output}
          {...(outputCharacterLimit !== undefined
            ? { characterLimit: outputCharacterLimit }
            : part.presentation.kind === 'context'
            ? { characterLimit: 20_000 }
            : {})}
        />
      )}
      {part.metadata && Object.keys(part.metadata).length > 0 && (
        <BoundedEvidenceRow label="Metadata" value={part.metadata} />
      )}
      {state.status === 'failed' && (
        <EvidenceRow label="Error" value={state.error.message} danger />
      )}
      <ToolTiming state={state} />
    </dl>
  )
}

function BoundedEvidenceRow({
  characterLimit,
  label,
  value,
}: {
  characterLimit?: number
  label: string
  value: JsonValue
}) {
  const [revealed, setRevealed] = useState(false)
  const formatted = stripAnsi(formatJson(value))
  const limit = characterLimit ?? 12_000
  const truncated = formatted.length > limit
  const visible = truncated && !revealed ? `${formatted.slice(0, limit)}\n…` : formatted

  return (
    <div {...stylex.props(styles.evidenceRow)}>
      <dt {...stylex.props(styles.term)}>{label}</dt>
      <dd {...stylex.props(styles.boundedValue)}>
        <span dir="ltr" {...stylex.props(styles.value)}>
          {visible}
        </span>
        {truncated && (
          <Button
            aria-expanded={revealed}
            onClick={() => setRevealed((current) => !current)}
            size="compact"
            variant="quiet"
          >
            {revealed ? 'Show less' : `Show full ${label.toLowerCase()}`}
          </Button>
        )}
      </dd>
    </div>
  )
}

function BoundedToolOutput({
  characterLimit,
  label,
  value,
}: {
  characterLimit?: number
  label: string
  value: JsonValue
}) {
  const [revealed, setRevealed] = useState(false)
  const formatted = stripAnsi(formatJson(value))
  const limit = characterLimit ?? 12_000
  const truncated = formatted.length > limit
  const visible = truncated && !revealed ? `${formatted.slice(0, limit)}\n…` : formatted

  return (
    <div {...stylex.props(styles.stack)}>
      <CodeBlock code={visible} copyable label={label} wrap />
      {truncated && (
        <div {...stylex.props(styles.actions)}>
          <Button
            aria-expanded={revealed}
            onClick={() => setRevealed((current) => !current)}
            size="compact"
            variant="quiet"
          >
            {revealed ? 'Show less' : 'Show full output'}
          </Button>
        </div>
      )}
    </div>
  )
}

function EvidenceRow({
  danger = false,
  label,
  value,
}: {
  danger?: boolean
  label: string
  value: string
}) {
  return (
    <div {...stylex.props(styles.evidenceRow)}>
      <dt {...stylex.props(styles.term)}>{label}</dt>
      <dd
        dir="ltr"
        {...stylex.props(styles.value, danger && styles.danger)}
      >
        {value}
      </dd>
    </div>
  )
}

function ToolTiming({ state }: { state: ToolState }) {
  if (state.status === 'running') {
    return <EvidenceRow label="Started" value={formatTime(state.startedAt)} />
  }
  if (
    state.status === 'succeeded' ||
    state.status === 'failed' ||
    state.status === 'cancelled'
  ) {
    return <EvidenceRow label="Finished" value={formatTime(state.endedAt)} />
  }
  return null
}

function activityState(state: ToolState): ToolActivityState {
  switch (state.status) {
    case 'receiving-input':
      return { status: 'receiving-input' }
    case 'queued':
      return { status: 'queued' }
    case 'running':
      return {
        ...(state.progress === undefined ? {} : { progress: state.progress }),
        status: 'running',
      }
    case 'awaiting-permission':
      return { status: 'awaiting-permission' }
    case 'succeeded':
      return { status: 'succeeded' }
    case 'failed':
      return { error: state.error.message, status: 'failed' }
    case 'cancelled':
      return { status: 'cancelled' }
  }
}

function toolInput(state: ToolState): JsonValue | undefined {
  if (state.status === 'receiving-input') return state.partialInput
  return state.input
}

function toolOutput(state: ToolState): JsonValue | undefined {
  return state.status === 'succeeded' ? state.output : undefined
}

function firstString(
  value: JsonValue | undefined,
  keys: readonly string[],
): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined
  const record = value as Readonly<Record<string, JsonValue>>

  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate) return candidate
  }
  return undefined
}

function firstNumber(
  value: Readonly<Record<string, JsonValue>> | undefined,
  keys: readonly string[],
) {
  if (!value) return undefined
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
  }
  return undefined
}

function firstBoolean(
  value: Readonly<Record<string, JsonValue>> | undefined,
  keys: readonly string[],
) {
  if (!value) return undefined
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'boolean') return candidate
  }
  return undefined
}

function formatJson(value: JsonValue) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
}

function formatDuration(value: number) {
  if (value < 1_000) return `${Math.round(value)} ms`
  return `${(value / 1_000).toFixed(1)} s`
}

function stripAnsi(value: string) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
}

function isTerminal(state: ToolState) {
  return (
    state.status === 'succeeded' ||
    state.status === 'failed' ||
    state.status === 'cancelled'
  )
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function humanize(value: string) {
  const words = value.replace(/[._-]+/g, ' ').trim()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Tool call'
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

const styles = stylex.create({
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  groupSummary: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    margin: 0,
    minBlockSize: '2rem',
  },
  groupItems: {
    borderInlineStartColor: colors.border,
    borderInlineStartStyle: 'solid',
    borderInlineStartWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    paddingInlineStart: space.x3,
  },
  muted: {
    color: colors.textMuted,
    fontWeight: type.weightRegular,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
  },
  evidence: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    margin: 0,
  },
  evidenceRow: {
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: '4rem minmax(0, 1fr)',
  },
  term: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    margin: 0,
  },
  value: {
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    margin: 0,
    maxBlockSize: '18rem',
    overflow: 'auto',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
  boundedValue: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    margin: 0,
    minInlineSize: 0,
  },
  danger: {
    color: colors.danger,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingBlockStart: space.x3,
  },
  notice: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    margin: 0,
  },
  link: {
    borderRadius: radii.control,
    color: colors.text,
    display: 'inline-flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    marginBlockStart: space.x3,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '2px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    textDecorationLine: 'underline',
    textUnderlineOffset: '0.15em',
  },
})
