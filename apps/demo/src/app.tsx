import {
  PermissionRequest,
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

type Theme = 'light' | 'dark'
type Decision = 'approve' | 'reject'

export function App() {
  const [theme, setTheme] = useState<Theme>('light')
  const [requestState, setRequestState] =
    useState<PermissionRequestState>({ status: 'pending' })
  const pendingResolution = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => window.clearTimeout(pendingResolution.current)
  }, [])

  function decide(decision: Decision) {
    setRequestState({ status: 'submitting', decision })

    pendingResolution.current = window.setTimeout(() => {
      setRequestState({
        status: 'resolved',
        decision: decision === 'approve' ? 'approved' : 'rejected',
      })
    }, 500)
  }

  function resetRequest() {
    window.clearTimeout(pendingResolution.current)
    setRequestState({ status: 'pending' })
  }

  const requestProps = {
    consequence: 'reversible' as const,
    effect:
      'Run pnpm build in this local project. The command may read source files and replace generated build output.',
    headingLevel: 3 as const,
    id: 'demo-build-approval',
    title: 'Allow the agent to build this project?',
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
      <main {...stylex.props(styles.main)}>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.intro)}>
            <h1 {...stylex.props(styles.heading)}>Pretty Amped</h1>
            <p {...stylex.props(styles.description)}>
              A StyleX-first React component system for agent interfaces.
            </p>
          </div>
          <Button
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            variant="secondary"
          >
            Use {theme === 'dark' ? 'light' : 'dark'} theme
          </Button>
        </header>

        <section aria-labelledby="permission-example" {...stylex.props(styles.demo)}>
          <div {...stylex.props(styles.demoHeading)}>
            <h2 id="permission-example" {...stylex.props(styles.sectionTitle)}>
              Permission request
            </h2>
            <p {...stylex.props(styles.sectionDescription)}>
              Controlled application state, explicit effects, and stable semantic
              slots.
            </p>
          </div>

          {requestState.status === 'pending' ? (
            <PermissionRequest
              {...requestProps}
              state={requestState}
              onApprove={() => decide('approve')}
              onReject={() => decide('reject')}
            />
          ) : (
            <PermissionRequest {...requestProps} state={requestState} />
          )}

          {(requestState.status === 'resolved' ||
            requestState.status === 'expired') && (
            <div {...stylex.props(styles.reset)}>
              <Button onClick={resetRequest} variant="quiet">
                Reset request
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

const styles = stylex.create({
  app: {
    backgroundColor: colors.canvas,
    color: colors.text,
    fontFamily: type.family,
    minHeight: '100dvh',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      default: '3.5rem',
      '@media (min-width: 48rem)': '5rem',
    },
    marginInline: 'auto',
    maxWidth: '68rem',
    paddingBlock: {
      default: space.x6,
      '@media (min-width: 48rem)': '3.5rem',
    },
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x8,
    },
  },
  header: {
    alignItems: {
      default: 'flex-start',
      '@media (min-width: 36rem)': 'center',
    },
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 36rem)': 'row',
    },
    gap: space.x4,
    justifyContent: 'space-between',
  },
  intro: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  heading: {
    fontSize: {
      default: '1.5rem',
      '@media (min-width: 48rem)': '1.75rem',
    },
    fontWeight: type.weightStrong,
    letterSpacing: '-0.025em',
    lineHeight: type.lineCompact,
    margin: 0,
    textWrap: 'balance',
  },
  description: {
    color: colors.textMuted,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    maxWidth: '42rem',
  },
  demo: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x5,
  },
  demoHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    maxWidth: '34rem',
    width: '100%',
  },
  sectionTitle: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  reset: {
    display: 'flex',
    justifyContent: 'flex-end',
    maxWidth: '34rem',
    width: '100%',
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
