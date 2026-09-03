import {
  ChatComposer,
  Composer,
  Loader,
  Markdown,
  Message,
  Outcome,
  Reasoning,
  Response,
  Suggestion,
  Suggestions,
  Thread,
  ToolActivity,
} from '@pretty-amped/components'
import { Timeline } from '@pretty-amped/blocks'
import type {
  ChatTurn,
  ComposerDraft,
  JsonValue,
  MessagePart,
  ToolState,
  ToolPresentation,
  TurnState,
} from '@pretty-amped/foundations/chat'
import { composerDraftText } from '@pretty-amped/foundations/chat-invariants'
import { darkTheme, lightTheme } from '@pretty-amped/foundations/themes'
import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'

import { ComponentGallery } from './component-gallery'

type Theme = 'light' | 'dark'
type View = 'playground' | 'components'

type RuntimeState =
  | { status: 'loading' }
  | { status: 'ready'; model: string; runtime: string }
  | { status: 'unavailable'; message: string }

type Usage = {
  outputTokens: number
  totalTokens: number
}

type UserMessage = {
  actor: 'user'
  createdAt: number
  id: string
  text: string
}

type ToolRun = {
  error?: string
  id: string
  input?: string
  output?: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  summary: string
  tool: string
}

type AssistantMessage = {
  actor: 'assistant'
  createdAt: number
  durationMs?: number
  error?: string
  id: string
  reasoning: string
  status: 'streaming' | 'complete' | 'interrupted' | 'failed'
  text: string
  tools: ToolRun[]
  usage?: Usage
}

type ChatMessage = UserMessage | AssistantMessage

type StreamEvent =
  | { type: 'started' }
  | { type: 'assistant-delta'; text: string }
  | { type: 'assistant-message'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | {
      type: 'tool-started'
      id: string
      input?: string
      summary: string
      tool: string
    }
  | {
      type: 'tool-completed'
      error?: string
      id: string
      output?: string
      status: 'succeeded' | 'failed'
      summary: string
      tool: string
    }
  | {
      type: 'completed'
      durationMs: number
      message: string
      usage: Usage
    }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }

const promptSuggestions = [
  'Explain why StyleX suits AI interfaces',
  'Audit a streaming response component',
  'Design an accessible approval flow',
]

