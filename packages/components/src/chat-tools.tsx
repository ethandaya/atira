import type {
  JsonValue,
  TaskTranscript,
  ToolPart,
  ToolState,
} from '@pretty-amped/foundations/chat'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  ActivityPresence,
  AnimatePresence,
  Button,
  Disclosure,
  PresenceSurface,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CodeBlock } from './code-block'
import { Diff, type DiffFile } from './diff'
import { Markdown } from './markdown'
import { GeneratedImage } from './generated-image'
import { ToolActivity, type ToolActivityState } from './tool-activity'

export type ChatToolProps = {
  defaultOpen?: boolean
  outputCharacterLimit?: number
  part: ToolPart
}

export function ImageGenerationTool({ part }: { part: ToolPart }) {
  const image =
    part.presentation.kind === 'image' ? part.presentation.image : undefined
  const state =
    part.state.status === 'succeeded'
      ? image
        ? { status: 'ready' as const, image }
        : {
            status: 'failed' as const,
            error: 'The generated image is unavailable.',
          }
      : part.state.status === 'failed'
        ? { status: 'failed' as const, error: part.state.error.message }
        : part.state.status === 'cancelled'
          ? { status: 'failed' as const, error: 'Image generation stopped.' }
          : { status: 'generating' as const }
  return <GeneratedImage state={state} />
}

export function ContextTool(props: ChatToolProps) {
  const { part } = props
  const presentation =
    part.presentation.kind === 'context' ? part.presentation : undefined
  const operation = presentation?.operation ?? 'read'
  const target = presentation?.target

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
      <Disclosure
        defaultOpen={running}
        summary={
          <span {...stylex.props(styles.groupSummary)}>
            <span aria-hidden="true" {...stylex.props(styles.groupMark)}>
              {!running && <Check size={14} strokeWidth={1.75} />}
            </span>
            <span {...stylex.props(styles.groupLabel)}>
              {running ? 'Loading context' : 'Context loaded'}
              <span {...stylex.props(styles.muted)}>
                {parts.length} operation{parts.length === 1 ? '' : 's'}
              </span>
            </span>
          </span>
        }
        variant="plain"
      >
        <div {...stylex.props(styles.groupItems)}>
          {parts.map((part) => (
            <ContextTool key={part.id} part={part} />
          ))}
        </div>
      </Disclosure>
    </section>
  )
}

export function ShellTool({
  defaultOpen,
  outputCharacterLimit,
  part,
}: ChatToolProps) {
  const presentation =
    part.presentation.kind === 'shell' ? part.presentation : undefined
  const command = presentation?.command
  const output = toolOutput(part.state)
  const workingDirectory = presentation?.workingDirectory
  const exitCode = presentation?.exitCode
  const durationMs = presentation?.durationMs
  const truncated = presentation?.outputTruncated

  return (
    <ToolActivity
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      id={part.id}
      state={activityState(part.state)}
      summary={command ?? 'Run shell command'}
      tool={part.toolName}
    >
      <ShellEvidence
        command={command}
        durationMs={durationMs}
        exitCode={exitCode}
        output={output}
        outputCharacterLimit={outputCharacterLimit}
        part={part}
        truncated={truncated}
        workingDirectory={workingDirectory}
      />
    </ToolActivity>
  )
}

