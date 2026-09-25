import { colors, space, type } from '@pretty-amped/foundations/tokens.stylex'
import type { ToolProgress } from '@pretty-amped/foundations/chat'
import {
  Disclosure,
  Spinner,
  StateTransition,
  TextTransition,
  VisuallyHidden,
  resolveStyleProps,
  type StyleProps,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check, Minus, ShieldAlert, X } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'

export type ToolActivityState =
  | { status: 'receiving-input' }
  | { status: 'queued' }
  | { progress?: ToolProgress; startedAt?: number; status: 'running' }
  | { status: 'awaiting-permission' }
  | { status: 'awaiting-approval' }
  | { status: 'succeeded' }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' }

type NativeDivProps = Omit<
  ComponentPropsWithRef<'div'>,
  'aria-label' | 'children' | 'className' | 'id' | 'style'
>

export type ToolActivityProps = NativeDivProps &
  StyleProps & {
    children?: ReactNode
    defaultOpen?: boolean
    id: string
    state: ToolActivityState
    summary: string
    /** Discrete activity changes, not streamed argument or timer updates. */
    summaryTransitionKey?: string
    tool: string
  }

const stateLabels: Record<ToolActivityState['status'], string> = {
  'awaiting-approval': 'Needs approval',
  'awaiting-permission': 'Needs permission',
  cancelled: 'Cancelled',
  failed: 'Failed',
  queued: 'Queued',
  'receiving-input': 'Preparing',
  running: 'Running',
  succeeded: 'Complete',
}

function useSummaryOverflow(summary: string) {
  const summaryRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const element = summaryRef.current
    if (!element) return
    const measure = () => {
      const current = element.querySelector<HTMLElement>(
        '[data-text-state]:not([aria-hidden="true"])',
      )
      setOverflowing((current ?? element).scrollWidth > element.clientWidth + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    const changes = new MutationObserver(measure)
    changes.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    return () => {
      observer.disconnect()
      changes.disconnect()
    }
  }, [summary])

  return { overflowing, summaryRef }
}

export function ToolActivity({
  children,
  className,
  defaultOpen,
  id,
  state,
  summary,
  summaryTransitionKey,
  style,
  tool,
  xstyle,
  ...props
}: ToolActivityProps) {
  const stateLabel = toolStateLabel(state)
  const active =
    state.status === 'receiving-input' ||
    state.status === 'queued' ||
    state.status === 'running'
  // Evidence is inspectable as soon as it exists, and stays mounted when work settles.
  const canDisclose = Boolean(children)

  return (
    <div
      {...props}
      id={id}
      role="group"
      aria-busy={active || undefined}
      aria-label={`${tool}: ${summary}`}
      data-slot="tool-activity"
      data-state={state.status}
      data-tool={tool}
      data-tool-activity-id={id}
      {...resolveStyleProps(styles.root, xstyle, className, style)}
    >
      {active && (
        <VisuallyHidden role="status">
          {summary}. {stateLabel}.
        </VisuallyHidden>
      )}
      <Disclosure
        disabled={!canDisclose}
        summary={
          <ToolActivityHeader
            active={active}
            state={state}
            stateLabel={stateLabel}
            summary={summary}
            summaryTransitionKey={summaryTransitionKey}
          />
        }
        variant="plain"
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
      >
        <div
          data-slot="tool-activity-evidence"
          {...stylex.props(styles.evidence)}
        >
          {children}
        </div>
      </Disclosure>
      {state.status === 'failed' && (
        <p role="alert" {...stylex.props(styles.error)}>
          {state.error}
        </p>
      )}
    </div>
  )
}

function ToolActivityHeader({
  active,
  state,
  stateLabel,
  summary,
  summaryTransitionKey,
}: {
  active: boolean
  state: ToolActivityState
  stateLabel: string
  summary: string
  summaryTransitionKey: string | undefined
}) {
  const { overflowing, summaryRef } = useSummaryOverflow(summary)
  return (
    <span data-slot="tool-activity-header" {...stylex.props(styles.header)}>
      <span
        data-slot="tool-activity-state"
        {...stylex.props(
          styles.state,
          state.status === 'failed' && styles.stateDanger,
        )}
      >
        <StateTransition state={state.status}>
          {toolStateMark(state)}
        </StateTransition>
        {state.status === 'succeeded' && (
          <VisuallyHidden>{stateLabel}</VisuallyHidden>
        )}
      </span>
      <span {...stylex.props(styles.heading)}>
        <span
          ref={summaryRef}
          data-slot="tool-activity-summary"
          data-overflowing={overflowing || undefined}
          {...stylex.props(
            styles.summary,
            overflowing && styles.summaryFade,
            !active && state.status !== 'failed' && styles.summaryComplete,
            state.status === 'failed' && styles.summaryFailed,
          )}
        >
          {summaryTransitionKey === undefined ? (
            summary
          ) : (
            <TextTransition state={summaryTransitionKey}>
              {summary}
            </TextTransition>
          )}
        </span>
      </span>
      <ToolActivityStatus state={state} stateLabel={stateLabel} />
    </span>
  )
}

