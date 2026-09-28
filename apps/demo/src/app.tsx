import { ChatSession, useChatStore } from '@atiraui/blocks'
import { Loader, Outcome, Suggestion, Suggestions } from '@atiraui/components'
import { darkTheme, lightTheme } from '@atiraui/foundations/themes'
import { colors, space, type } from '@atiraui/foundations/tokens.stylex'
import { ActionMenu, Button, IconButton } from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check, History, LockKeyhole, Moon, Plus, Sun } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { ChatGptSignin, useChatGptSignin } from './chatgpt-signin'
import { FixtureApp } from './fixture-app'
import {
  createDraft,
  NanocodexChatStore,
  type RuntimeState,
} from './nanocodex-store'

type Theme = 'light' | 'dark'

const promptSuggestions = [
  'Why StyleX for AI interfaces?',
  'Audit a streaming response',
  'Design an approval flow',
]

export function App() {
  const fixtureMode = new URLSearchParams(window.location.search).get('fixture')
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_TEST_FIXTURES === 'true' &&
    (fixtureMode === 'workflow' || fixtureMode === 'stress')
  ) {
    return <FixtureApp mode={fixtureMode} />
  }
  return <Playground />
}

function getRuntimeLabel(runtime: RuntimeState) {
  if (runtime.status === 'ready') return `${runtime.runtime} · ${runtime.model}`
  if (runtime.status === 'loading') return 'Connecting to runtime…'
  return 'Runtime unavailable'
}

function getConversationItems(
  store: NanocodexChatStore,
  conversations: ReturnType<NanocodexChatStore['getConversations']>,
  sessionId: string,
) {
  const history = [...conversations]
    .reverse()
    .filter(
      (conversation) =>
        conversation.turns.length > 0 ||
        conversation.title !== 'New conversation',
    )
    .map((conversation) => ({
      id: conversation.id,
      label: conversation.title,
      disabled: conversation.id === sessionId,
      ...(conversation.id === sessionId ? { icon: <Check size={16} /> } : {}),
      onSelect: () => store.selectConversation(conversation.id),
    }))
  return [
    {
      id: 'new',
      label: 'New conversation',
      icon: <Plus size={16} />,
      onSelect: () => store.newConversation(),
    },
    ...(history.length > 0
      ? history
      : [
          {
            id: 'empty',
            label: 'No saved conversations yet',
            disabled: true,
            onSelect: () => undefined,
          },
        ]),
  ]
}

export function Playground({
  layout = 'standalone',
  theme: controlledTheme,
}: {
  layout?: 'standalone' | 'page'
  theme?: Theme
}) {
  const embedded = layout === 'page'
  const [localTheme, setLocalTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  const theme = controlledTheme ?? localTheme
  const [store] = useState(() => new NanocodexChatStore())
  const signin = useChatGptSignin(store)
  const authenticated = signin.status?.state === 'authenticated'
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

  function openExplorer() {
    window.location.assign('/components')
  }

  useEffect(() => {
    if (!embedded) document.title = 'Playground: Atira'
    void store.initialize()
    window.addEventListener('pagehide', store.persist)
    return () => {
      window.removeEventListener('pagehide', store.persist)
      store.dispose()
    }
  }, [embedded, store])

  function toggleTheme() {
    document.documentElement.dataset.themeSwitching = 'true'
    setLocalTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    )

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        delete document.documentElement.dataset.themeSwitching
      })
    })
  }

  const runtimeLabel = getRuntimeLabel(runtime)
  const controlsDisabled =
    snapshot.activity.status !== 'idle' || runtime.status === 'loading'
  const sessionControlsDisabled = controlsDisabled || !authenticated
  const currentConversation = conversations.find(
    (conversation) => conversation.id === snapshot.sessionId,
  )
  const conversationItems = getConversationItems(
    store,
    conversations,
    snapshot.sessionId,
  )

  return (
    <div
      data-theme={theme}
      {...stylex.props(
        theme === 'dark' ? darkTheme : lightTheme,
        styles.app,
        layout === 'page' && styles.pageApp,
        themeStyles[theme],
      )}
    >
      <PlaygroundHeader
        controlsDisabled={controlsDisabled}
        conversationItems={conversationItems}
        currentTitle={currentConversation?.title ?? 'New conversation'}
        embedded={embedded}
        onNewConversation={() => store.newConversation()}
        onOpenExplorer={openExplorer}
        onToggleTheme={toggleTheme}
        runtime={runtime}
        runtimeLabel={runtimeLabel}
        sessionControlsDisabled={sessionControlsDisabled}
        signin={signin}
        theme={theme}
      />

      <PlaygroundWorkspace
        authenticated={authenticated}
        embedded={embedded}
        modelCount={snapshot.capabilities.models.length}
        runtime={runtime}
        runtimeLabel={runtimeLabel}
        sessionId={snapshot.sessionId}
        store={store}
      />
    </div>
  )
}

type PlaygroundHeaderProps = {
  controlsDisabled: boolean
  conversationItems: ReturnType<typeof getConversationItems>
  currentTitle: string
  embedded: boolean
  onNewConversation: () => void
  onOpenExplorer: () => void
  onToggleTheme: () => void
  runtime: RuntimeState
  runtimeLabel: string
  sessionControlsDisabled: boolean
  signin: ReturnType<typeof useChatGptSignin>
  theme: Theme
}

function PlaygroundHeader(props: PlaygroundHeaderProps) {
  if (props.embedded) return <PageToolbar {...props} />
  return <StandaloneToolbar {...props} />
}

