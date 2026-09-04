import { ChatSession, useChatStore } from '@pretty-amped/blocks'
import { Loader, Outcome, Suggestion, Suggestions } from '@pretty-amped/components'
import { darkTheme, lightTheme } from '@pretty-amped/foundations/themes'
import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, Dialog, IconButton } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Library, MessageSquare, Moon, Sun, Trash2 } from 'lucide-react'
import { Profiler, useEffect, useState, useSyncExternalStore } from 'react'

import { ComponentGallery } from './component-gallery'
import { FixtureChatStore } from './fixture-chat-store'
import {
  createDraft,
  NanocodexChatStore,
  type RuntimeState,
} from './nanocodex-store'

type Theme = 'light' | 'dark'
type View = 'playground' | 'components'
type ChatGptAuthState =
  | { state: 'loading' }
  | { state: 'signed_out' }
  | { state: 'expired' }
  | { state: 'authenticated'; expiresAt?: number }
  | {
      expiresAt: number
      pollAfterMs: number
      state: 'pending'
      userCode: string
      verificationUrl: string
    }
  | { message: string; state: 'error' }
type FixtureMetrics = {
  commitDurations: number[]
  getNotificationCount: () => number
  longTasks?: number[]
  longTaskObserver?: PerformanceObserver
}

const promptSuggestions = [
  'Why StyleX for AI interfaces?',
  'Audit a streaming response',
  'Design an approval flow',
]

const fixtureCommands = [
  {
    description: 'Review the active interface against the component contract.',
    id: 'audit',
    label: 'Audit interface',
    value: '/audit',
  },
  {
    description: 'Summarize the visible session evidence.',
    id: 'summarize',
    label: 'Summarize session',
    value: '/summarize',
  },
] as const

const fixtureReferences = [
  {
    description: 'Demo application entry point.',
    id: 'demo-app',
    label: 'apps/demo/src/app.tsx',
    referenceType: 'file' as const,
    value: 'apps/demo/src/app.tsx',
  },
  {
    description: 'Chat session composition contract.',
    id: 'chat-session',
    label: 'packages/blocks/src/chat-session.tsx',
    referenceType: 'file' as const,
    value: 'packages/blocks/src/chat-session.tsx',
  },
] as const

export function App() {
  const fixtureMode = new URLSearchParams(window.location.search).get('fixture')
  if (fixtureMode === 'workflow' || fixtureMode === 'stress') {
    return <FixtureApp mode={fixtureMode} />
  }
  return <DemoApp />
}

