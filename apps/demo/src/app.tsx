import { ChatSession, useChatStore } from '@atira/blocks'
import { Loader, Outcome, Suggestion, Suggestions } from '@atira/components'
import { darkTheme, lightTheme } from '@atira/foundations/themes'
import { colors, space, type } from '@atira/foundations/tokens.stylex'
import { ActionMenu, Button, IconButton } from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check, History, Moon, Plus, Sun } from 'lucide-react'
import { Profiler, useEffect, useState, useSyncExternalStore } from 'react'

import { FixtureChatStore } from './fixture-chat-store'
import { ChatGptSignin } from './chatgpt-signin'
import {
  createDraft,
  NanocodexChatStore,
  type RuntimeState,
} from './nanocodex-store'

type Theme = 'light' | 'dark'
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
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_TEST_FIXTURES === 'true' &&
    (fixtureMode === 'workflow' || fixtureMode === 'stress')
  ) {
    return <FixtureApp mode={fixtureMode} />
  }
  return <DemoApp />
}

function DemoApp() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  const [store] = useState(() => new NanocodexChatStore())
  const snapshot = useChatStore(store)
  const conversations = useSyncExternalStore(
    store.subscribe,
    store.getConversations,
    store.getConversations,
  )
  const runtime = useSyncExternalStore(
    store.subscribe,
    store.getRuntimeSnapshot,
    store.getRuntimeSnapshot,
  )

  function openCatalog() {
    window.location.assign('/')
  }

  useEffect(() => {
    void store.initialize()
    window.addEventListener('pagehide', store.persist)
    return () => {
      window.removeEventListener('pagehide', store.persist)
      store.dispose()
    }
  }, [store])

  function toggleTheme() {
    document.documentElement.dataset.themeSwitching = 'true'
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))

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
        <div {...stylex.props(styles.headerInner)}>
          <div {...stylex.props(styles.identity)}>
            <h1 {...stylex.props(styles.title)}>Atira</h1>
            <span {...stylex.props(styles.product)}>Playground</span>
          </div>
          <nav aria-label="Demo views" {...stylex.props(styles.headerActions)}>
            <ActionMenu
              label="Conversations"
              disabled={
                snapshot.activity.status !== 'idle' ||
                runtime.status === 'loading'
              }
              trigger={<History size={16} strokeWidth={1.75} />}
              items={[
                {
                  id: 'new',
                  label: 'New conversation',
                  icon: <Plus size={16} />,
                  onSelect: () => store.newConversation(),
                },
                ...[...conversations]
                  .reverse()
                  .filter(
                    (conversation) =>
                      conversation.turns.length > 0 ||
                      conversation.title !== 'New conversation',
                  )
                  .map((conversation) => ({
                    id: conversation.id,
                    label: conversation.title,
                    disabled: conversation.id === snapshot.sessionId,
                    ...(conversation.id === snapshot.sessionId
                      ? { icon: <Check size={16} /> }
                      : {}),
                    onSelect: () => store.selectConversation(conversation.id),
                  })),
              ]}
            />
            <Button
              aria-label="Catalog"
              onClick={openCatalog}
              title="Component catalog"
              variant="quiet"
            >
              Catalog
            </Button>
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

      {runtime.status !== 'loading' && (
        <ChatGptSignin
          store={store}
          disabled={snapshot.activity.status !== 'idle'}
        />
      )}
      <div {...stylex.props(styles.workspace)}>
        <ChatSession
          key={snapshot.sessionId}
          composerActions={
            snapshot.capabilities.models.length === 0 && (
              <span
                {...stylex.props(
                  styles.runtimeMeta,
                  runtime.status === 'unavailable' && styles.runtimeError,
                )}
              >
                {runtimeLabel}
              </span>
            )
          }
          empty={<EmptyPlayground runtime={runtime} store={store} />}
          label="Playground conversation"
          store={store}
        />
      </div>
    </div>
  )
}

function FixtureApp({ mode }: { mode: 'workflow' | 'stress' }) {
  const [store] = useState(() => new FixtureChatStore(mode))
  const [metrics] = useState<FixtureMetrics>(() => ({
    commitDurations: [],
    getNotificationCount: store.getNotificationCount,
  }))
  const parameters = new URLSearchParams(window.location.search)
  const [theme, setTheme] = useState<Theme>(() =>
    parameters.get('theme') === 'dark' ? 'dark' : 'light',
  )
  const review = parameters.has('review') || parameters.has('design')
  const direction = parameters.get('dir') === 'rtl' ? 'rtl' : 'ltr'

  useEffect(() => {
    const browserWindow = window as Window & {
      __atiraFixtureMetrics?: FixtureMetrics
    }
    browserWindow.__atiraFixtureMetrics = metrics
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
    window.addEventListener('atira:append-turn', appendTurn)
    window.addEventListener('atira:request-permission', requestPermission)
    window.addEventListener('atira:request-question', requestQuestion)
    window.addEventListener('atira:burst-deltas', burstDeltas)
    return () => {
      window.removeEventListener('atira:append-turn', appendTurn)
      window.removeEventListener('atira:request-permission', requestPermission)
      window.removeEventListener('atira:request-question', requestQuestion)
      window.removeEventListener('atira:burst-deltas', burstDeltas)
      metrics.longTaskObserver?.disconnect()
      delete browserWindow.__atiraFixtureMetrics
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
      {review && (
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerInner, styles.reviewHeader)}>
            <span {...stylex.props(styles.runtimeMeta)}>
              Local fixture · no external actions
            </span>
            <nav
              aria-label="Design review"
              {...stylex.props(styles.headerActions)}
            >
              <ActionMenu
                label="Preview request"
                trigger="Requests"
                items={[
                  {
                    id: 'permission',
                    label: 'Permission request',
                    onSelect: () => store.requestPermission(),
                  },
                  {
                    id: 'question',
                    label: 'Question request',
                    onSelect: () => store.requestQuestion(),
                  },
                ]}
              />
              <IconButton
                aria-label={theme === 'dark' ? 'Light' : 'Dark'}
                variant="quiet"
                onClick={() => {
                  document.documentElement.dataset.themeSwitching = 'true'
                  const next = theme === 'dark' ? 'light' : 'dark'
                  setTheme(next)
                  const url = new URL(window.location.href)
                  url.searchParams.set('theme', next)
                  window.history.replaceState(null, '', url)
                  window.requestAnimationFrame(() =>
                    window.requestAnimationFrame(() => {
                      delete document.documentElement.dataset.themeSwitching
                    }),
                  )
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
            </nav>
          </div>
        </header>
      )}
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
          onRemoveAttachment={(attachment) =>
            store.removeAttachment(attachment)
          }
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
    return (
      <Loader label="Connecting to runtime" state={{ status: 'pending' }} />
    )
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
          Ask about the component system. This demo cannot access your
          workspace.
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
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  reviewHeader: {
    flexWrap: 'wrap',
    paddingBlock: space.x2,
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
  catalogIdentity: {
    display: 'flex',
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
    gap: space.x4,
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
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    lineHeight: type.lineHeading,
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
})

const themeStyles = stylex.create({
  light: {
    colorScheme: 'light',
  },
  dark: {
    colorScheme: 'dark',
  },
})
