import {
  StreamStatus,
  Turn,
  type ToolActions,
  type ToolRenderer,
} from '@pretty-amped/components'
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
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  memo,
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
  estimatedTurnGap?: number
  estimatedTurnHeight?: number
  history: HistoryState
  label: string
  onFollowStateChange?: (state: FollowState) => void
  onLoadPrevious: () => Promise<void>
  renderTurnActions?: (turn: ChatTurn) => ReactNode
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
  turns: readonly ChatTurn[]
  virtualizeAfter?: number
}

type ScrollAnchor = { id: string; offset: number }
type WindowRange = { end: number; start: number }

export function Timeline({
  activity,
  empty = 'No messages yet.',
  estimatedTurnGap = 16,
  estimatedTurnHeight = 320,
  history,
  label,
  onFollowStateChange,
  onLoadPrevious,
  renderTurnActions,
  toolActions,
  toolRenderers,
  turns,
  virtualizeAfter = 100,
}: TimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const pendingAnchor = useRef<ScrollAnchor | undefined>(undefined)
  const previousVersion = useRef('')
  const previousTurnCount = useRef(turns.length)
  const measuredHeights = useRef(new Map<string, number>())
  const pinnedTurnIds = useRef(new Set<string>())
  const initialized = useRef(false)
  const [follow, setFollow] = useState<FollowState>({ status: 'following' })
  const followRef = useRef<FollowState>(follow)
  const [measurementVersion, setMeasurementVersion] = useState(0)
  const [windowRange, setWindowRange] = useState<WindowRange>({
    end: 0,
    start: 0,
  })
  const version = useMemo(() => timelineVersion(turns), [turns])
  const virtualized = turns.length > virtualizeAfter
  const range = normalizedRange(windowRange, turns.length, virtualized)
  const topSpacer = spacerHeight(
    turns,
    0,
    range.start,
    measuredHeights.current,
    estimatedTurnGap,
    estimatedTurnHeight,
  )
  const bottomSpacer = spacerHeight(
    turns,
    range.end,
    turns.length,
    measuredHeights.current,
    estimatedTurnGap,
    estimatedTurnHeight,
  )
  const visibleTurns = turns.slice(range.start, range.end)
  followRef.current = follow

  function changeFollow(next: FollowState) {
    setFollow(next)
    onFollowStateChange?.(next)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const previousTopSpacer = topSpacer
    let measured = false
    for (const element of viewport.querySelectorAll<HTMLElement>('[data-turn-id]')) {
      const id = element.dataset.turnId
      if (!id) continue
      const height = element.getBoundingClientRect().height
      if (height > 0 && measuredHeights.current.get(id) !== height) {
        measuredHeights.current.set(id, height)
        measured = true
      }
    }
    if (measured) {
      const nextTopSpacer = spacerHeight(
        turns,
        0,
        range.start,
        measuredHeights.current,
        estimatedTurnGap,
        estimatedTurnHeight,
      )
      if (follow.status !== 'following' && nextTopSpacer !== previousTopSpacer) {
        viewport.scrollTop += nextTopSpacer - previousTopSpacer
      }
      setMeasurementVersion((current) => current + 1)
    }

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
    updateVirtualWindow(viewport)
  }, [measurementVersion, range.end, range.start, version])

  useEffect(() => {
    const viewport = viewportRef.current
    const measure = measureRef.current
    if (!viewport || !measure || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      updateVirtualWindow(viewport)
      if (followRef.current.status === 'following' && !pendingAnchor.current) {
        viewport.scrollTop = viewport.scrollHeight
      }
    })
    observer.observe(viewport)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [turns.length, virtualized])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      previousVersion.current = version
      previousTurnCount.current = turns.length
      return
    }
    if (version === previousVersion.current) return
    previousVersion.current = version

    if (follow.status === 'detached') {
      const addedTurns = Math.max(0, turns.length - previousTurnCount.current)
      const next = {
        pendingCount:
          addedTurns > 0
            ? follow.pendingCount + addedTurns
            : Math.max(1, follow.pendingCount),
        status: 'detached' as const,
      }
      changeFollow(next)
    }
    previousTurnCount.current = turns.length
  }, [follow, turns.length, version])

  function updateVirtualWindow(viewport: HTMLElement) {
    if (!virtualized) return
    pinOpenOrFocusedTurns(viewport, pinnedTurnIds.current)
    const next = calculateWindowRange({
      estimatedTurnHeight,
      estimatedTurnGap,
      heights: measuredHeights.current,
      pinnedTurnIds: pinnedTurnIds.current,
      scrollTop: viewport.scrollTop,
      turns,
      viewportHeight: viewport.clientHeight,
    })
    setWindowRange((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    )
  }

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
    updateVirtualWindow(viewport)
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
      data-virtualized={virtualized || undefined}
      {...stylex.props(styles.root)}
    >
      <div
        ref={viewportRef}
        onScroll={trackScroll}
        data-slot="timeline-viewport"
        {...stylex.props(
          styles.viewport,
          follow.status === 'following' && styles.followingViewport,
        )}
      >
        <div ref={measureRef} {...stylex.props(styles.measure)}>
          <HistoryControl history={history} onLoadPrevious={loadPrevious} />
          {turns.length === 0 ? (
            <div data-slot="timeline-empty" {...stylex.props(styles.empty)}>
              {empty}
            </div>
          ) : (
            <ol data-slot="timeline-list" {...stylex.props(styles.list)}>
              {topSpacer > 0 && (
                <li
                  aria-hidden="true"
                  data-slot="timeline-spacer-start"
                  style={{ blockSize: topSpacer }}
                />
              )}
              {visibleTurns.map((turn, index) => (
                <TimelineTurn
                  key={turn.id}
                  pinnedTurnIds={pinnedTurnIds.current}
                  position={range.start + index + 1}
                  {...(renderTurnActions === undefined
                    ? {}
                    : { renderTurnActions })}
                  setSize={turns.length}
                  {...(toolActions === undefined ? {} : { toolActions })}
                  turn={turn}
                  {...(toolRenderers === undefined ? {} : { toolRenderers })}
                />
              ))}
              {bottomSpacer > 0 && (
                <li
                  aria-hidden="true"
                  data-slot="timeline-spacer-end"
                  style={{ blockSize: bottomSpacer }}
                />
              )}
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
      <StreamStatus activity={activity} />
    </section>
  )
}

const TimelineTurn = memo(function TimelineTurn({
  pinnedTurnIds,
  position,
  renderTurnActions,
  setSize,
  toolActions,
  toolRenderers,
  turn,
}: {
  pinnedTurnIds: Set<string>
  position: number
  renderTurnActions?: (turn: ChatTurn) => ReactNode
  setSize: number
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
  turn: ChatTurn
}) {
  return (
    <Turn
      aria-posinset={position}
      aria-setsize={setSize}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.querySelector('details[open]')
        ) {
          pinnedTurnIds.delete(turn.id)
        }
      }}
      onFocus={() => pinnedTurnIds.add(turn.id)}
      {...(renderTurnActions === undefined
        ? {}
        : { actions: renderTurnActions(turn) })}
      {...(toolActions === undefined ? {} : { toolActions })}
      turn={turn}
      {...(toolRenderers === undefined ? {} : { toolRenderers })}
    />
  )
})

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