export function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [view, setView] = useState<View>('playground')
  const [runtime, setRuntime] = useState<RuntimeState>({ status: 'loading' })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<ComposerDraft>(createEmptyDraft)
  const [busy, setBusy] = useState(false)
  const activeController = useRef<AbortController | null>(null)
  const activeMessageId = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void fetch('/api/runtime', { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json()
        if (!response.ok || !isRecord(body)) throw new Error()

        if (
          body.available === true &&
          typeof body.model === 'string' &&
          typeof body.runtime === 'string'
        ) {
          setRuntime({
            model: body.model,
            runtime: body.runtime,
            status: 'ready',
          })
        } else {
          setRuntime({
            message: 'Add a server-side OpenAI API key to run the playground.',
            status: 'unavailable',
          })
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRuntime({
          message: 'The local model runtime could not be reached.',
          status: 'unavailable',
        })
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => activeController.current?.abort()
  }, [])

  function toggleTheme() {
    document.documentElement.dataset.themeSwitching = 'true'
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    )

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        delete document.documentElement.dataset.themeSwitching
      })
    })
  }

  function updateAssistant(
    id: string,
    update: (message: AssistantMessage) => AssistantMessage,
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.actor === 'assistant' && message.id === id
          ? update(message)
          : message,
      ),
    )
  }

  async function submitMessage(value: string) {
    const input = value.trim()
    if (!input || busy || runtime.status !== 'ready') return

    const userMessage: UserMessage = {
      actor: 'user',
      createdAt: Date.now(),
      id: crypto.randomUUID(),
      text: input,
    }
    const assistantMessage: AssistantMessage = {
      actor: 'assistant',
      createdAt: Date.now(),
      id: crypto.randomUUID(),
      reasoning: '',
      status: 'streaming',
      text: '',
      tools: [],
    }
    const controller = new AbortController()
    let terminalEvent = false
    let projectedMessage = assistantMessage
    let publishFrame: number | undefined

    function publish(next: AssistantMessage, immediate = false) {
      projectedMessage = next

      if (immediate) {
        if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame)
        publishFrame = undefined
        const snapshot = projectedMessage
        updateAssistant(assistantMessage.id, () => snapshot)
      } else if (publishFrame === undefined) {
        publishFrame = window.requestAnimationFrame(() => {
          publishFrame = undefined
          const snapshot = projectedMessage
          updateAssistant(assistantMessage.id, () => snapshot)
        })
      }
    }

    activeController.current = controller
    activeMessageId.current = assistantMessage.id
    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft(createEmptyDraft())
    setBusy(true)

    try {
      const response = await fetch('/api/chat', {
        body: JSON.stringify({ input }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(await responseError(response))

      await readEvents(response, (event) => {
        if (event.type === 'assistant-delta') {
          publish({
            ...projectedMessage,
            text: projectedMessage.text + event.text,
          })
        } else if (event.type === 'assistant-message') {
          publish({
            ...projectedMessage,
            text: event.text,
          })
        } else if (event.type === 'reasoning-delta') {
          publish({
            ...projectedMessage,
            reasoning: projectedMessage.reasoning + event.text,
          })
        } else if (event.type === 'tool-started') {
          publish({
            ...projectedMessage,
            tools: upsertTool(projectedMessage.tools, {
              id: event.id,
              ...(event.input === undefined ? {} : { input: event.input }),
              status: 'running',
              summary: event.summary,
              tool: event.tool,
            }),
          })
        } else if (event.type === 'tool-completed') {
          publish({
            ...projectedMessage,
            tools: upsertTool(projectedMessage.tools, {
              ...(event.error === undefined ? {} : { error: event.error }),
              id: event.id,
              ...(event.output === undefined ? {} : { output: event.output }),
              status: event.status,
              summary: event.summary,
              tool: event.tool,
            }),
          })
        } else if (event.type === 'completed') {
          terminalEvent = true
          publish(
            {
              ...projectedMessage,
              durationMs: event.durationMs,
              status: 'complete',
              text: event.message || projectedMessage.text,
              usage: event.usage,
            },
            true,
          )
        } else if (event.type === 'cancelled') {
          terminalEvent = true
          publish(
            {
              ...projectedMessage,
              status: 'interrupted',
              tools: settleRunningTools(projectedMessage.tools, 'cancelled'),
            },
            true,
          )
        } else if (event.type === 'error') {
          terminalEvent = true
          publish(
            {
              ...projectedMessage,
              error: event.message,
              status: 'failed',
              tools: settleRunningTools(
                projectedMessage.tools,
                'failed',
                event.message,
              ),
            },
            true,
          )
        }
      })

      if (!terminalEvent) {
        throw new Error('The response stream ended before it completed.')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        publish(
          {
            ...projectedMessage,
            error:
              error instanceof Error
                ? error.message
                : 'The response could not be completed.',
            status: 'failed',
            tools: settleRunningTools(
              projectedMessage.tools,
              'failed',
              'The tool was interrupted by a runtime failure.',
            ),
          },
          true,
        )
      }
    } finally {
      if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame)
      if (activeController.current === controller) {
        activeController.current = null
        activeMessageId.current = null
        setBusy(false)
      }
    }
  }

  function stopResponse() {
    if (!activeMessageId.current) return
    void fetch('/api/cancel', { method: 'POST' })
  }

  async function clearConversation() {
    const response = await fetch('/api/session', { method: 'DELETE' })
    if (!response.ok) return
    setMessages([])
    setDraft(createEmptyDraft())
  }

  const runtimeLabel =
    runtime.status === 'ready'
      ? `${runtime.runtime} · ${runtime.model} · read-only catalog tool`
      : runtime.status === 'loading'
        ? 'Connecting to Nanocodex…'
        : 'Runtime unavailable'
  const projectedTurns = projectMessages(messages)
  const activity = busy && projectedTurns.length > 0
    ? { status: 'busy' as const, turnId: projectedTurns.at(-1)?.id ?? '' }
    : { status: 'idle' as const }

  return (
    <div
      data-theme={theme}
      {...stylex.props(
        theme === 'dark' ? darkTheme : lightTheme,
        styles.app,
        themeStyles[theme],
      )}
    >
      <header {...stylex.props(styles.header)}>
        <div
          {...stylex.props(
            styles.headerInner,
            view === 'components' && styles.headerInnerWide,
          )}
        >
          <div {...stylex.props(styles.identity)}>
            <h1 {...stylex.props(styles.title)}>
              {view === 'playground' ? 'Playground' : 'Components'}
            </h1>
            <span {...stylex.props(styles.product)}>Pretty Amped</span>
          </div>
          <nav aria-label="Demo views" {...stylex.props(styles.headerActions)}>
            {view === 'playground' && (
              <Button
                disabled={messages.length === 0 || busy}
                onClick={() => void clearConversation()}
                size="compact"
                variant="quiet"
              >
                Clear
              </Button>
            )}
            <Button
              onClick={() =>
                setView((currentView) =>
                  currentView === 'playground' ? 'components' : 'playground',
                )
              }
              size="compact"
              variant="quiet"
            >
              {view === 'playground' ? 'Catalog' : 'Playground'}
            </Button>
            <Button
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
              size="compact"
              variant="quiet"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </nav>
        </div>
      </header>

      {view === 'playground' ? (
        <div {...stylex.props(styles.workspace)}>
          <main {...stylex.props(styles.timeline)}>
            <Timeline
              activity={activity}
              empty={<EmptyPlayground runtime={runtime} onSelect={submitMessage} />}
              history={{ status: 'complete' }}
              label="Nanocodex playground conversation"
              onLoadPrevious={() => Promise.resolve()}
              turns={projectedTurns}
            />
          </main>

          <div {...stylex.props(styles.composerDock)}>
            <div {...stylex.props(styles.composerWrap)}>
              <ChatComposer
                actions={(
                  <span
                    {...stylex.props(
                      styles.runtimeMeta,
                      runtime.status === 'unavailable' && styles.runtimeError,
                    )}
                  >
                    {runtimeLabel}
                  </span>
                )}
                activity={activity}
                capabilities={{
                  agents: [],
                  busySubmission: [],
                  canAttach: false,
                  canStop: busy,
                  canSubmit: runtime.status === 'ready' && !busy,
                  canUseShell: false,
                  models: [],
                  permissionDecisions: [],
                  referenceTypes: [],
                  variants: [],
                }}
                draft={draft}
                onDraftChange={setDraft}
                onStop={stopResponse}
                onSubmit={(nextDraft) =>
                  void submitMessage(composerDraftText(nextDraft))
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <ComponentGallery />
      )}
    </div>
  )
}

function EmptyPlayground({
  onSelect,
  runtime,
}: {
  onSelect: (value: string) => void
  runtime: RuntimeState
}) {
  if (runtime.status === 'loading') {
    return <Loader label="Connecting to Nanocodex" state={{ status: 'pending' }} />
  }

  if (runtime.status === 'unavailable') {
    return (
      <Outcome
        id="runtime-unavailable"
        state={{ status: 'blocked' }}
        title="Playground unavailable"
      >
        {runtime.message}
      </Outcome>
    )
  }

  return (
    <div {...stylex.props(styles.emptyState)}>
      <div {...stylex.props(styles.emptyCopy)}>
        <h2 {...stylex.props(styles.emptyTitle)}>Try the components live</h2>
        <p {...stylex.props(styles.emptyDescription)}>
          A retained Nanocodex conversation rendered entirely with Pretty Amped.
          The model can search the read-only component catalog, with no workspace
          access.
        </p>
      </div>
      <Suggestions>
        {promptSuggestions.map((suggestion) => (
          <Suggestion key={suggestion} onSelect={onSelect} value={suggestion} />
        ))}
      </Suggestions>
    </div>
  )
}

function createEmptyDraft(): ComposerDraft {
  return {
    attachments: [],
    mode: 'prompt',
    revision: 0,
    segments: [{ id: 'draft-text', text: '', type: 'text' }],
    selection: {
      anchor: { offset: 0, segmentId: 'draft-text' },
      focus: { offset: 0, segmentId: 'draft-text' },
    },
  }
}

function projectMessages(messages: readonly ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const user = messages[index]
    if (user?.actor !== 'user') continue

    const assistants: AssistantMessage[] = []
    while (messages[index + 1]?.actor === 'assistant') {
      const assistant = messages[index + 1]
      if (assistant?.actor === 'assistant') assistants.push(assistant)
      index += 1
    }

    const latest = assistants.at(-1)
    turns.push({
      assistant: assistants.map((assistant) => ({
        createdAt: assistant.createdAt,
        delivery: { status: 'confirmed' },
        id: assistant.id,
        parts: projectAssistantParts(assistant),
        role: 'assistant',
        turnId: user.id,
      })),
      id: user.id,
      state: projectTurnState(latest, user.createdAt),
      user: {
        createdAt: user.createdAt,
        delivery: { status: 'confirmed' },
        id: user.id,
        parts: [
          {
            id: `${user.id}:text`,
            markdown: user.text,
            state: { status: 'complete' },
            type: 'text',
          },
        ],
        role: 'user',
        turnId: user.id,
      },
    })
  }

  return turns
}