function DemoApp() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [view, setView] = useState<View>('playground')
  const [store] = useState(() => new NanocodexChatStore())
  const snapshot = useChatStore(store)
  const runtime = useSyncExternalStore(
    store.subscribe,
    store.getRuntimeSnapshot,
    store.getRuntimeSnapshot,
  )

  useEffect(() => {
    void store.initialize()
    return () => store.dispose()
  }, [store])

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

  const runtimeLabel =
    runtime.status === 'ready'
      ? `${runtime.runtime} · ${runtime.model}`
      : runtime.status === 'loading'
        ? 'Connecting to runtime…'
        : 'Runtime unavailable'

  async function refreshRuntime() {
    await store.clear()
    await store.initialize()
  }

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
            <h1 {...stylex.props(styles.title)}>Pretty Amped</h1>
            <span {...stylex.props(styles.product)}>
              {view === 'playground' ? 'Playground' : 'Components'}
            </span>
          </div>
          <nav aria-label="Demo views" {...stylex.props(styles.headerActions)}>
            {runtime.status !== 'loading' && (
              <ChatGptConnection
                disabled={snapshot.activity.status !== 'idle'}
                onConnectionChange={refreshRuntime}
              />
            )}
            {view === 'playground' &&
              snapshot.turns.length > 0 &&
              snapshot.activity.status === 'idle' && (
                <IconButton
                  aria-label="Clear"
                  iconSize="small"
                  onClick={() => void store.clear()}
                  title="Clear conversation"
                  variant="quiet"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </IconButton>
            )}
            <IconButton
              aria-label={view === 'playground' ? 'Catalog' : 'Playground'}
              iconSize="small"
              onClick={() =>
                setView((currentView) =>
                  currentView === 'playground' ? 'components' : 'playground',
                )
              }
              title={view === 'playground' ? 'Component catalog' : 'Playground'}
              variant="quiet"
            >
              {view === 'playground' ? (
                <Library size={16} strokeWidth={1.75} />
              ) : (
                <MessageSquare size={16} strokeWidth={1.75} />
              )}
            </IconButton>
            <IconButton
              aria-label={theme === 'dark' ? 'Light' : 'Dark'}
              aria-pressed={theme === 'dark'}
              iconSize="small"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              variant="quiet"
            >
              {theme === 'dark' ? (
                <Sun size={16} strokeWidth={1.75} />
              ) : (
                <Moon size={16} strokeWidth={1.75} />
              )}
            </IconButton>
          </nav>
        </div>
      </header>

      {view === 'playground' ? (
        <div {...stylex.props(styles.workspace)}>
          <ChatSession
            composerActions={(
              <span
                {...stylex.props(
                  styles.runtimeMeta,
                  runtime.status === 'unavailable' && styles.runtimeError,
                )}
              >
                {runtimeLabel}
              </span>
            )}
            empty={<EmptyPlayground runtime={runtime} store={store} />}
            label="Playground conversation"
            store={store}
          />
        </div>
      ) : (
        <ComponentGallery />
      )}
    </div>
  )
}