function StandaloneToolbar({
  controlsDisabled,
  conversationItems,
  onOpenExplorer,
  onToggleTheme,
  runtime,
  sessionControlsDisabled,
  signin,
  theme,
}: PlaygroundHeaderProps) {
  const dark = theme === 'dark'
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.headerInner)}>
        <div {...stylex.props(styles.identity)}>
          <h1 {...stylex.props(styles.title)}>Atira</h1>
          <span {...stylex.props(styles.product)}>Playground</span>
        </div>
        <nav aria-label="Demo views" {...stylex.props(styles.headerActions)}>
          <RuntimeSignin
            controlsDisabled={controlsDisabled}
            runtime={runtime}
            signin={signin}
          />
          <ActionMenu
            label="Conversations"
            disabled={sessionControlsDisabled}
            trigger={<History size={16} strokeWidth={1.75} />}
            items={conversationItems}
          />
          <Button
            aria-label="Explorer"
            onClick={onOpenExplorer}
            title="Component explorer"
            variant="quiet"
          >
            Explorer
          </Button>
          <IconButton
            aria-label={dark ? 'Light' : 'Dark'}
            aria-pressed={dark}
            iconSize="small"
            onClick={onToggleTheme}
            title={dark ? 'Use light theme' : 'Use dark theme'}
            variant="quiet"
          >
            {dark ? (
              <Sun size={16} strokeWidth={1.75} />
            ) : (
              <Moon size={16} strokeWidth={1.75} />
            )}
          </IconButton>
        </nav>
      </div>
    </header>
  )
}

function PageToolbar({
  controlsDisabled,
  conversationItems,
  currentTitle,
  onNewConversation,
  runtime,
  runtimeLabel,
  sessionControlsDisabled,
  signin,
}: PlaygroundHeaderProps) {
  return (
    <header {...stylex.props(styles.pageToolbar)}>
      <div {...stylex.props(styles.pageSession)}>
        <span {...stylex.props(styles.pageSessionTitle)}>{currentTitle}</span>
        <span {...stylex.props(styles.runtimeMeta)}>{runtimeLabel}</span>
      </div>
      <nav
        aria-label="Conversation controls"
        {...stylex.props(styles.headerActions)}
      >
        <RuntimeSignin
          controlsDisabled={controlsDisabled}
          runtime={runtime}
          signin={signin}
        />
        <IconButton
          aria-label="New conversation"
          disabled={sessionControlsDisabled}
          iconSize="small"
          onClick={onNewConversation}
          title="New conversation"
          variant="quiet"
        >
          <Plus size={16} strokeWidth={1.75} />
        </IconButton>
        <ActionMenu
          label="Conversation history"
          disabled={sessionControlsDisabled}
          trigger={<History size={16} strokeWidth={1.75} />}
          items={conversationItems}
        />
      </nav>
    </header>
  )
}

function RuntimeSignin({
  controlsDisabled,
  runtime,
  signin,
}: Pick<PlaygroundHeaderProps, 'controlsDisabled' | 'runtime' | 'signin'>) {
  if (runtime.status === 'loading') return null
  return <ChatGptSignin disabled={controlsDisabled} signin={signin} />
}

function PlaygroundWorkspace({
  authenticated,
  embedded,
  modelCount,
  runtime,
  runtimeLabel,
  sessionId,
  store,
}: {
  authenticated: boolean
  embedded: boolean
  modelCount: number
  runtime: RuntimeState
  runtimeLabel: string
  sessionId: string
  store: NanocodexChatStore
}) {
  if (!authenticated) {
    return (
      <div {...stylex.props(styles.workspace)}>
        <LockedPlayground />
      </div>
    )
  }
  const composerActions =
    modelCount === 0 ? (
      <span
        {...stylex.props(
          styles.runtimeMeta,
          runtime.status === 'unavailable' && styles.runtimeError,
        )}
      >
        {runtimeLabel}
      </span>
    ) : undefined
  return (
    <div {...stylex.props(styles.workspace)}>
      <ChatSession
        key={sessionId}
        composerActions={composerActions}
        empty={
          <EmptyPlayground
            embedded={embedded}
            runtime={runtime}
            store={store}
          />
        }
        label="Playground conversation"
        store={store}
      />
    </div>
  )
}

function LockedPlayground() {
  return (
    <div role="status" {...stylex.props(styles.lockedPlayground)}>
      <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.75} />
      <span>Sign in with your ChatGPT subscription.</span>
    </div>
  )
}

function EmptyPlayground({
  embedded,
  runtime,
  store,
}: {
  embedded: boolean
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
      {!embedded && (
        <div {...stylex.props(styles.emptyCopy)}>
          <h2 {...stylex.props(styles.emptyTitle)}>Start a conversation</h2>
          <p {...stylex.props(styles.emptyDescription)}>
            Ask about the component system. This demo cannot access your
            workspace.
          </p>
        </div>
      )}
      <Suggestions xstyle={embedded ? styles.embeddedSuggestions : undefined}>
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
  pageApp: {
    backgroundColor: colors.surface,
    blockSize: '100%',
    minBlockSize: 0,
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
  pageToolbar: {
    alignItems: 'center',
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: '1px',
    display: 'flex',
    flexShrink: 0,
    gap: space.x4,
    justifyContent: 'space-between',
    minBlockSize: '3.25rem',
    paddingInline: space.x3,
  },
  pageSession: {
    display: 'flex',
    flexDirection: 'column',
    minInlineSize: 0,
  },
  pageSessionTitle: {
    color: colors.text,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  embeddedSuggestions: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    overflowX: 'visible',
    transform: 'translateY(1.5rem)',
  },
  lockedPlayground: {
    alignItems: 'center',
    blockSize: '100%',
    color: colors.textMuted,
    display: 'flex',
    fontSize: type.sizeSmall,
    gap: space.x2,
    justifyContent: 'center',
    minBlockSize: 0,
    padding: space.x4,
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
