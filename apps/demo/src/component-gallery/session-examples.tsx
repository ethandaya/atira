import {
  ChatComposer,
  Composer,
  PermissionPrompt,
  PromptHistory,
  QuestionRequest,
  QueueList,
  RevertDock,
  TodoDock,
  Turn,
} from '@atira/components'
import type {
  ComposerDraft,
  PermissionRequestView,
  QuestionRequestView,
  QueuedPrompt,
  RevertedPrompt,
  SessionActivity,
} from '@atira/foundations/chat'
import { composerDraftText } from '@atira/foundations/chat-invariants'
import { colors } from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'

import { createDraft } from '../fixtures/chat-fixture'
import { ComponentSample, GroupHeading } from './gallery-layout'
import { galleryStyles } from './gallery-styles.stylex'
import {
  galleryCapabilities,
  galleryCommands,
  galleryDraft,
  galleryPermission,
  galleryPromptHistory,
  galleryQuestion,
  galleryQueue,
  galleryReferences,
  galleryRevert,
  galleryTodos,
  galleryTurn,
} from './session-fixtures'

export function SessionExamples() {
  return (
    <section
      aria-labelledby="chat-heading"
      id="gallery-compositions"
      {...stylex.props(galleryStyles.group)}
    >
      <GroupHeading
        id="chat-heading"
        title="Full compositions"
        description="Protocol-neutral turn rendering, requests, session state, and structured input."
      />
      <div {...stylex.props(galleryStyles.grid)}>
        <ComponentSample
          title="Turn and message parts"
          description="One semantic turn with grouped context, specialized tools, reasoning, and Markdown."
          wide
        >
          <ol {...stylex.props(styles.turnPreview)}>
            <Turn turn={galleryTurn} />
          </ol>
        </ComponentSample>
        <ComponentSample
          title="PermissionPrompt"
          description="Exact once, always, and reject decisions with visible consequences."
          wide
        >
          <PermissionPromptExample />
        </ComponentSample>
        <ComponentSample
          title="QuestionRequest"
          description="Stable question and option IDs across choice and freeform answers."
          apiNotes="Keep request, question, and option IDs stable so answers can be reconciled with runtime state."
          wide
        >
          <QuestionRequestExample />
        </ComponentSample>
        <ComponentSample
          title="TodoDock and RevertDock"
          description="Canonical session tasks and a recoverable reverted prompt."
          wide
        >
          <DocksExample />
        </ComponentSample>
        <ComponentSample
          title="QueueList"
          description="Queued follow-ups can be retried, removed, or restored to the composer."
          apiNotes="The host owns queue state, draft restoration, submission intents, and stop behavior."
          wide
        >
          <QueueExample />
        </ComponentSample>
      </div>
    </section>
  )
}

const styles = stylex.create({
  focusTarget: {
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineOffset: '3px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
  },
  turnPreview: { listStyle: 'none', margin: 0, padding: 0 },
})

function PermissionPromptExample() {
  const [request, setRequest] =
    useState<PermissionRequestView>(galleryPermission)
  const resultRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={resultRef}
      data-example-focus-target="permission-result"
      tabIndex={-1}
      {...stylex.props(styles.focusTarget)}
    >
      <PermissionPrompt
        onDecision={(decision) => {
          setRequest((current) => ({
            ...current,
            state: { decision, status: 'resolved' },
          }))
          requestAnimationFrame(() => resultRef.current?.focus())
        }}
        request={request}
      />
    </div>
  )
}

