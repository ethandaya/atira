import { Turn, type ToolRenderer } from '@pretty-amped/components'
import type {
  ChatTurn,
  HistoryState,
  SessionActivity,
} from '@pretty-amped/foundations/chat'
import {
  colors,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react'

export type FollowState =
  | { status: 'following' }
  | { pendingCount: number; status: 'detached' }
  | { anchorId: string; offset: number; status: 'restoring' }

export type TimelineProps = {
  activity: SessionActivity
  empty?: ReactNode
  history: HistoryState
  label: string
  onFollowStateChange?: (state: FollowState) => void
  onLoadPrevious: () => Promise<void>
  toolRenderers?: readonly ToolRenderer[]
  turns: readonly ChatTurn[]
}

type ScrollAnchor = { id: string; offset: number }

export function Timeline({
  activity,
  empty = 'No messages yet.',
  history,
  label,
  onFollowStateChange,
  onLoadPrevious,
  toolRenderers,
  turns,
}: TimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pendingAnchor = useRef<ScrollAnchor | undefined>(undefined)
  const previousVersion = useRef('')
  const initialized = useRef(false)
  const [follow, setFollow] = useState<FollowState>({ status: 'following' })
  const version = useMemo(() => timelineVersion(turns), [turns])

  function changeFollow(next: FollowState) {
    setFollow(next)
    onFollowStateChange?.(next)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    if (pendingAnchor.current) {
      const anchor = pendingAnchor.current
      const element = viewport.querySelector<HTMLElement>(
        `[data-turn-id="${CSS.escape(anchor.id)}"]`,
      )
      if (element) viewport.scrollTop += element.getBoundingClientRect().top - anchor.offset
      pendingAnchor.current = undefined
      changeFollow({ pendingCount: 0, status: 'detached' })
      return
    }

    if (follow.status === 'following') {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [version])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      previousVersion.current = version
      return
    }
    if (version === previousVersion.current) return
    previousVersion.current = version

    if (follow.status === 'detached') {
      const next = {
        pendingCount: Math.max(1, turns.length - visibleTurnCount(viewportRef.current)),
        status: 'detached' as const,
      }
      changeFollow(next)
    }
  }, [follow, turns.length, version])

  async function loadPrevious() {
    const viewport = viewportRef.current
    if (!viewport || history.status === 'loading-previous') return

    const firstVisible = firstVisibleTurn(viewport)
    if (firstVisible) {
      pendingAnchor.current = firstVisible
      changeFollow({
        anchorId: firstVisible.id,
        offset: firstVisible.offset,
        status: 'restoring',
      })
    }

    await onLoadPrevious()
  }

  function trackScroll(event: UIEvent<HTMLDivElement>) {
    if (follow.status === 'restoring') return
    const viewport = event.currentTarget
    const atBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48

    if (atBottom && follow.status !== 'following') {
      changeFollow({ status: 'following' })
    } else if (!atBottom && follow.status === 'following') {
      changeFollow({ pendingCount: 0, status: 'detached' })
    }
  }

  function jumpToLatest() {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ behavior: 'auto', top: viewport.scrollHeight })
    changeFollow({ status: 'following' })
  }

  return (
    <section
      aria-label={label}
      data-follow-state={follow.status}
      data-slot="timeline"
      {...stylex.props(styles.root)}
    >
      <div
        ref={viewportRef}
        onScroll={trackScroll}
        data-slot="timeline-viewport"
        {...stylex.props(styles.viewport)}
      >
        <div {...stylex.props(styles.measure)}>
          <HistoryControl history={history} onLoadPrevious={loadPrevious} />
          {turns.length === 0 ? (
            <p data-slot="timeline-empty" {...stylex.props(styles.empty)}>
              {empty}
            </p>
          ) : (
            <ol data-slot="timeline-list" {...stylex.props(styles.list)}>
              {turns.map((turn) => (
                <Turn
                  key={turn.id}
                  turn={turn}
                  {...(toolRenderers === undefined ? {} : { toolRenderers })}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
      {follow.status === 'detached' && (
        <JumpToLatest
          onJump={jumpToLatest}
          pendingCount={follow.pendingCount}
        />
      )}
      <VisuallyHidden aria-live="polite" role="status">
        {activityAnnouncement(activity)}
      </VisuallyHidden>
    </section>
  )
}

export type HistoryControlProps = {
  history: HistoryState
  onLoadPrevious: () => void
}

export function HistoryControl({ history, onLoadPrevious }: HistoryControlProps) {
  if (history.status === 'complete') return null
  if (history.status === 'initial-loading') {
    return <p {...stylex.props(styles.historyText)}>Loading conversation…</p>
  }
  if (history.status === 'loading-previous') {
    return <p role="status" {...stylex.props(styles.historyText)}>Loading earlier messages…</p>
  }
  if (history.status === 'failed') {
    return (
      <div role="alert" {...stylex.props(styles.historyFailure)}>
        <span>{history.error.message}</span>
        {history.canRetry && (
          <Button onClick={onLoadPrevious} size="compact" variant="quiet">
            Retry
          </Button>
        )}
      </div>
    )
  }
  if (!history.hasPrevious) return null

  return (
    <div {...stylex.props(styles.historyControl)}>
      <Button onClick={onLoadPrevious} size="compact" variant="quiet">
        Load earlier messages
      </Button>
    </div>
  )
}

export type JumpToLatestProps = {
  onJump: () => void
  pendingCount: number
}

export function JumpToLatest({ onJump, pendingCount }: JumpToLatestProps) {
  return (
    <div data-slot="jump-to-latest" {...stylex.props(styles.jump)}>
      <div {...stylex.props(styles.jumpButton)}>
        <Button onClick={onJump} size="compact" variant="outline">
          {pendingCount > 0 ? `${pendingCount} new · ` : ''}Jump to latest
        </Button>
      </div>
    </div>
  )
}

function timelineVersion(turns: readonly ChatTurn[]) {
  const latest = turns[turns.length - 1]
  const assistant = latest?.assistant[latest.assistant.length - 1]
  const latestPart = assistant?.parts[assistant.parts.length - 1]
  const contentLength =
    latestPart?.type === 'text'
      ? latestPart.markdown.length
      : latestPart?.type === 'reasoning'
        ? latestPart.text.length
        : 0
  return `${turns.length}:${latest?.id ?? ''}:${assistant?.parts.length ?? 0}:${contentLength}:${latest?.state.status ?? ''}`
}

function firstVisibleTurn(viewport: HTMLElement): ScrollAnchor | undefined {
  const viewportTop = viewport.getBoundingClientRect().top
  const turns = viewport.querySelectorAll<HTMLElement>('[data-turn-id]')
  for (const turn of turns) {
    if (turn.getBoundingClientRect().bottom > viewportTop) {
      return { id: turn.dataset.turnId ?? '', offset: turn.getBoundingClientRect().top }
    }
  }
  return undefined
}

function visibleTurnCount(viewport: HTMLElement | null) {
  if (!viewport) return 0
  const bottom = viewport.getBoundingClientRect().bottom
  return [...viewport.querySelectorAll<HTMLElement>('[data-turn-id]')].filter(
    (turn) => turn.getBoundingClientRect().top < bottom,
  ).length
}

function activityAnnouncement(activity: SessionActivity) {
  if (activity.status === 'busy') return 'Response started.'
  if (activity.status === 'retrying') return `Response retrying, attempt ${activity.attempt}.`
  return 'Response complete.'
}

const styles = stylex.create({
  root: {
    blockSize: '100%',
    minBlockSize: 0,
    position: 'relative',
  },
  viewport: {
    blockSize: '100%',
    minBlockSize: 0,
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    scrollBehavior: 'auto',
  },
  measure: {
    boxSizing: 'border-box',
    marginInline: 'auto',
    maxInlineSize: '46rem',
    minBlockSize: '100%',
    paddingBlock: space.x6,
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x8,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlock: space.x8,
    textAlign: 'center',
  },
  historyControl: {
    display: 'flex',
    justifyContent: 'center',
    paddingBlockEnd: space.x6,
  },
  historyText: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    margin: 0,
    paddingBlockEnd: space.x6,
    textAlign: 'center',
  },
  historyFailure: {
    alignItems: 'center',
    color: colors.danger,
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x2,
    justifyContent: 'center',
    paddingBlockEnd: space.x6,
  },
  jump: {
    insetBlockEnd: space.x4,
    insetInline: 0,
    pointerEvents: 'none',
    position: 'absolute',
    textAlign: 'center',
    zIndex: 2,
  },
  jumpButton: {
    display: 'inline-flex',
    pointerEvents: 'auto',
  },
})