function projectAssistantParts(message: AssistantMessage) {
  const state =
    message.status === 'streaming'
      ? ({ status: 'streaming' } as const)
      : message.status === 'interrupted'
        ? ({ status: 'interrupted' } as const)
        : message.status === 'failed'
          ? ({
              error: chatError(message.error),
              status: 'failed',
            } as const)
          : ({ status: 'complete' } as const)
  const parts: MessagePart[] = []

  for (const tool of message.tools) {
    parts.push({
      callId: tool.id,
      id: tool.id,
      presentation: toolPresentation(tool.tool),
      state: projectToolState(tool, message.createdAt),
      toolName: tool.tool,
      type: 'tool',
    })
  }
  if (message.reasoning) {
    parts.push({
      id: `${message.id}:reasoning`,
      startedAt: message.createdAt,
      state,
      text: message.reasoning,
      type: 'reasoning',
    })
  }
  if (message.text) {
    parts.push({
      id: `${message.id}:text`,
      markdown: message.text,
      state,
      type: 'text',
    })
  }
  return parts
}

function projectTurnState(
  message: AssistantMessage | undefined,
  userCreatedAt: number,
): TurnState {
  if (!message) return { status: 'queued' }
  if (message.status === 'streaming') {
    return { startedAt: message.createdAt, status: 'running' }
  }

  const endedAt = message.createdAt + (message.durationMs ?? 0)
  if (message.status === 'interrupted') {
    return { endedAt, startedAt: message.createdAt, status: 'interrupted' }
  }
  if (message.status === 'failed') {
    return {
      endedAt,
      error: chatError(message.error),
      startedAt: message.createdAt,
      status: 'failed',
    }
  }
  return {
    endedAt,
    startedAt: message.createdAt || userCreatedAt,
    status: 'complete',
  }
}

