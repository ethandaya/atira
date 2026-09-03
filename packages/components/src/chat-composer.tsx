import type {
  ChatCapabilities,
  ChatError,
  ComposerDraft,
  DraftAttachment,
  DraftSegment,
  QueuedPrompt,
  SessionActivity,
  SubmitIntent,
} from '@pretty-amped/foundations/chat'
import { composerDraftText } from '@pretty-amped/foundations/chat-invariants'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import { Button, TextareaField } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export type ChatComposerProps = {
  actions?: ReactNode
  activity: SessionActivity
  capabilities: ChatCapabilities
  draft: ComposerDraft
  error?: ChatError
  onDraftChange: (draft: ComposerDraft) => void
  onRemoveAttachment?: (attachment: DraftAttachment) => void
  onRemoveReference?: (segment: Extract<DraftSegment, { type: 'reference' }>) => void
  onRetryAttachment?: (attachment: DraftAttachment) => void
  onStop: () => void
  onSubmit: (draft: ComposerDraft, intent: SubmitIntent) => void
  placeholder?: string
}

export function ChatComposer({
  actions,
  activity,
  capabilities,
  draft,
  error,
  onDraftChange,
  onRemoveAttachment,
  onRemoveReference,
  onRetryAttachment,
  onStop,
  onSubmit,
  placeholder,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const value = composerDraftText(draft)
  const intent = submitIntent(activity, capabilities)
  const canSubmit =
    intent !== undefined &&
    (value.trim().length > 0 || draft.attachments.some((item) => item.state === 'ready'))

  function updateText(next: string) {
    const control = textareaRef.current
    onDraftChange(
      replaceDraftText(
        draft,
        next,
        control?.selectionStart ?? next.length,
        control?.selectionEnd ?? next.length,
      ),
    )
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit && intent) onSubmit(draft, intent)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function setMode(mode: ComposerDraft['mode']) {
    onDraftChange({ ...draft, mode, revision: draft.revision + 1 })
  }

  return (
    <form
      aria-label="Message composer"
      data-mode={draft.mode}
      data-slot="chat-composer"
      data-state={activity.status}
      onSubmit={submit}
      {...stylex.props(styles.root, draft.mode === 'shell' && styles.shell)}
    >
      <ReferenceTray
        draft={draft}
        {...(onRemoveReference === undefined
          ? {}
          : { onRemove: onRemoveReference })}
      />
      <AttachmentTray
        attachments={draft.attachments}
        {...(onRemoveAttachment === undefined
          ? {}
          : { onRemove: onRemoveAttachment })}
        {...(onRetryAttachment === undefined
          ? {}
          : { onRetry: onRetryAttachment })}
      />
      <TextareaField
        autoComplete="off"
        label={draft.mode === 'shell' ? 'Shell command' : 'Message'}
        labelHidden
        onKeyDown={onKeyDown}
        onValueChange={updateText}
        placeholder={
          placeholder ??
          (draft.mode === 'shell' ? 'Run a shell command…' : 'Ask anything…')
        }
        ref={textareaRef}
        rows={1}
        spellCheck={draft.mode === 'prompt'}
        value={value}
        variant="plain"
      />

      {error && (
        <p role="alert" data-slot="submission-error" {...stylex.props(styles.error)}>
          {error.message}
        </p>
      )}

      <div data-slot="chat-composer-toolbar" {...stylex.props(styles.toolbar)}>
        <div data-slot="chat-composer-context-actions" {...stylex.props(styles.leading)}>
          {capabilities.canUseShell && (
            <Button
              aria-pressed={draft.mode === 'shell'}
              onClick={() => setMode(draft.mode === 'shell' ? 'prompt' : 'shell')}
              size="compact"
              variant="quiet"
            >
              {draft.mode === 'shell' ? 'Prompt' : 'Shell'}
            </Button>
          )}
          {actions}
        </div>

        <div data-slot="chat-composer-model-controls" {...stylex.props(styles.trailing)}>
          {(draft.agent || draft.model) && (
            <span {...stylex.props(styles.selection)}>
              {draft.agent?.label}
              {draft.agent && draft.model ? ' · ' : ''}
              {draft.model?.label}
            </span>
          )}
          {activity.status !== 'idle' && capabilities.canStop && (
            <Button onClick={onStop} size="compact" variant="outline">
              Stop
            </Button>
          )}
          <Button
            disabled={!canSubmit}
            size="compact"
            type="submit"
            variant="primary"
          >
            {submitLabel(intent)}
          </Button>
        </div>
      </div>
      <p {...stylex.props(styles.hint)}>Ctrl/⌘ + Enter to submit</p>
    </form>
  )
}

export type AttachmentTrayProps = {
  attachments: readonly DraftAttachment[]
  onRemove?: (attachment: DraftAttachment) => void
  onRetry?: (attachment: DraftAttachment) => void
}

export function AttachmentTray({
  attachments,
  onRemove,
  onRetry,
}: AttachmentTrayProps) {
  if (attachments.length === 0) return null

  return (
    <ul
      aria-label="Attachments"
      data-slot="attachment-tray"
      {...stylex.props(styles.tray)}
    >
      {attachments.map((item) => (
        <li
          data-attachment-id={item.attachment.id}
          data-state={item.state}
          key={item.attachment.id}
          {...stylex.props(styles.trayItem)}
        >
          <span dir="auto" {...stylex.props(styles.trayLabel)}>
            {item.attachment.name}
          </span>
          <span {...stylex.props(styles.trayState)}>
            {item.state === 'reading'
              ? 'Reading'
              : item.state === 'failed'
                ? 'Failed'
                : 'Ready'}
          </span>
          {item.state === 'failed' && onRetry && (
            <Button onClick={() => onRetry(item)} size="compact" variant="quiet">
              Retry
            </Button>
          )}
          {onRemove && (
            <Button onClick={() => onRemove(item)} size="compact" variant="quiet">
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ReferenceTray({
  draft,
  onRemove,
}: {
  draft: ComposerDraft
  onRemove?: (segment: Extract<DraftSegment, { type: 'reference' }>) => void
}) {
  const references = draft.segments.filter(
    (segment): segment is Extract<DraftSegment, { type: 'reference' }> =>
      segment.type === 'reference',
  )
  if (references.length === 0) return null

  return (
    <ul aria-label="References" data-slot="reference-tray" {...stylex.props(styles.tray)}>
      {references.map((reference) => (
        <li
          data-reference-id={reference.id}
          data-reference-type={reference.referenceType}
          key={reference.id}
          {...stylex.props(styles.reference)}
        >
          <span dir="ltr" {...stylex.props(styles.trayLabel)}>
            @{reference.label}
          </span>
          {onRemove && (
            <Button
              aria-label={`Remove ${reference.label}`}
              onClick={() => onRemove(reference)}
              size="compact"
              variant="quiet"
            >
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export type QueueListProps = {
  items: readonly QueuedPrompt[]
  onEdit?: (item: QueuedPrompt) => void
  onRemove?: (item: QueuedPrompt) => void
  onRetry?: (item: QueuedPrompt) => void
}

export function QueueList({
  items,
  onEdit,
  onRemove,
  onRetry,
}: QueueListProps) {
  if (items.length === 0) return null

  return (
    <section aria-label="Queued prompts" data-slot="queue-list" {...stylex.props(styles.queue)}>
      <p {...stylex.props(styles.queueTitle)}>Queued · {items.length}</p>
      <ol {...stylex.props(styles.queueItems)}>
        {items.map((item) => (
          <li
            data-queue-id={item.id}
            data-state={item.state}
            key={item.id}
            {...stylex.props(styles.queueItem)}
          >
            <span {...stylex.props(styles.queueText)}>
              {composerDraftText(item.draft) || 'Attachment prompt'}
            </span>
            <span {...stylex.props(styles.trayState)}>{item.state}</span>
            <div {...stylex.props(styles.queueActions)}>
              {item.state === 'failed' && onRetry && (
                <Button onClick={() => onRetry(item)} size="compact" variant="quiet">
                  Retry
                </Button>
              )}
              {onEdit && (
                <Button onClick={() => onEdit(item)} size="compact" variant="quiet">
                  Edit
                </Button>
              )}
              {onRemove && (
                <Button onClick={() => onRemove(item)} size="compact" variant="quiet">
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function submitIntent(
  activity: SessionActivity,
  capabilities: ChatCapabilities,
): SubmitIntent | undefined {
  if (activity.status === 'idle') return capabilities.canSubmit ? 'send' : undefined
  if (capabilities.busySubmission.includes('follow-up')) return 'follow-up'
  if (capabilities.busySubmission.includes('queue')) return 'queue'
  return undefined
}

function submitLabel(intent: SubmitIntent | undefined) {
  if (intent === 'queue') return 'Queue'
  if (intent === 'follow-up') return 'Follow up'
  return 'Send'
}

function replaceDraftText(
  draft: ComposerDraft,
  text: string,
  anchorOffset: number,
  focusOffset: number,
): ComposerDraft {
  const firstText = draft.segments.find((segment) => segment.type === 'text')
  const segmentId = firstText?.id ?? `text-${draft.revision + 1}`
  let replaced = false
  const segments = draft.segments.map((segment) => {
    if (segment.type !== 'text') return segment
    if (replaced) return { ...segment, text: '' }
    replaced = true
    return { ...segment, text }
  })
  if (!replaced) segments.unshift({ id: segmentId, text, type: 'text' })

  return {
    ...draft,
    revision: draft.revision + 1,
    segments,
    selection: {
      anchor: { offset: anchorOffset, segmentId },
      focus: { offset: focusOffset, segmentId },
    },
  }
}

const styles = stylex.create({
  root: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    inlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-within': colors.focus,
    },
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: '3px',
  },
  shell: {
    borderColor: colors.warning,
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x2,
    justifyContent: 'space-between',
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x2,
  },
  leading: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minInlineSize: 0,
  },
  trailing: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: space.x1,
  },
  selection: {
    color: colors.textMuted,
    display: {
      default: 'none',
      '@media (min-width: 40rem)': 'inline',
    },
    fontFamily: type.family,
    fontSize: type.sizeCaption,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    margin: 0,
    paddingBlockEnd: space.x2,
    paddingInline: space.x3,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    fontFamily: type.family,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlock: space.x2,
    paddingInline: space.x3,
  },
  tray: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    listStyle: 'none',
    margin: 0,
    paddingBlockStart: space.x2,
    paddingInline: space.x2,
  },
  trayItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    display: 'flex',
    gap: space.x1,
    minBlockSize: '2.75rem',
    paddingInlineStart: space.x2,
  },
  reference: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    display: 'flex',
    gap: space.x1,
    minBlockSize: '2.75rem',
    paddingInlineStart: space.x2,
  },
  trayLabel: {
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeSmall,
    maxInlineSize: '16rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trayState: {
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    textTransform: 'capitalize',
  },
  queue: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    gap: space.x2,
    paddingBlock: space.x3,
  },
  queueTitle: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    margin: 0,
  },
  queueItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  queueItem: {
    alignItems: 'center',
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    minBlockSize: '2.75rem',
  },
  queueText: {
    fontSize: type.sizeSmall,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  queueActions: {
    display: 'flex',
    gap: space.x1,
  },
})
