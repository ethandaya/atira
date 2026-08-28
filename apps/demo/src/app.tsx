import {
  Activity,
  Composer,
  Message,
  Outcome,
  PermissionRequest,
  Response,
  Thread,
  ToolActivity,
  type PermissionRequestState,
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
type View = 'workflow' | 'components'
type Decision = 'approve' | 'reject'
type ComposerStatus = 'idle' | 'submitting'
type DemoReplyState = 'idle' | 'streaming' | 'complete' | 'interrupted'

const requestCopy = {
  consequence: 'reversible' as const,
  effect:
    'Write the first conversation and agent-state components to this local workspace. Existing source files may be updated.',
  headingLevel: 2 as const,
  id: 'write-component-wave',
  title: 'Allow these component changes?',
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [view, setView] = useState<View>('workflow')
  const [requestState, setRequestState] =
    useState<PermissionRequestState>({ status: 'pending' })
  const [draft, setDraft] = useState('')
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null)
  const [composerStatus, setComposerStatus] =
    useState<ComposerStatus>('idle')
  const [replyState, setReplyState] = useState<DemoReplyState>('idle')
  const requestTimer = useRef<number | undefined>(undefined)
  const replyTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      window.clearTimeout(requestTimer.current)
      window.clearTimeout(replyTimer.current)
    }
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

  function decide(decision: Decision) {
    setRequestState({ status: 'submitting', decision })

    requestTimer.current = window.setTimeout(() => {
      setRequestState({
        status: 'resolved',
        decision: decision === 'approve' ? 'approved' : 'rejected',
      })
    }, 500)
  }

  function submitMessage(value: string) {
    window.clearTimeout(replyTimer.current)
    setSubmittedMessage(value)
    setDraft('')
    setComposerStatus('submitting')
    setReplyState('streaming')

    replyTimer.current = window.setTimeout(() => {
      setComposerStatus('idle')
      setReplyState('complete')
    }, 700)
  }

  function stopReply() {
    window.clearTimeout(replyTimer.current)
    setComposerStatus('idle')
    setReplyState('interrupted')
  }

  const activityState =
    requestState.status === 'pending'
      ? ({ status: 'waiting' } as const)
      : requestState.status === 'submitting'
        ? ({ status: 'running' } as const)
        : requestState.status === 'resolved' &&
            requestState.decision === 'approved'
          ? ({ status: 'succeeded' } as const)
          : ({ status: 'cancelled' } as const)

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
              {view === 'workflow' ? 'Initial component wave' : 'Components'}
            </h1>
            <span {...stylex.props(styles.product)}>Pretty Amped</span>
          </div>
          <div {...stylex.props(styles.headerActions)}>
            <Button
              onClick={() =>
                setView((currentView) =>
                  currentView === 'workflow' ? 'components' : 'workflow',
                )
              }
              size="compact"
              variant="quiet"
            >
              {view === 'workflow' ? 'Components' : 'Workflow'}
            </Button>
            <Button
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
              size="compact"
              variant="quiet"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          </div>
        </div>
      </header>

      {view === 'workflow' ? (
        <div {...stylex.props(styles.workspace)}>
          <main {...stylex.props(styles.scroller)}>
            <div {...stylex.props(styles.transcript)}>
              <Thread label="Component library implementation thread">
              <Message actor="user">
                Build the first AI interface components. Keep them minimal,
                explicit, and accessible.
              </Message>

              <Message actor="assistant">
                <Response status="complete">
                  <p {...stylex.props(styles.responseText)}>
                    I’m starting with the conversation and agent-state layer, then
                    composing it into one small workflow instead of a component
                    gallery.
                  </p>

                  <div {...stylex.props(styles.workflow)}>
                    <ToolActivity
                      id="reference-review"
                      state={{ status: 'succeeded' }}
                      summary="Compared the reference systems"
                      tool="research"
                    >
                      <ul {...stylex.props(styles.evidenceList)}>
                        <li>shadcn — source ownership and restrained controls</li>
                        <li>AICSS — AI-specific states and compact surfaces</li>
                        <li>
                          Fluid Functionalism — substrate, motion, and lighter
                          message anatomy
                        </li>
                      </ul>
                    </ToolActivity>

                    <Activity
                      detail="Eight controlled React components with stable state and slot markers."
                      id="component-boundary"
                      label="Defined the component boundary"
                      state={activityState}
                    />

                    {requestState.status === 'pending' ? (
                      <PermissionRequest
                        {...requestCopy}
                        state={requestState}
                        onApprove={() => decide('approve')}
                        onReject={() => decide('reject')}
                      />
                    ) : (
                      <PermissionRequest {...requestCopy} state={requestState} />
                    )}

                    {requestState.status === 'resolved' &&
                      (requestState.decision === 'approved' ? (
                        <Outcome
                          headingLevel={2}
                          id="component-wave-outcome"
                          state={{ status: 'reviewable' }}
                          title="Components ready for review"
                        >
                          The initial wave is composed and can now be evaluated as
                          one human-and-agent workflow.
                        </Outcome>
                      ) : (
                        <Outcome
                          headingLevel={2}
                          id="component-wave-outcome"
                          state={{ status: 'blocked' }}
                          title="Changes were not allowed"
                        >
                          The workflow stopped at the permission boundary.
                        </Outcome>
                      ))}
                  </div>
                </Response>
              </Message>

              {submittedMessage && (
                <Message actor="user">{submittedMessage}</Message>
              )}

              {replyState !== 'idle' && (
                <Message actor="assistant">
                  {replyState === 'streaming' ? (
                    <Response status="streaming">
                      <Activity
                        id="demo-response"
                        label="Preparing a controlled response"
                        state={{ status: 'running' }}
                      />
                    </Response>
                  ) : replyState === 'interrupted' ? (
                    <Response status="interrupted">
                      The demo request was stopped before completion.
                    </Response>
                  ) : (
                    <Response status="complete">
                      The composer emitted a named submit action; the demo fixture
                      owns this response state. The component itself owns no timer,
                      network request, or model runtime.
                    </Response>
                  )}
                </Message>
              )}
              </Thread>
            </div>
          </main>

          <div {...stylex.props(styles.composerDock)}>
            <div {...stylex.props(styles.composerWrap)}>
              {composerStatus === 'submitting' ? (
                <Composer
                  onStop={stopReply}
                  onSubmit={submitMessage}
                  onValueChange={setDraft}
                  status="submitting"
                  value={draft}
                />
              ) : (
                <Composer
                  onSubmit={submitMessage}
                  onValueChange={setDraft}
                  status="idle"
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
    maxInlineSize: '60rem',
  },
  identity: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
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
      default: space.x4,
      '@media (min-width: 48rem)': space.x8,
    },
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  responseText: {
    margin: 0,
    maxInlineSize: '65ch',
  },
  workflow: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    inlineSize: '100%',
    paddingBlockStart: space.x2,
  },
  evidenceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
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
})

const themeStyles = stylex.create({
  light: {
    colorScheme: 'light',
  },
  dark: {
    colorScheme: 'dark',
  },
})