function projectToolState(tool: ToolRun, startedAt: number): ToolState {
  const input: JsonValue = tool.input ?? {}
  if (tool.status === 'running') return { input, startedAt, status: 'running' }
  if (tool.status === 'failed') {
    return {
      endedAt: startedAt,
      error: chatError(tool.error),
      input,
      status: 'failed',
    }
  }
  if (tool.status === 'cancelled') {
    return { endedAt: startedAt, input, status: 'cancelled' }
  }
  return {
    endedAt: startedAt,
    input,
    ...(tool.output === undefined ? {} : { output: tool.output }),
    status: 'succeeded',
  }
}

function toolPresentation(tool: string): ToolPresentation {
  const value = tool.toLowerCase()
  if (value.includes('search')) return { kind: 'context', operation: 'grep' }
  if (value === 'read') return { kind: 'context', operation: 'read' }
  if (value === 'bash' || value === 'shell') return { kind: 'shell' }
  if (value === 'write' || value === 'edit') {
    return { kind: 'file-change', operation: value }
  }
  return { kind: 'generic' }
}

function chatError(message?: string) {
  return {
    kind: 'provider' as const,
    message: message ?? 'The response could not be completed.',
    retryable: false,
  }
}

function AssistantResponse({ message }: { message: AssistantMessage }) {
  const reasoning = message.reasoning ? (
    <Reasoning
      state={
        message.status === 'streaming'
          ? { status: 'thinking' }
          : { status: 'complete' }
      }
    >
      {message.reasoning}
    </Reasoning>
  ) : null

  const content = (
    <>
      {message.tools.map((tool) => (
        <ToolActivity
          id={tool.id}
          key={tool.id}
          state={
            tool.status === 'failed'
              ? {
                  error: tool.error ?? 'The tool could not complete.',
                  status: 'failed',
                }
              : { status: tool.status }
          }
          summary={tool.summary}
          tool={tool.tool}
        >
          {tool.input || tool.output ? (
            <dl {...stylex.props(styles.toolDetails)}>
              {tool.input && (
                <div {...stylex.props(styles.toolDetail)}>
                  <dt {...stylex.props(styles.toolDetailLabel)}>Input</dt>
                  <dd {...stylex.props(styles.toolDetailValue)}>{tool.input}</dd>
                </div>
              )}
              {tool.output && (
                <div {...stylex.props(styles.toolDetail)}>
                  <dt {...stylex.props(styles.toolDetailLabel)}>Result</dt>
                  <dd {...stylex.props(styles.toolDetailValue)}>{tool.output}</dd>
                </div>
              )}
            </dl>
          ) : null}
        </ToolActivity>
      ))}
      {reasoning}
      {message.text ? (
        <Markdown
          status={message.status === 'streaming' ? 'streaming' : 'complete'}
        >
          {message.text}
        </Markdown>
      ) : message.status === 'streaming' && !message.reasoning ? (
        <Loader label="Thinking" state={{ status: 'streaming' }} />
      ) : null}
    </>
  )

  const meta =
    message.status === 'complete' && message.durationMs !== undefined
      ? [
          formatDuration(message.durationMs),
          message.usage ? `${message.usage.totalTokens.toLocaleString()} tokens` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined

  return (
    <Message actor="assistant" {...(meta === undefined ? {} : { meta })}>
      {message.status === 'failed' ? (
        <Response
          error={message.error ?? 'The response could not be completed.'}
          status="failed"
        >
          {content}
        </Response>
      ) : message.status === 'interrupted' ? (
        <Response status="interrupted">{content}</Response>
      ) : message.status === 'complete' ? (
        <Response status="complete">{content}</Response>
      ) : (
        <Response status="streaming">{content}</Response>
      )}
    </Message>
  )
}

async function readEvents(
  response: globalThis.Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) throw new Error('The response stream is unavailable.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()
    buffer += decoder.decode(result.value, { stream: !result.done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const event = parseEvent(line)
      if (event) onEvent(event)
    }

    if (result.done) break
  }

  const finalEvent = parseEvent(buffer)
  if (finalEvent) onEvent(finalEvent)
}

function parseEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null

  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }

  if (!isRecord(value) || typeof value.type !== 'string') return null

  if (value.type === 'started' || value.type === 'cancelled') {
    return { type: value.type }
  }

  if (
    (value.type === 'assistant-delta' ||
      value.type === 'assistant-message' ||
      value.type === 'reasoning-delta') &&
    typeof value.text === 'string'
  ) {
    return { text: value.text, type: value.type }
  }

  if (
    value.type === 'tool-started' &&
    typeof value.id === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.tool === 'string' &&
    (value.input === undefined || typeof value.input === 'string')
  ) {
    return {
      id: value.id,
      ...(value.input === undefined ? {} : { input: value.input }),
      summary: value.summary,
      tool: value.tool,
      type: 'tool-started',
    }
  }

  if (
    value.type === 'tool-completed' &&
    typeof value.id === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.tool === 'string' &&
    (value.status === 'succeeded' || value.status === 'failed') &&
    (value.output === undefined || typeof value.output === 'string') &&
    (value.error === undefined || typeof value.error === 'string')
  ) {
    return {
      ...(value.error === undefined ? {} : { error: value.error }),
      id: value.id,
      ...(value.output === undefined ? {} : { output: value.output }),
      status: value.status,
      summary: value.summary,
      tool: value.tool,
      type: 'tool-completed',
    }
  }

  if (value.type === 'error' && typeof value.message === 'string') {
    return { message: value.message, type: 'error' }
  }

  if (
    value.type === 'completed' &&
    typeof value.durationMs === 'number' &&
    typeof value.message === 'string' &&
    isRecord(value.usage) &&
    typeof value.usage.outputTokens === 'number' &&
    typeof value.usage.totalTokens === 'number'
  ) {
    return {
      durationMs: value.durationMs,
      message: value.message,
      type: 'completed',
      usage: {
        outputTokens: value.usage.outputTokens,
        totalTokens: value.usage.totalTokens,
      },
    }
  }

  return null
}

