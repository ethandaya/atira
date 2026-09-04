import type { ChatTurn, TurnState } from '@pretty-amped/foundations/chat'
import {
  colors,
  motion,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Shimmer, VisuallyHidden } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

import {
  MessageParts,
  type ToolActions,
  type ToolRenderer,
} from './message-parts'

type NativeListItemProps = Omit<
  ComponentPropsWithRef<'li'>,
  'children' | 'className' | 'style'
>

export type TurnProps = NativeListItemProps & {
  actions?: ReactNode
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
  turn: ChatTurn
}

export function Turn({
  actions,
  toolActions,
  toolRenderers,
  turn,
  ...props
}: TurnProps) {
  const active =
    turn.state.status === 'running' || turn.state.status === 'retrying'
  const assistant = turn.assistant.filter((message) =>
    message.parts.some(isRenderableAssistantPart),
  )
  const hasAssistantContent = assistant.length > 0

  return (
    <li
      {...props}
      aria-busy={active || undefined}
      data-slot="turn"
      data-state={turn.state.status}
      data-turn-id={turn.id}
      {...stylex.props(styles.root)}
    >
      <article aria-label="Conversation turn" {...stylex.props(styles.article)}>
        <section
          aria-label="Your message"
          data-message-id={turn.user.id}
          data-slot="turn-user"
          {...stylex.props(styles.user)}
        >
          <MessageParts
            message={turn.user}
            {...(toolActions === undefined ? {} : { toolActions })}
            {...(toolRenderers === undefined ? {} : { toolRenderers })}
          />
        </section>

        <div data-slot="turn-assistant" {...stylex.props(styles.assistant)}>
          {assistant.map((message) => (
            <section
              aria-label="Assistant message"
              data-message-id={message.id}
              data-slot="turn-assistant-message"
              key={message.id}
              {...stylex.props(
                styles.assistantMessage,
                active && styles.activeAssistantMessage,
              )}
            >
              <MessageParts
                message={message}
                {...(toolActions === undefined ? {} : { toolActions })}
                {...(toolRenderers === undefined ? {} : { toolRenderers })}
              />
            </section>
          ))}
          {(!active || !hasAssistantContent) && <TurnStatus state={turn.state} />}
        </div>

        {(turn.agent || turn.model || actions) && (
          <footer data-slot="turn-meta" {...stylex.props(styles.meta)}>
            <span>
              {turn.agent?.label}
              {turn.agent && turn.model ? ' · ' : ''}
              {turn.model?.label}
            </span>
            {actions}
          </footer>
        )}
      </article>
    </li>
  )
}

export function TurnStatus({ state }: { state: TurnState }) {
  const label = turnStateLabel(state)
  const active = state.status === 'running' || state.status === 'retrying'

  if (state.status === 'complete') {
    return <VisuallyHidden>Response complete.</VisuallyHidden>
  }

  return (
    <p
      role={state.status === 'failed' ? 'alert' : 'status'}
      data-slot="turn-status"
      data-state={state.status}
      {...stylex.props(
        styles.status,
        state.status === 'failed' && styles.statusDanger,
      )}
    >
      {active ? <Shimmer>{label}</Shimmer> : label}
      {state.status === 'failed' && (
        <span {...stylex.props(styles.error)}>{state.error.message}</span>
      )}
    </p>
  )
}

function turnStateLabel(state: TurnState) {
  switch (state.status) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Thinking'
    case 'retrying':
      return `Retrying · attempt ${state.attempt}`
    case 'complete':
      return 'Complete'
    case 'interrupted':
      return state.reason ?? 'Stopped'
    case 'failed':
      return 'Response failed'
  }
}

function isRenderableAssistantPart(
  part: ChatTurn['assistant'][number]['parts'][number],
) {
  if (part.type === 'text') return part.markdown.trim().length > 0
  if (part.type === 'tool') return part.presentation.kind !== 'todo'
  if (part.type === 'reasoning') return true
  return true
}

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const styles = stylex.create({
  root: {
    inlineSize: '100%',
    scrollMarginBlock: space.x6,
  },
  article: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    inlineSize: '100%',
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.surface,
    boxSizing: 'border-box',
    maxInlineSize: 'min(82%, 64ch)',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  assistant: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    minInlineSize: 0,
  },
  assistantMessage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
  },
  activeAssistantMessage: {
    animationDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    animationName: {
      default: fadeIn,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationTimingFunction: 'ease-out',
  },
  meta: {
    alignItems: 'center',
    color: colors.textMuted,
    display: 'flex',
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    fontVariantNumeric: 'tabular-nums',
    gap: space.x2,
    justifyContent: 'flex-start',
    lineHeight: type.lineCompact,
  },
  status: {
    alignItems: 'center',
    boxSizing: 'border-box',
    color: colors.textMuted,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    gap: space.x1,
    lineHeight: type.lineBody,
    margin: 0,
    minBlockSize: {
      default: '2rem',
      '@media (hover: none)': '2.75rem',
    },
    justifyContent: 'center',
  },
  statusDanger: {
    color: colors.danger,
  },
  error: {
    color: colors.textMuted,
  },
})