function ToolActivityStatus({
  state,
  stateLabel,
}: {
  state: ToolActivityState
  stateLabel: string
}) {
  const progressLabel =
    state.status === 'running' && state.progress && stateLabel !== 'Running'
      ? stateLabel.replace(/^Running · /, '')
      : null
  return (
    <span
      data-slot="tool-activity-status"
      {...stylex.props(styles.statusLabel)}
    >
      <TextTransition state={state.status}>
        {state.status !== 'succeeded' && (
          <span {...stylex.props(styles.statusLabel)}>
            {state.status === 'running' ? (
              <>
                <VisuallyHidden>Running</VisuallyHidden>
                {progressLabel}
              </>
            ) : (
              stateLabel
            )}
            {state.status === 'running' && state.startedAt !== undefined && (
              <ElapsedTime startedAt={state.startedAt} />
            )}
          </span>
        )}
      </TextTransition>
    </span>
  )
}

function toolStateLabel(state: ToolActivityState) {
  if (state.status !== 'running' || !state.progress) {
    return stateLabels[state.status]
  }
  const { current, label, total } = state.progress
  const count =
    current === undefined
      ? undefined
      : total === undefined
        ? String(current)
        : `${current}/${total}`
  return [label ?? 'Running', count].filter(Boolean).join(' · ')
}

function toolStateMark(state: ToolActivityState) {
  switch (state.status) {
    case 'receiving-input':
    case 'queued':
      return <Minus aria-hidden="true" size={14} />
    case 'running':
      return <Spinner size="small" />
    case 'awaiting-permission':
    case 'awaiting-approval':
      return <ShieldAlert aria-hidden="true" size={14} />
    case 'succeeded':
      return (
        <Check
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    case 'failed':
      return (
        <X
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    case 'cancelled':
      return (
        <Minus
          aria-hidden="true"
          data-slot="tool-state-icon"
          strokeWidth={1.75}
          {...stylex.props(styles.stateIcon)}
        />
      )
    default:
      return undefined
  }
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <span aria-label="Elapsed time">
      {Math.max(0, Math.floor((now - startedAt) / 1000))}s
    </span>
  )
}

const styles = stylex.create({
  root: {
    color: colors.text,
    fontFamily: type.family,
    inlineSize: '100%',
  },
  header: {
    alignItems: 'center',
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: '1rem minmax(0, 1fr) auto',
    maxInlineSize: '100%',
    minInlineSize: 0,
  },
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    flex: '0 1 auto',
    flexWrap: 'nowrap',
    gap: space.x2,
    minInlineSize: 0,
  },
  summary: {
    color: colors.text,
    flexGrow: 1,
    fontSize: type.sizeSmall,
    fontWeight: type.weightRegular,
    lineHeight: type.lineBody,
    minInlineSize: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  summaryFade: {
    maskImage: {
      default:
        'linear-gradient(to right, oklch(0 0 0) calc(100% - 2rem), oklch(0 0 0 / 0.85) calc(100% - 1.4rem), oklch(0 0 0 / 0.35) calc(100% - 0.6rem), transparent)',
      ':is([dir="rtl"] *)':
        'linear-gradient(to left, oklch(0 0 0) calc(100% - 2rem), oklch(0 0 0 / 0.85) calc(100% - 1.4rem), oklch(0 0 0 / 0.35) calc(100% - 0.6rem), transparent)',
    },
  },
  summaryComplete: {
    color: colors.textMuted,
    fontWeight: type.weightRegular,
  },
  summaryFailed: {
    color: colors.danger,
  },
  state: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    justifyContent: 'center',
    lineHeight: type.lineCompact,
    minBlockSize: '0.875rem',
    minInlineSize: '0.875rem',
  },
  stateIcon: {
    blockSize: '0.875rem',
    inlineSize: '0.875rem',
  },
  statusLabel: {
    color: colors.textMuted,
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x1,
    fontSize: type.sizeCaption,
    fontVariantNumeric: 'tabular-nums',
    justifyContent: 'flex-end',
    maxInlineSize: '12ch',
  },
  stateDanger: {
    color: colors.danger,
  },
  evidence: {
    color: colors.textMuted,
    marginInlineStart: space.x2,
    overflow: 'auto',
    paddingBlock: space.x1,
    paddingInlineEnd: 0,
    paddingInlineStart: space.x4,
  },
  error: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlock: space.x2,
    paddingInlineStart: '1.375rem',
  },
})