async function responseError(response: globalThis.Response) {
  const body: unknown = await response.json().catch(() => null)
  return isRecord(body) && typeof body.error === 'string'
    ? body.error
    : 'The model request failed.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function upsertTool(tools: ToolRun[], tool: ToolRun) {
  const index = tools.findIndex((current) => current.id === tool.id)
  if (index === -1) return [...tools, tool]

  const next = [...tools]
  next[index] = { ...tools[index], ...tool }
  return next
}

function settleRunningTools(
  tools: ToolRun[],
  status: 'cancelled' | 'failed',
  error?: string,
) {
  return tools.map((tool) =>
    tool.status === 'running'
      ? {
          ...tool,
          ...(status === 'failed' && error ? { error } : {}),
          status,
        }
      : tool,
  )
}

function formatDuration(durationMs: number) {
  const seconds = durationMs / 1_000
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
}

const styles = stylex.create({
  app: {
    backgroundColor: colors.canvas,
    blockSize: '100dvh',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    minBlockSize: '30rem',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.canvas,
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    flexShrink: 0,
  },
  headerInner: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x2,
    justifyContent: 'space-between',
    marginInline: 'auto',
    maxInlineSize: '46rem',
    minBlockSize: '3.5rem',
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  headerInnerWide: {
    maxInlineSize: '68rem',
  },
  identity: {
    alignItems: 'baseline',
    display: 'flex',
    gap: space.x2,
    minInlineSize: 0,
  },
  title: {
    fontSize: type.sizeBody,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  product: {
    color: colors.textMuted,
    display: {
      default: 'none',
      '@media (min-width: 40rem)': 'inline',
    },
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  headerActions: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: space.x1,
  },
  workspace: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minBlockSize: 0,
  },
  timeline: {
    flex: 1,
    minBlockSize: 0,
  },
  scroller: {
    flex: 1,
    minBlockSize: 0,
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
  },
  transcript: {
    marginInline: 'auto',
    maxInlineSize: '46rem',
    paddingBlock: {
      default: space.x6,
      '@media (min-width: 48rem)': space.x8,
    },
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  emptyState: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x6,
    marginInline: 'auto',
    maxInlineSize: '43rem',
    textAlign: 'start',
  },
  emptyCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  emptyTitle: {
    fontSize: type.sizeBody,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '58ch',
  },
  toolDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    margin: 0,
  },
  toolDetail: {
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: '3.5rem minmax(0, 1fr)',
  },
  toolDetailLabel: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    margin: 0,
  },
  toolDetailValue: {
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  composerDock: {
    backgroundColor: colors.canvas,
    flexShrink: 0,
    paddingBlockEnd: `max(${space.x4}, env(safe-area-inset-bottom))`,
    paddingBlockStart: space.x3,
    paddingInline: space.x4,
  },
  composerWrap: {
    marginInline: 'auto',
    maxInlineSize: '43rem',
  },
  runtimeMeta: {
    color: colors.textMuted,
    display: 'block',
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  runtimeError: {
    color: colors.danger,
  },
})

const themeStyles = stylex.create({
  light: {
    colorScheme: 'light',
  },
  dark: {
    colorScheme: 'dark',
  },
})
