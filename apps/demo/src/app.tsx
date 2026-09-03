import {
  Composer,
  Loader,
  Message,
  Outcome,
  Reasoning,
  Response,
  Suggestion,
  Suggestions,
  Thread,
} from '@pretty-amped/components'
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
  id: string
  text: string
}

type AssistantMessage = {
  actor: 'assistant'
  durationMs?: number
  error?: string
  id: string
  reasoning: string
  status: 'streaming' | 'complete' | 'interrupted' | 'failed'
  text: string
  usage?: Usage
}

type ChatMessage = UserMessage | AssistantMessage

type StreamEvent =
  | { type: 'started' }
  | { type: 'assistant-delta'; text: string }
  | { type: 'assistant-message'; text: string }
  | { type: 'reasoning-delta'; text: string }
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
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const activeController = useRef<AbortController | null>(null)
  const activeMessageId = useRef<string | null>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const followOutput = useRef(true)

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
    if (!followOutput.current) return
    const frame = window.requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages])

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
      id: crypto.randomUUID(),
      text: input,
    }
    const assistantMessage: AssistantMessage = {
      actor: 'assistant',
      id: crypto.randomUUID(),
      reasoning: '',
      status: 'streaming',
      text: '',
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

    followOutput.current = true
    activeController.current = controller
    activeMessageId.current = assistantMessage.id
    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft('')
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
    setDraft('')
    followOutput.current = true
  }

  function trackScroll() {
    const element = scroller.current
    if (!element) return
    followOutput.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80
  }

  const runtimeLabel =
    runtime.status === 'ready'
      ? `${runtime.runtime} · ${runtime.model} · text only`
      : runtime.status === 'loading'
        ? 'Connecting to Nanocodex…'
        : 'Runtime unavailable'

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
          <main
            ref={scroller}
            onScroll={trackScroll}
            {...stylex.props(styles.scroller)}
          >
            <div {...stylex.props(styles.transcript)}>
              <Thread
                busy={busy}
                empty={<EmptyPlayground runtime={runtime} onSelect={submitMessage} />}
                label="Nanocodex playground conversation"
              >
                {messages.map((message) =>
                  message.actor === 'user' ? (
                    <Message actor="user" key={message.id}>
                      {message.text}
                    </Message>
                  ) : (
                    <AssistantResponse key={message.id} message={message} />
                  ),
                )}
              </Thread>
            </div>
          </main>

          <div {...stylex.props(styles.composerDock)}>
            <div {...stylex.props(styles.composerWrap)}>
              {busy ? (
                <Composer
                  actions={(
                    <span {...stylex.props(styles.runtimeMeta)}>
                      {runtimeLabel}
                    </span>
                  )}
                  maxLength={8_000}
                  onStop={stopResponse}
                  onSubmit={submitMessage}
                  onValueChange={setDraft}
                  status="streaming"
                  value={draft}
                />
              ) : runtime.status === 'ready' ? (
                <Composer
                  actions={(
                    <span {...stylex.props(styles.runtimeMeta)}>
                      {runtimeLabel}
                    </span>
                  )}
                  maxLength={8_000}
                  onSubmit={submitMessage}
                  onValueChange={setDraft}
                  status="idle"
                  value={draft}
                />
              ) : (
                <Composer
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
                  maxLength={8_000}
                  onSubmit={submitMessage}
                  onValueChange={setDraft}
                  status="disabled"
                  value={draft}
                />
              )}
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
          The model has no tools or workspace access.
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
      {reasoning}
      {message.text ? (
        <p {...stylex.props(styles.responseText)}>{message.text}</p>
      ) : message.status === 'streaming' ? (
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
  responseText: {
    margin: 0,
    maxInlineSize: '65ch',
    whiteSpace: 'pre-wrap',
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
