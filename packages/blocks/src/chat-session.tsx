import {
  ChatComposer,
  ConnectionNotice,
  PromptHistory,
  QueueList,
  RequestRegion,
  RevertDock,
  SubmissionError,
  type ChatComposerProps,
  type ComposerCommand,
  type ComposerReference,
  type PromptHistoryItem,
  type ToolRenderer,
} from '@pretty-amped/components'
import type {
  ChatStore,
  ChatTurn,
  DraftAttachment,
  DraftSegment,
} from '@pretty-amped/foundations/chat'
import { colors, space } from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useMemo, type ReactNode } from 'react'

import { useChatStore } from './chat-store'
import { Timeline } from './timeline'

export type ChatSessionProps = {
  accept?: string
  commands?: readonly ComposerCommand[]
  composerActions?: ReactNode
  empty?: ReactNode
  history?: readonly PromptHistoryItem[]
  label: string
  onFilesAdd?: ChatComposerProps['onFilesAdd']
  onOpenChild?: (sessionId: string) => void
  onRemoveAttachment?: (attachment: DraftAttachment) => void
  onRemoveReference?: (
    segment: Extract<DraftSegment, { type: 'reference' }>,
  ) => void
  onRetryAttachment?: (attachment: DraftAttachment) => void
  references?: readonly ComposerReference[]
  renderTurnActions?: (turn: ChatTurn) => ReactNode
  showRevertActions?: boolean
  store: ChatStore
  toolRenderers?: readonly ToolRenderer[]
}