function normalizedRange(
  range: WindowRange,
  turnCount: number,
  virtualized: boolean,
) {
  if (!virtualized) return { end: turnCount, start: 0 }
  if (range.end > range.start && range.end <= turnCount) return range
  return { end: turnCount, start: Math.max(0, turnCount - 24) }
}

function rangeHeight(
  turns: readonly ChatTurn[],
  start: number,
  end: number,
  heights: ReadonlyMap<string, number>,
  estimate: number,
) {
  let height = 0
  for (let index = start; index < end; index += 1) {
    const turn = turns[index]
    if (turn) height += heights.get(turn.id) ?? estimate
  }
  return height
}

function spacerHeight(
  turns: readonly ChatTurn[],
  start: number,
  end: number,
  heights: ReadonlyMap<string, number>,
  gap: number,
  estimate: number,
) {
  const count = Math.max(0, end - start)
  return rangeHeight(turns, start, end, heights, estimate) + Math.max(0, count - 1) * gap
}

function calculateWindowRange(input: {
  estimatedTurnGap: number
  estimatedTurnHeight: number
  heights: ReadonlyMap<string, number>
  pinnedTurnIds: ReadonlySet<string>
  scrollTop: number
  turns: readonly ChatTurn[]
  viewportHeight: number
}): WindowRange {
  const overscan = Math.max(800, input.viewportHeight)
  const minimum = Math.max(0, input.scrollTop - overscan)
  const maximum = input.scrollTop + input.viewportHeight + overscan
  let offset = 0
  let start = 0
  let end = input.turns.length

  for (let index = 0; index < input.turns.length; index += 1) {
    const turn = input.turns[index]
    if (!turn) continue
    const next = offset + (input.heights.get(turn.id) ?? input.estimatedTurnHeight)
    if (next < minimum) start = index + 1
    if (offset <= maximum) end = index + 1
    offset = next + input.estimatedTurnGap
  }

  for (const id of input.pinnedTurnIds) {
    const index = input.turns.findIndex((turn) => turn.id === id)
    if (index !== -1) {
      start = Math.min(start, index)
      end = Math.max(end, index + 1)
    }
  }

  return { end: Math.max(start + 1, end), start }
}

function pinOpenOrFocusedTurns(viewport: HTMLElement, pinned: Set<string>) {
  for (const turn of viewport.querySelectorAll<HTMLElement>('[data-turn-id]')) {
    const id = turn.dataset.turnId
    if (!id) continue
    if (turn.contains(document.activeElement) || turn.querySelector('details[open]')) {
      pinned.add(id)
    } else {
      pinned.delete(id)
    }
  }
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
    scrollbarGutter: 'stable both-edges',
  },
  followingViewport: {
    overflowAnchor: 'none',
  },
  measure: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    inlineSize: '100%',
    marginInline: 'auto',
    maxInlineSize: '52rem',
    minBlockSize: '100%',
    minInlineSize: 0,
    paddingBlock: space.x6,
    paddingInline: space.x4,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  empty: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'flex',
    flex: 1,
    fontFamily: type.family,
    fontSize: type.sizeBody,
    justifyContent: 'flex-end',
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlockEnd: space.x4,
    paddingBlockStart: space.x8,
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
