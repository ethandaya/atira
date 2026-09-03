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
import {
  Button,
  FilterMenu,
  SelectPicker,
  TextareaField,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export type ComposerCommand = Readonly<{
  description?: string
  disabled?: boolean
  id: string
  label: string
  value: string
}>

export type ComposerReference = Readonly<{
  description?: string
  disabled?: boolean
  id: string
  label: string
  referenceType: Extract<DraftSegment, { type: 'reference' }>['referenceType']
  value: string
}>

export type PromptHistoryItem = Readonly<{
  description?: string
  draft: ComposerDraft
  id: string
  label: string
}>

type ActiveComposerMenu = Readonly<{
  end: number
  kind: 'command' | 'reference'
  query: string
  source: 'text' | 'trigger'
  start: number
}>

export type ChatComposerProps = {
  accept?: string
  actions?: ReactNode
  activity: SessionActivity
  capabilities: ChatCapabilities
  commands?: readonly ComposerCommand[]
  draft: ComposerDraft
  error?: ChatError
  onDraftChange: (draft: ComposerDraft) => void
  onFilesAdd?: (
    files: readonly File[],
    source: 'drop' | 'paste' | 'picker',
  ) => void
  onRemoveAttachment?: (attachment: DraftAttachment) => void
  onRemoveReference?: (segment: Extract<DraftSegment, { type: 'reference' }>) => void
  onRetryAttachment?: (attachment: DraftAttachment) => void
  onStop: () => void
  onSubmit: (draft: ComposerDraft, intent: SubmitIntent) => void
  placeholder?: string
  references?: readonly ComposerReference[]
}

export function ChatComposer({
  accept,
  actions,
  activity,
  capabilities,
  commands = [],
  draft,
  error,
  onDraftChange,
  onFilesAdd,
  onRemoveAttachment,
  onRemoveReference,
  onRetryAttachment,
  onStop,
  onSubmit,
  placeholder,
  references = [],
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeMenu, setActiveMenu] = useState<ActiveComposerMenu>()
  const [dragging, setDragging] = useState(false)
  const value = editableDraftText(draft)
  const intent = submitIntent(activity, capabilities)
  const canSubmit =
    intent !== undefined &&
    (value.trim().length > 0 || draft.attachments.some((item) => item.state === 'ready'))

  function updateText(next: string) {
    const control = textareaRef.current
    const anchor = control?.selectionStart ?? next.length
    const focus = control?.selectionEnd ?? next.length
    onDraftChange(
      replaceDraftText(draft, next, anchor, focus),
    )
    setActiveMenu(
      detectComposerMenu(
        next,
        focus,
        draft.mode,
        commands.length > 0,
        references.length > 0,
      ),
    )
  }

  function updateSelection(control: HTMLTextAreaElement) {
    const selection = editableSelection(draft)
    const directionMatches =
      selection.start === selection.end ||
      selection.direction === control.selectionDirection
    if (
      selection.start === control.selectionStart &&
      selection.end === control.selectionEnd &&
      directionMatches
    ) {
      return
    }
    onDraftChange(
      replaceDraftText(
        draft,
        value,
        control.selectionDirection === 'backward'
          ? control.selectionEnd
          : control.selectionStart,
        control.selectionDirection === 'backward'
          ? control.selectionStart
          : control.selectionEnd,
      ),
    )
  }

  useLayoutEffect(() => {
    const control = textareaRef.current
    if (!control) return
    const selection = editableSelection(draft)
    const directionMatches =
      selection.start === selection.end ||
      control.selectionDirection === selection.direction
    if (
      control.selectionStart !== selection.start ||
      control.selectionEnd !== selection.end ||
      !directionMatches
    ) {
      control.setSelectionRange(
        selection.start,
        selection.end,
        selection.direction,
      )
    }
  }, [draft.revision, value])

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
    setActiveMenu(undefined)
    onDraftChange({ ...draft, mode, revision: draft.revision + 1 })
  }

  function addFiles(
    files: FileList | readonly File[] | null,
    source: 'drop' | 'paste' | 'picker',
  ) {
    if (!onFilesAdd || !files || files.length === 0) return
    onFilesAdd(Array.from(files), source)
  }

  function pickFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.currentTarget.files, 'picker')
    event.currentTarget.value = ''
  }

  function pasteFiles(event: ClipboardEvent<HTMLTextAreaElement>) {
    addFiles(event.clipboardData.files, 'paste')
  }

  function dropFiles(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files, 'drop')
  }

  function openMenu(kind: ActiveComposerMenu['kind']) {
    const control = textareaRef.current
    const offset = control?.selectionEnd ?? value.length
    setActiveMenu({
      end: offset,
      kind,
      query: '',
      source: 'trigger',
      start: offset,
    })
  }

  function closeMenu() {
    const returnToEditor = activeMenu?.source === 'text'
    setActiveMenu(undefined)
    if (returnToEditor) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function selectCommand(command: ComposerCommand) {
    if (!activeMenu) return
    const needsSpace =
      activeMenu.source === 'trigger' &&
      activeMenu.start > 0 &&
      !/\s/.test(value[activeMenu.start - 1] ?? '')
    const insertion = `${needsSpace ? ' ' : ''}${command.value} `
    const next = replaceMenuToken(value, activeMenu, insertion)
    const offset = activeMenu.start + insertion.length
    onDraftChange(replaceDraftText(draft, next, offset, offset))
    setActiveMenu(undefined)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function selectReference(reference: ComposerReference) {
    if (!activeMenu) return
    const nextText = replaceMenuToken(value, activeMenu, '')
    const offset = activeMenu.start
    const next = replaceDraftText(draft, nextText, offset, offset)
    onDraftChange({
      ...next,
      segments: [
        ...next.segments,
        {
          id: `reference-${reference.id}-${next.revision}`,
          label: reference.label,
          referenceType: reference.referenceType,
          type: 'reference',
          value: reference.value,
        },
      ],
    })
    setActiveMenu(undefined)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <form
      aria-label="Message composer"
      data-dragging={dragging || undefined}
      data-mode={draft.mode}
      data-selection-anchor={`${draft.selection.anchor.segmentId}:${draft.selection.anchor.offset}`}
      data-selection-focus={`${draft.selection.focus.segmentId}:${draft.selection.focus.offset}`}
      data-slot="chat-composer"
      data-state={activity.status}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false)
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={dropFiles}
      onSelectCapture={(event) => {
        if (event.target === textareaRef.current) {
          updateSelection(textareaRef.current)
        }
      }}
      onSubmit={submit}
      {...stylex.props(
        styles.root,
        draft.mode === 'shell' && styles.shell,
        dragging && styles.dragging,
      )}
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
        onPaste={pasteFiles}
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
          {capabilities.canAttach && onFilesAdd && (
            <>
              <input
                ref={fileInputRef}
                accept={accept}
                aria-hidden="true"
                multiple
                onChange={pickFiles}
                tabIndex={-1}
                type="file"
                {...stylex.props(styles.fileInput)}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="compact"
                variant="quiet"
              >
                Attach
              </Button>
            </>
          )}
          {commands.length > 0 && draft.mode === 'prompt' && (
            <FilterMenu
              inputValue={activeMenu?.kind === 'command' ? activeMenu.query : ''}
              items={commands}
              label="Commands"
              onInputValueChange={(query) =>
                setActiveMenu((current) =>
                  current?.kind === 'command' ? { ...current, query } : current,
                )
              }
              onOpenChange={(open) =>
                open ? openMenu('command') : closeMenu()
              }
              onSelect={selectCommand}
              open={activeMenu?.kind === 'command'}
              placeholder="Filter commands…"
              triggerLabel="/"
            />
          )}
          {references.length > 0 && capabilities.referenceTypes.length > 0 && (
            <FilterMenu
              inputValue={activeMenu?.kind === 'reference' ? activeMenu.query : ''}
              items={references.filter((reference) =>
                capabilities.referenceTypes.includes(reference.referenceType),
              )}
              label="References"
              onInputValueChange={(query) =>
                setActiveMenu((current) =>
                  current?.kind === 'reference' ? { ...current, query } : current,
                )
              }
              onOpenChange={(open) =>
                open ? openMenu('reference') : closeMenu()
              }
              onSelect={selectReference}
              open={activeMenu?.kind === 'reference'}
              placeholder="Filter references…"
              triggerLabel="@"
            />
          )}
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
          {capabilities.agents.length > 0 && (
            <SelectPicker
              label="Agent"
              onValueChange={(id) => {
                const agent = capabilities.agents.find((item) => item.id === id)
                if (agent) {
                  onDraftChange({
                    ...draft,
                    agent,
                    revision: draft.revision + 1,
                  })
                }
              }}
              options={capabilities.agents.map((agent) => ({
                label: agent.label,
                value: agent.id,
              }))}
              placeholder="Agent"
              {...(draft.agent === undefined ? {} : { value: draft.agent.id })}
            />
          )}
          {capabilities.models.length > 0 && (
            <SelectPicker
              label="Model"
              onValueChange={(id) => {
                const model = capabilities.models.find(
                  (item) => modelOptionValue(item) === id,
                )
                if (model) {
                  onDraftChange({
                    ...draft,
                    model,
                    revision: draft.revision + 1,
                  })
                }
              }}
              options={capabilities.models.map((model) => ({
                label: model.label,
                value: modelOptionValue(model),
              }))}
              placeholder="Model"
              {...(draft.model === undefined
                ? {}
                : { value: modelOptionValue(draft.model) })}
            />
          )}
          {capabilities.variants.length > 0 && (
            <SelectPicker
              label="Variant"
              onValueChange={(variant) =>
                onDraftChange({
                  ...draft,
                  revision: draft.revision + 1,
                  variant,
                })
              }
              options={capabilities.variants.map((variant) => ({
                ...(variant.unavailableReason === undefined
                  ? {}
                  : { description: variant.unavailableReason }),
                disabled: variant.unavailableReason !== undefined,
                label: variant.label,
                value: variant.id,
              }))}
              placeholder="Variant"
              {...(draft.variant === undefined ? {} : { value: draft.variant })}
            />
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
          data-attachment-kind={item.attachment.kind}
          data-state={item.state}
          key={item.attachment.id}
          {...stylex.props(styles.trayItem)}
        >
          {safePreview(item.attachment.previewUrl, item.attachment.kind) && (
            <img
              alt=""
              src={item.attachment.previewUrl}
              {...stylex.props(styles.attachmentPreview)}
            />
          )}
          <span {...stylex.props(styles.attachmentCopy)}>
            <span dir="auto" {...stylex.props(styles.trayLabel)}>
              {item.attachment.name}
            </span>
            <span {...stylex.props(styles.trayState)}>
              {item.attachment.kind}
              {item.attachment.size === undefined
                ? ''
                : ` · ${formatBytes(item.attachment.size)}`}
              {' · '}
              {item.state === 'reading'
                ? 'Reading'
                : item.state === 'failed'
                  ? 'Failed'
                  : 'Ready'}
            </span>
            {item.state === 'failed' && (
              <span role="alert" {...stylex.props(styles.attachmentError)}>
                {item.error.message}
              </span>
            )}
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

export type ReferenceTrayProps = {
  draft: ComposerDraft
  onRemove?: (segment: Extract<DraftSegment, { type: 'reference' }>) => void
}

export function ReferenceTray({
  draft,
  onRemove,
}: ReferenceTrayProps) {
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

export type PromptHistoryProps = {
  items: readonly PromptHistoryItem[]
  onRestore: (item: PromptHistoryItem) => void
}

export function PromptHistory({ items, onRestore }: PromptHistoryProps) {
  return (
    <FilterMenu
      emptyLabel="No matching prompts."
      items={items}
      label="Prompt history"
      onSelect={onRestore}
      placeholder="Filter prompt history…"
      triggerLabel="History"
    />
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

function editableDraftText(draft: ComposerDraft) {
  return draft.segments
    .filter((segment): segment is Extract<DraftSegment, { type: 'text' }> =>
      segment.type === 'text',
    )
    .map((segment) => segment.text)
    .join('')
}

function editableSelection(draft: ComposerDraft): {
  direction: 'backward' | 'forward' | 'none'
  end: number
  start: number
} {
  const anchor = editablePointOffset(draft, draft.selection.anchor)
  const focus = editablePointOffset(draft, draft.selection.focus)
  return {
    direction: anchor === focus ? 'none' : anchor > focus ? 'backward' : 'forward',
    end: Math.max(anchor, focus),
    start: Math.min(anchor, focus),
  }
}

function editablePointOffset(
  draft: ComposerDraft,
  point: ComposerDraft['selection']['anchor'],
) {
  let offset = 0
  for (const segment of draft.segments) {
    if (segment.id === point.segmentId) {
      return segment.type === 'text'
        ? Math.min(offset + point.offset, editableDraftText(draft).length)
        : offset
    }
    if (segment.type === 'text') offset += segment.text.length
  }
  return editableDraftText(draft).length
}

function detectComposerMenu(
  text: string,
  offset: number,
  mode: ComposerDraft['mode'],
  hasCommands: boolean,
  hasReferences: boolean,
): ActiveComposerMenu | undefined {
  if (mode !== 'prompt') return undefined
  const prefix = text.slice(0, offset)
  const match = /(^|\s)([/@])([^\s/@]*)$/.exec(prefix)
  if (!match) return undefined
  const marker = match[2]
  const query = match[3] ?? ''
  if ((marker === '/' && !hasCommands) || (marker === '@' && !hasReferences)) {
    return undefined
  }
  return {
    end: offset,
    kind: marker === '/' ? 'command' : 'reference',
    query,
    source: 'text',
    start: offset - query.length - 1,
  }
}

function replaceMenuToken(
  text: string,
  menu: ActiveComposerMenu,
  insertion: string,
) {
  return `${text.slice(0, menu.start)}${insertion}${text.slice(menu.end)}`
}

function modelOptionValue(model: ChatCapabilities['models'][number]) {
  return `${model.providerId}:${model.modelId}`
}

function safePreview(url: string | undefined, kind: 'file' | 'image') {
  if (!url || kind !== 'image') return false
  return /^(blob:|data:image\/|https?:\/\/)/i.test(url)
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
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
  dragging: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.focus,
  },
  fileInput: {
    display: 'none',
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x2,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    minBlockSize: '2.75rem',
    paddingBlock: space.x2,
    paddingInline: space.x2,
  },
  leading: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    flexWrap: 'wrap',
    inlineSize: {
      default: '100%',
      '@media (min-width: 40rem)': 'auto',
    },
    minInlineSize: 0,
  },
  trailing: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: space.x1,
    inlineSize: {
      default: '100%',
      '@media (min-width: 40rem)': 'auto',
    },
    justifyContent: 'flex-end',
    minInlineSize: 0,
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
  attachmentPreview: {
    blockSize: '2rem',
    borderRadius: radii.control,
    inlineSize: '2rem',
    objectFit: 'cover',
  },
  attachmentCopy: {
    display: 'flex',
    flexDirection: 'column',
    minInlineSize: 0,
  },
  attachmentError: {
    color: colors.danger,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    maxInlineSize: '18rem',
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