export function ChatSession({
  accept,
  commands,
  composerActions,
  empty,
  history,
  label,
  onFilesAdd,
  onOpenChild,
  onRemoveAttachment,
  onRemoveReference,
  onRetryAttachment,
  references,
  renderTurnActions,
  showRevertActions = false,
  store,
  toolRenderers,
}: ChatSessionProps) {
  const snapshot = useChatStore(store)
  const activeTurnId =
    snapshot.activity.status === 'idle' ? undefined : snapshot.activity.turnId
  const reverted = snapshot.revertedPrompt
  const resolvedTurnActions = useMemo(
    () =>
      renderTurnActions || showRevertActions
        ? (turn: ChatTurn) => (
            <>
              {renderTurnActions?.(turn)}
              {showRevertActions && turn.state.status !== 'queued' && (
                <Button
                  aria-label={`Revert prompt ${turn.id}`}
                  onClick={() => run(store.revert(turn.id))}
                  size="compact"
                  variant="quiet"
                >
                  Revert
                </Button>
              )}
            </>
          )
        : undefined,
    [renderTurnActions, showRevertActions, store],
  )
  const toolActions = useMemo(
    () => (onOpenChild ? { onOpenChild } : {}),
    [onOpenChild],
  )
  const resolvedComposerActions = useMemo(
    () =>
      composerActions || (history && history.length > 0) ? (
        <>
          {composerActions}
          {history && history.length > 0 && (
            <PromptHistory
              items={history}
              onRestore={(item) => store.updateDraft(item.draft)}
            />
          )}
        </>
      ) : undefined,
    [composerActions, history, store],
  )
  const dock = useMemo(
    () => (
      <div data-slot="chat-session-dock" {...stylex.props(styles.dock)}>
        <div {...stylex.props(styles.dockMeasure)}>
          {snapshot.submissionError && (
            <SubmissionError
              error={snapshot.submissionError}
              onDismiss={() => store.dismissSubmissionError()}
              onRetry={() => run(store.retrySubmission())}
            />
          )}
          <RequestRegion
            draftRevision={snapshot.composer.revision}
            onPermissionDecision={(request, decision) =>
              run(
                store.decidePermission({
                  decision,
                  originSessionId: request.origin.sessionId,
                  requestId: request.id,
                }),
              )
            }
            onQuestionAnswer={(request, response) =>
              run(
                store.answerQuestion({
                  originSessionId: request.origin.sessionId,
                  requestId: request.id,
                  response,
                }),
              )
            }
            onQuestionReject={(request) =>
              run(
                store.rejectQuestion({
                  originSessionId: request.origin.sessionId,
                  requestId: request.id,
                }),
              )
            }
            permissionDecisions={snapshot.capabilities.permissionDecisions}
            requests={snapshot.requests}
            {...(reverted === undefined
              ? {}
              : {
                  reverted: (
                    <RevertDock
                      onDismiss={() => run(store.dismissReverted(reverted))}
                      onRedo={() => run(store.redoReverted(reverted))}
                      onRestore={() => run(store.restoreReverted(reverted))}
                      reverted={reverted}
                    />
                  ),
                })}
            {...(snapshot.todos === undefined ? {} : { todos: snapshot.todos })}
          >
            <QueueList
              items={snapshot.queue}
              onEdit={(item) => store.editQueued(item)}
              onRemove={(item) => store.removeQueued(item)}
              onRetry={(item) => run(store.retryQueued(item))}
            />
            <ChatComposer
              {...(accept === undefined ? {} : { accept })}
              {...(resolvedComposerActions === undefined
                ? {}
                : { actions: resolvedComposerActions })}
              activity={snapshot.activity}
              capabilities={snapshot.capabilities}
              {...(commands === undefined ? {} : { commands })}
              draft={snapshot.composer}
              onDraftChange={(draft) => store.updateDraft(draft)}
              {...(onFilesAdd === undefined ? {} : { onFilesAdd })}
              {...(onRemoveAttachment === undefined
                ? {}
                : { onRemoveAttachment })}
              {...(onRemoveReference === undefined
                ? {}
                : { onRemoveReference })}
              {...(onRetryAttachment === undefined
                ? {}
                : { onRetryAttachment })}
              onStop={() => {
                if (activeTurnId) run(store.stop(activeTurnId))
              }}
              onSubmit={(draft, intent) => run(store.submit(draft, intent))}
              {...(references === undefined ? {} : { references })}
            />
          </RequestRegion>
        </div>
      </div>
    ),
    [
      accept,
      activeTurnId,
      commands,
      onFilesAdd,
      onRemoveAttachment,
      onRemoveReference,
      onRetryAttachment,
      references,
      resolvedComposerActions,
      reverted,
      snapshot.activity,
      snapshot.capabilities,
      snapshot.composer,
      snapshot.queue,
      snapshot.requests,
      snapshot.submissionError,
      snapshot.todos,
      store,
    ],
  )

  return (
    <section
      aria-label={label}
      data-connection-state={snapshot.connection.status}
      data-session-id={snapshot.sessionId}
      data-slot="chat-session"
      {...stylex.props(styles.root)}
    >
      <ConnectionNotice
        onRetry={() => run(store.reconnect())}
        state={snapshot.connection}
      />
      <div data-slot="chat-session-timeline" {...stylex.props(styles.timeline)}>
        <Timeline
          activity={snapshot.activity}
          {...(empty === undefined ? {} : { empty })}
          history={snapshot.history}
          label={`${label} transcript`}
          onLoadPrevious={() => store.loadPrevious()}
          {...(resolvedTurnActions === undefined
            ? {}
            : { renderTurnActions: resolvedTurnActions })}
          toolActions={toolActions}
          {...(toolRenderers === undefined ? {} : { toolRenderers })}
          turns={snapshot.turns}
        />
      </div>

      {dock}
    </section>
  )
}

function run(task: Promise<void>) {
  void task.catch(() => undefined)
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.canvas,
    blockSize: '100%',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    inlineSize: '100%',
    minBlockSize: 0,
  },
  timeline: {
    gridRow: 2,
    minBlockSize: 0,
  },
  dock: {
    backgroundColor: colors.canvas,
    gridRow: 3,
    paddingBlockEnd: 'max(env(safe-area-inset-bottom), 0px)',
  },
  dockMeasure: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
    marginInline: 'auto',
    maxInlineSize: '52rem',
    minInlineSize: 0,
    paddingBlockEnd: space.x3,
    paddingBlockStart: space.x2,
    paddingInline: space.x4,
  },
})
