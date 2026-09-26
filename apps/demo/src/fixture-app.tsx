import { ChatSession } from '@atira/blocks'
import { darkTheme, lightTheme } from '@atira/foundations/themes'
import { ActionMenu, IconButton } from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'
import { Moon, Sun } from 'lucide-react'
import { Profiler, useEffect, useState } from 'react'

import { appStyles, themeStyles } from './app-styles'
import { FixtureChatStore } from './fixture-chat-store'

type FixtureMetrics = {
  commitDurations: number[]
  getNotificationCount: () => number
  longTasks?: number[]
  longTaskObserver?: PerformanceObserver
}

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

export function FixtureApp({ mode }: { mode: 'workflow' | 'stress' }) {
  const [store] = useState(() => new FixtureChatStore(mode))
  const [metrics] = useState<FixtureMetrics>(() => ({
    commitDurations: [],
    getNotificationCount: store.getNotificationCount,
  }))
  const parameters = new URLSearchParams(window.location.search)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    parameters.get('theme') === 'dark' ? 'dark' : 'light',
  )
  const review = parameters.has('review')
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

  function toggleTheme() {
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
  }

  return (
    <div
      data-fixture={mode}
      data-theme={theme}
      dir={direction}
      {...stylex.props(
        theme === 'dark' ? darkTheme : lightTheme,
        appStyles.app,
        themeStyles[theme],
      )}
    >
      {review && (
        <header {...stylex.props(appStyles.header)}>
          <div {...stylex.props(appStyles.headerInner, appStyles.reviewHeader)}>
            <span {...stylex.props(appStyles.runtimeMeta)}>
              Local fixture · no external actions
            </span>
            <nav
              aria-label="Design review"
              {...stylex.props(appStyles.headerActions)}
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
                onClick={toggleTheme}
                variant="quiet"
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
