import { ChatSession, useChatStore } from '@pretty-amped/blocks'
import { Loader, Outcome, Suggestion, Suggestions } from '@pretty-amped/components'
import { darkTheme, lightTheme } from '@pretty-amped/foundations/themes'
import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { ComponentGallery } from './component-gallery'
import {
  createDraft,
  NanocodexChatStore,
  type RuntimeState,
} from './nanocodex-store'

type Theme = 'light' | 'dark'
type View = 'playground' | 'components'

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
      ? `${runtime.runtime} · ${runtime.model} · read-only catalog tool`
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
                disabled={
                  snapshot.turns.length === 0 ||
                  snapshot.activity.status !== 'idle'
                }
                onClick={() => void store.clear()}
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
            label="Nanocodex playground conversation"
            store={store}
          />
        </div>
      ) : (
        <ComponentGallery />
      )}
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