function ChatGptConnection({
  disabled,
  onConnectionChange,
}: {
  disabled: boolean
  onConnectionChange: () => Promise<void>
}) {
  const [auth, setAuth] = useState<ChatGptAuthState>({ state: 'loading' })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    void authRequest('/api/auth/chatgpt').then(
      (state) => active && setAuth(state),
      () => active && setAuth({
        message: 'ChatGPT sign-in could not be reached.',
        state: 'error',
      }),
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (auth.state !== 'pending') return
    let active = true
    const timer = window.setTimeout(() => {
      void authRequest('/api/auth/chatgpt/poll', 'POST').then(
        async (state) => {
          if (!active) return
          setAuth(state)
          if (state.state === 'authenticated') await onConnectionChange()
        },
        () => active && setAuth({
          message: 'ChatGPT sign-in could not be completed.',
          state: 'error',
        }),
      )
    }, Math.max(250, auth.pollAfterMs))
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [auth, onConnectionChange])

  async function startLogin() {
    if (busy || disabled) return
    setBusy(true)
    setCopied(false)
    try {
      const state = await authRequest('/api/auth/chatgpt/start', 'POST')
      setAuth(state)
      if (state.state === 'authenticated') await onConnectionChange()
    } catch {
      setAuth({
        message: 'ChatGPT sign-in could not be started.',
        state: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (busy || disabled) return
    setBusy(true)
    try {
      const state = await authRequest('/api/auth/chatgpt/logout', 'POST')
      setAuth(state)
      await onConnectionChange()
    } catch {
      setAuth({
        message: 'ChatGPT could not be disconnected.',
        state: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(true)
  }

  const trigger = auth.state === 'authenticated'
    ? 'ChatGPT'
    : auth.state === 'pending'
      ? 'Finish sign in'
      : 'Sign in'
  const action = auth.state === 'authenticated'
    ? (
        <Button
          disabled={busy || disabled}
          onClick={() => void logout()}
          size="compact"
          variant="outline"
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      )
    : auth.state === 'signed_out' || auth.state === 'expired' || auth.state === 'error'
      ? (
          <Button
            disabled={busy || disabled}
            onClick={() => void startLogin()}
            size="compact"
            variant="primary"
          >
            {busy ? 'Starting…' : auth.state === 'error' ? 'Try again' : 'Sign in with ChatGPT'}
          </Button>
        )
      : undefined

  return (
    <Dialog
      actions={action}
      description="Use OpenAI’s device flow. Subscription credentials stay encrypted on this server and are never exposed to the browser."
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setCopied(false)
      }}
      open={open}
      title="Connect ChatGPT"
      trigger={trigger}
    >
      <div {...stylex.props(styles.authBody)}>
        {auth.state === 'loading' && (
          <p role="status" {...stylex.props(styles.authText)}>
            Checking connection…
          </p>
        )}

        {(auth.state === 'signed_out' || auth.state === 'expired') && (
          <p {...stylex.props(styles.authText)}>
            {auth.state === 'expired'
              ? 'The sign-in code expired. Start again to get a new code.'
              : 'Sign in with the ChatGPT account whose subscription you want to use.'}
          </p>
        )}

        {auth.state === 'pending' && (
          <>
            <p {...stylex.props(styles.authText)}>
              Open the OpenAI verification page, then enter this one-time code.
            </p>
            <div {...stylex.props(styles.authCodeRow)}>
              <code {...stylex.props(styles.authCode)}>{auth.userCode}</code>
              <Button
                onClick={() => void copyCode(auth.userCode)}
                size="compact"
                variant="outline"
              >
                {copied ? 'Copied' : 'Copy code'}
              </Button>
            </div>
            <a
              href={auth.verificationUrl}
              rel="noreferrer"
              target="_blank"
              {...stylex.props(styles.authLink)}
            >
              Continue to OpenAI
            </a>
            <p aria-live="polite" role="status" {...stylex.props(styles.authStatus)}>
              {copied ? 'Code copied. Waiting for authorization…' : 'Waiting for authorization…'}
            </p>
          </>
        )}

        {auth.state === 'authenticated' && (
          <p role="status" {...stylex.props(styles.authText)}>
            Connected. New conversations use your ChatGPT subscription.
          </p>
        )}

        {auth.state === 'error' && (
          <p role="alert" {...stylex.props(styles.authError)}>{auth.message}</p>
        )}
      </div>
    </Dialog>
  )
}

async function authRequest(
  path: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<ChatGptAuthState> {
  const response = await fetch(path, {
    ...(method === 'POST'
      ? { body: '{}', headers: { 'Content-Type': 'application/json' } }
      : {}),
    method,
  })
  const body: unknown = await response.json()
  if (!response.ok || !isAuthState(body)) throw new Error()
  return body
}

function isAuthState(value: unknown): value is ChatGptAuthState {
  if (typeof value !== 'object' || value === null || !('state' in value)) return false
  if (
    value.state === 'signed_out' ||
    value.state === 'expired' ||
    value.state === 'authenticated'
  ) {
    return true
  }
  return value.state === 'pending' &&
    'expiresAt' in value && typeof value.expiresAt === 'number' &&
    'pollAfterMs' in value && typeof value.pollAfterMs === 'number' &&
    'userCode' in value && typeof value.userCode === 'string' &&
    'verificationUrl' in value && typeof value.verificationUrl === 'string'
}

function FixtureApp({ mode }: { mode: 'workflow' | 'stress' }) {
  const [store] = useState(() => new FixtureChatStore(mode))
  const [metrics] = useState<FixtureMetrics>(() => ({
    commitDurations: [],
    getNotificationCount: store.getNotificationCount,
  }))
  const parameters = new URLSearchParams(window.location.search)
  const theme = parameters.get('theme') === 'dark' ? 'dark' : 'light'
  const direction = parameters.get('dir') === 'rtl' ? 'rtl' : 'ltr'

  useEffect(() => {
    const browserWindow = window as Window & {
      __prettyAmpedFixtureMetrics?: FixtureMetrics
    }
    browserWindow.__prettyAmpedFixtureMetrics = metrics
    const appendTurn = () => store.appendTurn()
    const requestPermission = () => store.requestPermission()
    const requestQuestion = () => store.requestQuestion()
    const burstDeltas = (event: Event) => {
      const count =
        event instanceof CustomEvent && typeof event.detail === 'number'
          ? event.detail
          : 1_000
      store.burstDeltas(count)
    }
    window.addEventListener('pretty-amped:append-turn', appendTurn)
    window.addEventListener('pretty-amped:request-permission', requestPermission)
    window.addEventListener('pretty-amped:request-question', requestQuestion)
    window.addEventListener('pretty-amped:burst-deltas', burstDeltas)
    return () => {
      window.removeEventListener('pretty-amped:append-turn', appendTurn)
      window.removeEventListener('pretty-amped:request-permission', requestPermission)
      window.removeEventListener('pretty-amped:request-question', requestQuestion)
      window.removeEventListener('pretty-amped:burst-deltas', burstDeltas)
      metrics.longTaskObserver?.disconnect()
      delete browserWindow.__prettyAmpedFixtureMetrics
    }
  }, [metrics, store])

  return (
    <div
      data-fixture={mode}
      data-theme={theme}
      dir={direction}
      {...stylex.props(
        theme === 'dark' ? darkTheme : lightTheme,
        styles.app,
        themeStyles[theme],
      )}
    >
      <Profiler
        id={`${mode}-chat-fixture`}
        onRender={(_id, _phase, actualDuration) => {
          metrics.commitDurations.push(actualDuration)
        }}
      >
        <ChatSession
          accept="image/*,.txt,.md"
          commands={fixtureCommands}
          label={`${mode} chat fixture`}
          onFilesAdd={(files, source) => store.addFiles(files, source)}
          onRemoveAttachment={(attachment) => store.removeAttachment(attachment)}
          onRemoveReference={(reference) => store.removeReference(reference)}
          onRetryAttachment={(attachment) => store.retryAttachment(attachment)}
          references={fixtureReferences}
          showRevertActions={mode === 'workflow'}
          store={store}
        />
      </Profiler>
    </div>
  )
}

function EmptyPlayground({
  runtime,
  store,
}: {
  runtime: RuntimeState
  store: NanocodexChatStore
}) {
  if (runtime.status === 'loading') {
    return <Loader label="Connecting to runtime" state={{ status: 'pending' }} />
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
        <h2 {...stylex.props(styles.emptyTitle)}>Start a conversation</h2>
        <p {...stylex.props(styles.emptyDescription)}>
          Ask about the component system or use public web search. This demo
          cannot access your workspace.
        </p>
      </div>
      <Suggestions>
        {promptSuggestions.map((suggestion) => (
          <Suggestion
            key={suggestion}
            onSelect={(value) => void store.submit(createDraft(value), 'send')}
            value={suggestion}
          />
        ))}
      </Suggestions>
    </div>
  )
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
    boxSizing: 'border-box',
    display: 'flex',
    gap: space.x2,
    inlineSize: '100%',
    justifyContent: 'space-between',
    marginInline: 'auto',
    maxInlineSize: '52rem',
    minBlockSize: '3rem',
    paddingInline: space.x4,
  },
  headerInnerWide: {
    maxInlineSize: '68rem',
  },
  identity: {
    alignItems: 'baseline',
    display: {
      default: 'none',
      '@media (min-width: 36rem)': 'flex',
    },
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
  emptyState: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x6,
    inlineSize: '100%',
    marginInline: 'auto',
    maxInlineSize: '40rem',
    textAlign: 'center',
  },
  emptyCopy: {
    alignItems: 'center',
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
  authBody: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
  },
  authText: {
    color: colors.text,
    lineHeight: type.lineBody,
    margin: 0,
  },
  authCodeRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x3,
  },
  authCode: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: '0.375rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeInput,
    fontWeight: type.weightStrong,
    letterSpacing: '0.08em',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  authLink: {
    color: colors.text,
    fontWeight: type.weightMedium,
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineOffset: '3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
    textDecorationLine: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
  authStatus: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  authError: {
    color: colors.danger,
    lineHeight: type.lineBody,
    margin: 0,
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