function QuestionRequestExample() {
  const [request, setRequest] = useState<QuestionRequestView>(galleryQuestion)
  const resultRef = useRef<HTMLDivElement>(null)

  function focusResult() {
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  return (
    <div
      ref={resultRef}
      data-example-focus-target="question-result"
      tabIndex={-1}
      {...stylex.props(styles.focusTarget)}
    >
      <QuestionRequest
        onAnswer={(response) => {
          setRequest((current) => ({
            ...current,
            state: {
              decision: { response, type: 'answer' },
              status: 'resolved',
            },
          }))
          focusResult()
        }}
        onReject={() => {
          setRequest((current) => ({
            ...current,
            state: { decision: { type: 'reject' }, status: 'resolved' },
          }))
          focusResult()
        }}
        request={request}
      />
    </div>
  )
}

function DocksExample() {
  const [reverted, setReverted] = useState<RevertedPrompt | undefined>(
    galleryRevert,
  )
  const [draft, setDraft] = useState<string>()
  const [outcome, setOutcome] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const outcomeRef = useRef<HTMLParagraphElement>(null)
  return (
    <div {...stylex.props(galleryStyles.stack)}>
      <TodoDock defaultOpen todos={galleryTodos} />
      {reverted && (
        <RevertDock
          onDismiss={() => {
            setReverted(undefined)
            setOutcome('Reverted prompt dismissed.')
            requestAnimationFrame(() => outcomeRef.current?.focus())
          }}
          onRestore={(item) => {
            setDraft(composerDraftText(item.draft))
            setReverted(undefined)
            setOutcome('Reverted prompt restored for editing.')
            requestAnimationFrame(() => composerRef.current?.focus())
          }}
          reverted={reverted}
        />
      )}
      {draft !== undefined && (
        <Composer
          value={draft}
          onValueChange={setDraft}
          onSubmit={(value) => {
            setDraft('')
            setOutcome(`Submitted: ${value}`)
          }}
          textareaRef={composerRef}
        />
      )}
      {outcome && (
        <p
          ref={outcomeRef}
          role="status"
          tabIndex={-1}
          {...stylex.props(galleryStyles.sampleStatus, styles.focusTarget)}
        >
          {outcome}
        </p>
      )}
    </div>
  )
}

function QueueExample() {
  const [items, setItems] = useState<readonly QueuedPrompt[]>(galleryQueue)
  const [activity, setActivity] = useState<SessionActivity>({
    status: 'busy',
    turnId: galleryTurn.id,
  })
  const [draft, setDraft] = useState<ComposerDraft>(galleryDraft)
  const [outcome, setOutcome] = useState('')
  const composerRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  return (
    <div {...stylex.props(galleryStyles.stack)}>
      <QueueList
        items={items}
        onEdit={(item) => {
          setDraft((current) => ({
            ...item.draft,
            revision: current.revision + 1,
          }))
          setItems((current) =>
            current.filter((queued) => queued.id !== item.id),
          )
          setOutcome('Queued prompt restored for editing.')
          requestAnimationFrame(() =>
            composerRef.current?.querySelector('textarea')?.focus(),
          )
        }}
        onRemove={(item) => {
          setItems((current) =>
            current.filter((queued) => queued.id !== item.id),
          )
          setOutcome('Queued prompt removed.')
          requestAnimationFrame(() => statusRef.current?.focus())
        }}
        onRetry={(item) => {
          setItems((current) =>
            current.map((queued) =>
              queued.id === item.id
                ? { draft: queued.draft, id: queued.id, state: 'queued' }
                : queued,
            ),
          )
          setOutcome('Queued prompt queued for retry.')
          requestAnimationFrame(() => statusRef.current?.focus())
        }}
      />
      <div ref={composerRef} id="component-chatcomposer" tabIndex={-1}>
        <ChatComposer
          accept="image/*,.txt,.md"
          actions={
            <PromptHistory
              items={galleryPromptHistory}
              onRestore={(item) =>
                setDraft((current) => ({
                  ...item.draft,
                  revision: current.revision + 1,
                }))
              }
            />
          }
          activity={activity}
          capabilities={galleryCapabilities}
          commands={galleryCommands}
          draft={draft}
          onDraftChange={setDraft}
          onFilesAdd={(files) =>
            setDraft((current) => ({
              ...current,
              attachments: [
                ...current.attachments,
                ...files.map((file, index) => ({
                  attachment: {
                    id: `gallery-attachment:${current.revision}:${index}`,
                    kind: file.type.startsWith('image/')
                      ? ('image' as const)
                      : ('file' as const),
                    mediaType: file.type,
                    name: file.name,
                    size: file.size,
                  },
                  sourceId: file.name,
                  state: 'ready' as const,
                })),
              ],
              revision: current.revision + 1,
            }))
          }
          onRemoveAttachment={(attachment) =>
            setDraft((current) => ({
              ...current,
              attachments: current.attachments.filter(
                (item) => item.attachment.id !== attachment.attachment.id,
              ),
              revision: current.revision + 1,
            }))
          }
          onRemoveReference={(reference) =>
            setDraft((current) => ({
              ...current,
              revision: current.revision + 1,
              segments: current.segments.filter(
                (segment) => segment.id !== reference.id,
              ),
            }))
          }
          onStop={() => {
            setActivity({ status: 'idle' })
            setOutcome('Active response stopped.')
          }}
          onSubmit={(submitted, intent) => {
            const text = composerDraftText(submitted).trim()
            if (intent === 'queue') {
              setItems((current) => [
                ...current,
                {
                  draft: submitted,
                  id: `gallery-queue:${submitted.revision}`,
                  state: 'queued',
                },
              ])
              setOutcome(`Queued: ${text}`)
            } else {
              setActivity({ status: 'idle' })
              setOutcome(`Submitted: ${text}`)
            }
            setDraft(createDraft('', submitted.revision + 1))
          }}
          references={galleryReferences}
        />
      </div>
      <p
        ref={statusRef}
        data-example-focus-target="queue-status"
        role="status"
        tabIndex={-1}
        {...stylex.props(galleryStyles.sampleStatus, styles.focusTarget)}
      >
        {outcome || 'Queue the draft or stop the active response.'}
      </p>
    </div>
  )
}
