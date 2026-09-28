import type { ChatTurn, TurnState } from '@atiraui/foundations/chat'
import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import { LayoutGroup, Spinner, VisuallyHidden } from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithRef, ReactNode } from 'react'

import {
  AssistantSequence,
  MessageParts,
  type ToolActions,
  type ToolRenderer,
} from './message-parts'

type NativeListItemProps = Omit<
  ComponentPropsWithRef<'li'>,
  'children' | 'className' | 'style'
>

export type TurnProps = NativeListItemProps & {
  activityPresentation?: 'expanded' | 'summary'
  actions?: ReactNode
  toolActions?: ToolActions
  toolRenderers?: readonly ToolRenderer[]
  turn: ChatTurn
}

function getTurnPresentation(turn: ChatTurn) {
  const active = ['queued', 'running', 'retrying'].includes(turn.state.status)
  const assistant = turn.assistant.filter((message) =>
    message.parts.some(isRenderableAssistantPart),
  )
  const hasActiveIndicator = turn.assistant.some((message) =>
    message.parts.some(isActiveAssistantIndicator),
  )
  const lastPart = turn.assistant.at(-1)?.parts.at(-1)
  const hasStreamingText =
    lastPart?.type === 'text' &&
    lastPart.state.status === 'streaming' &&
    lastPart.markdown.trim().length > 0

  return {
    active,
    assistant,
    showPending:
      active &&
      (turn.state.status !== 'running' ||
        !(hasActiveIndicator || hasStreamingText)),
  }
}

export function Turn({
  activityPresentation = 'expanded',
  actions,
  toolActions,
  toolRenderers,
  turn,
  ...props
}: TurnProps) {
  const { active, assistant, showPending } = getTurnPresentation(turn)

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

        <LayoutGroup id={turn.id}>
          <div data-slot="turn-assistant" {...stylex.props(styles.assistant)}>
            <ResponseIdentity agent={turn.agent} model={turn.model} />
            <AssistantSequence
              messages={assistant}
              activityPresentation={activityPresentation}
              pending={
                showPending ? (
                  <TurnStatus
                    state={turn.state}
                    compact={assistant.length > 0}
                  />
                ) : undefined
              }
              {...(toolActions === undefined ? {} : { toolActions })}
              {...(toolRenderers === undefined ? {} : { toolRenderers })}
            />
            {!active && (
              <TurnStatus state={turn.state} compact={assistant.length > 0} />
            )}
          </div>
        </LayoutGroup>

        {actions && (
          <footer data-slot="turn-meta" {...stylex.props(styles.meta)}>
            {actions}
          </footer>
        )}
      </article>
    </li>
  )
}

function ResponseIdentity({
  agent,
  model,
}: {
  agent: ChatTurn['agent'] | undefined
  model: ChatTurn['model'] | undefined
}) {
  if (!agent && !model) return null
  return (
    <div
      aria-label="Response author"
      role="group"
      data-slot="turn-identity"
      {...stylex.props(styles.identity)}
    >
      {agent && (
        <span data-slot="turn-agent" {...stylex.props(styles.agentName)}>
          <VisuallyHidden>Agent: </VisuallyHidden>
          {agent.label}
        </span>
      )}
      {model && (
        <span data-slot="turn-model" {...stylex.props(styles.modelName)}>
          <VisuallyHidden>Model: </VisuallyHidden>
          {model.label}
        </span>
      )}
    </div>
  )
}

export function TurnStatus({
  state,
  compact = false,
}: {
  state: TurnState
  compact?: boolean
}) {
  const label = turnStateLabel(state)
  const active =
    state.status === 'queued' ||
    state.status === 'running' ||
    state.status === 'retrying'

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
        active && styles.statusActive,
        active && compact && styles.statusCompact,
        state.status === 'failed' && styles.statusDanger,
      )}
    >
      {active && <Spinner size="small" />}
      <span>{label}</span>
      {active && (
        <span aria-hidden="true" {...stylex.props(styles.statusEnd)} />
      )}
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
      return 'Working'
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

function isActiveAssistantIndicator(
  part: ChatTurn['assistant'][number]['parts'][number],
) {
  if (part.type === 'reasoning') return part.state.status === 'streaming'
  if (part.type !== 'tool' || part.presentation.kind === 'todo') return false
  return (
    part.state.status === 'receiving-input' ||
    part.state.status === 'queued' ||
    part.state.status === 'running'
  )
}

const styles = stylex.create({
  root: {
    inlineSize: '100%',
    scrollMarginBlock: space.x6,
  },
  article: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    inlineSize: '100%',
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.surface,
    boxSizing: 'border-box',
    maxInlineSize: 'min(88%, 36rem)',
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  assistant: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    minInlineSize: 0,
    position: 'relative',
  },
  identity: {
    alignItems: 'baseline',
    color: colors.textMuted,
    display: 'flex',
    flexWrap: 'wrap',
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    columnGap: space.x2,
    rowGap: space.x1,
    marginBlockEnd: space.x1,
    minBlockSize: '1.25rem',
    minInlineSize: 0,
  },
  agentName: {
    color: colors.text,
    fontWeight: type.weightMedium,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  modelName: {
    fontWeight: type.weightRegular,
    minInlineSize: 0,
    overflowWrap: 'anywhere',
  },
  meta: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
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
    },
    justifyContent: 'center',
  },
  statusActive: {
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: '1rem minmax(0, 1fr) 1rem',
    justifyContent: 'normal',
    minBlockSize: {
      default: '2.125rem',
      '@media (hover: none)': '2.875rem',
    },
    paddingBlock: space.x1,
    paddingInline: 0,
  },
  statusEnd: {
    blockSize: '1rem',
    inlineSize: '1rem',
  },
  statusCompact: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minBlockSize: '2rem',
    padding: 0,
  },
  statusDanger: {
    color: colors.danger,
  },
  error: {
    color: colors.textMuted,
  },
})