function ShellEvidence({
  command,
  durationMs,
  exitCode,
  output,
  outputCharacterLimit,
  part,
  truncated,
  workingDirectory,
}: {
  command: string | undefined
  durationMs: number | undefined
  exitCode: number | undefined
  output: JsonValue | undefined
  outputCharacterLimit: number | undefined
  part: ToolPart
  truncated: boolean | undefined
  workingDirectory: string | undefined
}) {
  const input = toolInput(part.state)
  const hasMetadata =
    Boolean(workingDirectory) ||
    exitCode !== undefined ||
    durationMs !== undefined
  return (
    <div data-slot="shell-tool-evidence" {...stylex.props(styles.stack)}>
      {command ? (
        <CodeBlock
          code={command}
          copyable
          label="Shell command"
          language="shell"
        />
      ) : input !== undefined ? (
        <BoundedEvidenceRow label="Input" value={input} />
      ) : null}
      {output !== undefined && (
        <BoundedToolOutput
          label="Shell output"
          value={output}
          {...(outputCharacterLimit === undefined
            ? {}
            : { characterLimit: outputCharacterLimit })}
        />
      )}
      {hasMetadata && (
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
  )
}

export function FileChangeTool({
  defaultOpen,
  outputCharacterLimit,
  part,
}: ChatToolProps) {
  const presentation =
    part.presentation.kind === 'file-change' ? part.presentation : undefined
  const path = presentation?.path
  const operation = presentation?.operation ?? 'edit'
  const files: readonly DiffFile[] = (presentation?.files ?? []).map(
    (file) => ({
      ...file,
      defaultOpen:
        presentation?.files.length === 1 && file.status !== 'removed',
    }),
  )
  const diagnostics = presentation?.diagnostics ?? []
  const content = presentation?.content
  const output = toolOutput(part.state)
  const summary =
    files.length > 1
      ? `${files.length} files changed`
      : `${capitalize(operation)}${path ? ` ${path}` : ' file'}`

  return (
    <ToolActivity
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      id={part.id}
      state={activityState(part.state)}
      summary={summary}
      tool={part.toolName}
    >
      <FileChangeEvidence
        content={content}
        diagnostics={diagnostics}
        files={files}
        output={output}
        outputCharacterLimit={outputCharacterLimit}
        part={part}
        path={path}
      />
    </ToolActivity>
  )
}

function FileChangeEvidence({
  content,
  diagnostics,
  files,
  output,
  outputCharacterLimit,
  part,
  path,
}: {
  content: string | undefined
  diagnostics: readonly {
    id: string
    severity: string
    path: string
    line: number
    column: number
    message: string
  }[]
  files: readonly DiffFile[]
  output: JsonValue | undefined
  outputCharacterLimit: number | undefined
  part: ToolPart
  path: string | undefined
}) {
  const input = toolInput(part.state)
  const hasContent = Boolean(content && path)
  return (
    <div data-slot="file-change-evidence" {...stylex.props(styles.stack)}>
      {files.length > 0 && (
        <Diff
          files={files}
          headingLevel={4}
          id={`${part.id}:diff`}
          title={files.length === 1 ? 'File change' : 'File changes'}
          variant="plain"
        />
      )}
      {files.length === 0 && content && path && (
        <CodeBlock code={content} filename={path} label={`${path} contents`} />
      )}
      {files.length === 0 && !hasContent && input !== undefined && (
        <BoundedEvidenceRow label="Input" value={input} />
      )}
      {diagnostics.length > 0 && (
        <section
          aria-label="File diagnostics"
          data-slot="file-change-diagnostics"
          {...stylex.props(styles.diagnostics)}
        >
          <p {...stylex.props(styles.diagnosticsTitle)}>Diagnostics</p>
          <ul {...stylex.props(styles.diagnosticList)}>
            {diagnostics.map((diagnostic) => (
              <li
                data-severity={diagnostic.severity}
                data-slot="file-change-diagnostic"
                key={diagnostic.id}
                {...stylex.props(styles.diagnostic)}
              >
                <span dir="ltr" {...stylex.props(styles.diagnosticLocation)}>
                  {diagnostic.path}:{diagnostic.line}:{diagnostic.column}
                </span>
                <span>{diagnostic.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {files.length === 0 && !hasContent && output !== undefined && (
        <BoundedToolOutput
          label="File change result"
          value={output}
          {...(outputCharacterLimit === undefined
            ? {}
            : { characterLimit: outputCharacterLimit })}
        />
      )}
      <ToolTiming state={part.state} />
    </div>
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
  const description = presentation?.description ?? 'Run task'
  const childSessionId = presentation?.childSessionId
  const blockers = presentation?.blockers ?? []
  const agent = presentation?.agent
  const activity = presentation?.activity
  const transcript = presentation?.transcript
  const running = !isTerminal(part.state)
  const agentLabel = agent?.label ?? 'Subagent'
  const summary = `${
    running ? agentLabel.replace(/\s+agent$/i, '') : agentLabel
  } · ${running && activity ? activity.summary : description}`

  return (
    <div
      data-activity-detail={running ? activity?.detail : undefined}
      data-activity-summary={running ? activity?.summary : undefined}
      data-activity-tool={running ? activity?.tool : undefined}
      data-agent-id={agent?.id}
      data-child-session-id={childSessionId}
      data-slot="subagent-activity"
      data-state={part.state.status}
      {...stylex.props(styles.subagent)}
    >
      <ToolActivity
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        id={part.id}
        state={activityState(part.state)}
        summary={summary}
        summaryTransitionKey={`${part.state.status}:${running ? (activity?.summary ?? '') : ''}`}
        title={summary}
        tool={part.toolName}
      >
        <TaskEvidence
          blockers={blockers}
          childSessionId={childSessionId}
          description={description}
          onOpenChild={onOpenChild}
          outputCharacterLimit={outputCharacterLimit}
          part={part}
          transcript={transcript}
        />
      </ToolActivity>
    </div>
  )
}

function TaskEvidence({
  blockers,
  childSessionId,
  description,
  onOpenChild,
  outputCharacterLimit,
  part,
  transcript,
}: {
  blockers: readonly string[]
  childSessionId: string | undefined
  description: string
  onOpenChild: ((sessionId: string) => void) | undefined
  outputCharacterLimit: number | undefined
  part: ToolPart
  transcript: TaskTranscript | undefined
}) {
  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        <PresenceSurface
          key={transcript ? 'transcript' : 'output'}
          kind="overlay"
        >
          {transcript ? (
            <TaskTranscriptEvidence
              description={description}
              part={part}
              transcript={transcript}
            />
          ) : (
            <ToolEvidence
              part={part}
              {...(outputCharacterLimit === undefined
                ? {}
                : { outputCharacterLimit })}
            />
          )}
        </PresenceSurface>
      </AnimatePresence>
      {blockers.length > 0 && (
        <section
          aria-label="Task blockers"
          {...stylex.props(styles.diagnostics)}
        >
          <p {...stylex.props(styles.diagnosticsTitle)}>Blocked</p>
          <ul {...stylex.props(styles.diagnosticList)}>
            {blockers.map((blocker, index) => (
              <li key={`${part.id}:blocker:${index}`}>{blocker}</li>
            ))}
          </ul>
        </section>
      )}
      {childSessionId && onOpenChild && (
        <div {...stylex.props(styles.actions)}>
          <Button
            onClick={() => onOpenChild(childSessionId)}
            size="compact"
            variant="quiet"
          >
            Open child session
          </Button>
        </div>
      )}
      {childSessionId && !onOpenChild && !transcript && (
        <p {...stylex.props(styles.notice)}>
          {part.state.status === 'failed'
            ? 'The subagent stopped before a transcript was received.'
            : 'This runtime has not provided a child transcript.'}
        </p>
      )}
      {!childSessionId && !transcript && isTerminal(part.state) && (
        <p data-slot="task-child-unavailable" {...stylex.props(styles.notice)}>
          This runtime did not expose a child transcript.
        </p>
      )}
    </>
  )
}

function TaskTranscriptEvidence({
  description,
  part,
  transcript,
}: {
  description: string
  part: ToolPart
  transcript: TaskTranscript
}) {
  return (
    <div data-slot="task-transcript" {...stylex.props(styles.taskTranscript)}>
      <section aria-label="Subagent task" {...stylex.props(styles.taskSection)}>
        <p {...stylex.props(styles.taskLabel)}>Task</p>
        <p dir="auto" {...stylex.props(styles.taskCopy)}>
          {description}
        </p>
      </section>
      {transcript.reasoning && (
        <section
          aria-label="Subagent reasoning"
          {...stylex.props(styles.taskSection)}
        >
          <p {...stylex.props(styles.taskLabel)}>Reasoning</p>
          <Markdown status="complete">{transcript.reasoning}</Markdown>
        </section>
      )}
      {transcript.steps.length > 0 && (
        <section
          aria-label="Subagent activity"
          {...stylex.props(styles.taskSection)}
        >
          <p {...stylex.props(styles.taskLabel)}>Activity</p>
          <div {...stylex.props(styles.taskSteps)}>
            <AnimatePresence initial={false}>
              {transcript.steps.map((step) => (
                <ActivityPresence
                  key={step.id}
                  layoutDependency={transcript.steps.length}
                >
                  <ToolActivity
                    id={`${part.id}:${step.id}`}
                    state={
                      step.status === 'succeeded'
                        ? { status: 'succeeded' }
                        : {
                            error: step.error ?? 'The tool failed.',
                            status: 'failed',
                          }
                    }
                    summary={step.summary}
                    tool={step.tool}
                  >
                    {(step.input || step.output || step.error) && (
                      <dl {...stylex.props(styles.evidence)}>
                        {step.input && (
                          <EvidenceRow label="Input" value={step.input} />
                        )}
                        {step.output && (
                          <EvidenceRow label="Result" value={step.output} />
                        )}
                        {step.error && (
                          <EvidenceRow
                            danger
                            label="Error"
                            value={step.error}
                          />
                        )}
                      </dl>
                    )}
                  </ToolActivity>
                </ActivityPresence>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
      <AnimatePresence initial={false}>
        {(transcript.result || isTerminal(part.state)) && (
          <ActivityPresence
            key="result"
            layoutDependency={transcript.steps.length}
          >
            <section
              aria-label="Subagent result"
              {...stylex.props(styles.taskSection)}
            >
              <p {...stylex.props(styles.taskLabel)}>
                {part.state.status === 'failed' ? 'Partial response' : 'Result'}
              </p>
              {transcript.result ? (
                <Markdown status="complete">{transcript.result}</Markdown>
              ) : (
                <p {...stylex.props(styles.taskCopy)}>
                  No response text was received.
                </p>
              )}
            </section>
          </ActivityPresence>
        )}
      </AnimatePresence>
      <dl {...stylex.props(styles.evidence)}>
        <ToolTiming state={part.state} />
      </dl>
    </div>
  )
}

export function WebTool(props: ChatToolProps) {
  const presentation =
    props.part.presentation.kind === 'web' ? props.part.presentation : undefined
  const target = presentation?.target
  const operation = presentation?.operation ?? 'fetch'

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
  const name =
    props.part.presentation.kind === 'skill'
      ? props.part.presentation.name
      : undefined
  return <ToolShell {...props} summary={name ? `Load ${name}` : 'Load skill'} />
}

export function GenericTool(props: ChatToolProps) {
  return (
    <ToolShell {...props} summary={genericToolSummary(props.part.toolName)} />
  )
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
      <AnimatePresence initial={false}>
        {input !== undefined && (
          <BoundedEvidenceRow key="input" label="Input" value={input} />
        )}
        {output !== undefined && (
          <BoundedEvidenceRow
            key="result"
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
          <BoundedEvidenceRow
            key="metadata"
            label="Metadata"
            value={part.metadata}
          />
        )}
      </AnimatePresence>
      {state.status === 'failed' && (
        <EvidenceRow label="Error" value={state.error.message} danger />
      )}
      <ToolTiming state={state} />
    </dl>
  )
}

function useBoundedToolValue(value: JsonValue, limit = 12_000) {
  const [revealed, setRevealed] = useState(false)
  const formatted = stripAnsi(formatJson(value))
  const truncated = formatted.length > limit
  const visible =
    truncated && !revealed ? `${formatted.slice(0, limit)}\n…` : formatted
  return { revealed, setRevealed, truncated, visible }
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
  const { revealed, setRevealed, truncated, visible } = useBoundedToolValue(
    value,
    characterLimit,
  )

  return (
    <PresenceSurface kind="overlay" {...stylex.props(styles.evidenceRow)}>
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
    </PresenceSurface>
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
  const { revealed, setRevealed, truncated, visible } = useBoundedToolValue(
    value,
    characterLimit,
  )

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
      <dd dir="ltr" {...stylex.props(styles.value, danger && styles.danger)}>
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
        startedAt: state.startedAt,
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

function formatJson(value: JsonValue) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

function formatTime(value: number) {
  return timeFormatter.format(value)
}

function formatDuration(value: number) {
  if (value < 1_000) return `${Math.round(value)} ms`
  return `${(value / 1_000).toFixed(1)} s`
}

function stripAnsi(value: string) {
  // oxlint-disable-next-line no-control-regex -- Match the ESC byte to remove ANSI terminal sequences.
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
  return words
    ? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
    : 'Tool call'
}

function genericToolSummary(value: string) {
  const name = value.replace(/^mcp[._-]+/i, '').replace(/[._-]+tool$/i, '')
  const label = humanize(name)
  return label === 'Tool call' ? label : `${label} tool`
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

const styles = stylex.create({
  subagent: {
    boxSizing: 'border-box',
    inlineSize: '100%',
  },
  taskTranscript: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    minInlineSize: 0,
  },
  taskSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  taskLabel: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  taskCopy: {
    color: colors.text,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '65ch',
    overflowWrap: 'anywhere',
  },
  taskSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    inlineSize: '100%',
  },
  groupSummary: {
    alignItems: 'center',
    color: colors.text,
    display: 'grid',
    flex: 1,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    fontWeight: type.weightRegular,
    gap: space.x2,
    gridTemplateColumns: '0.875rem minmax(0, 1fr)',
    lineHeight: type.lineBody,
    minInlineSize: 0,
  },
  groupMark: {
    alignItems: 'center',
    blockSize: '0.875rem',
    color: colors.textMuted,
    display: 'inline-flex',
    inlineSize: '0.875rem',
    justifyContent: 'center',
  },
  groupLabel: {
    alignItems: 'baseline',
    display: 'flex',
    gap: space.x2,
    minInlineSize: 0,
  },
  groupItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    marginInlineStart: '0.4375rem',
    paddingInlineStart: '1.0625rem',
  },
  muted: {
    color: colors.textMuted,
    flexShrink: 0,
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
  diagnostics: {
    color: colors.textMuted,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x2,
  },
  diagnosticsTitle: {
    color: colors.danger,
    fontWeight: type.weightMedium,
    margin: 0,
  },
  diagnosticList: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    margin: 0,
    paddingInlineStart: space.x5,
  },
  diagnostic: {
    overflowWrap: 'anywhere',
  },
  diagnosticLocation: {
    color: colors.danger,
    display: 'inline',
    fontFamily: type.familyMono,
    marginInlineEnd: space.x2,
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
