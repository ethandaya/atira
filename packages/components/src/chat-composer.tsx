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
  chatAppearance,
  colors,
  motion,
  radii,
  shadows,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  ActionMenu,
  AnimatePresence,
  PresenceItem,
  PresenceSurface,
  Button,
  FilterMenu,
  IconButton,
  SelectPicker,
  TextareaField,
  VisuallyHidden,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  AtSign,
  Bot,
  Command,
  Paperclip,
  Plus,
  SendHorizontal,
  SlidersHorizontal,
  Square,
  Terminal,
} from 'lucide-react'
import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  editableDraftText,
  editableSelection,
  insertDraftReference,
  projectTextareaEdit,
  removeDraftReference,
} from './composer-draft'

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
  source: 'menu' | 'text' | 'trigger'
  start: number
}>

export type ChatComposerProps = {
  accept?: string
  actions?: ReactNode
  activity: SessionActivity
  capabilities: ChatCapabilities
  composerLabel?: string
  commands?: readonly ComposerCommand[]
  draft: ComposerDraft
  error?: ChatError
  onDraftChange: (draft: ComposerDraft) => void
  onFilesAdd?: (
    files: readonly File[],
    source: 'drop' | 'paste' | 'picker',
  ) => void
  onRemoveAttachment?: (attachment: DraftAttachment) => void
  onRemoveReference?: (
    segment: Extract<DraftSegment, { type: 'reference' }>,
  ) => void
  onRetryAttachment?: (attachment: DraftAttachment) => void
  onStop: () => void
  onSubmit: (draft: ComposerDraft, intent: SubmitIntent) => void
  placeholder?: string
  references?: readonly ComposerReference[]
}

const noCommands: readonly ComposerCommand[] = []

function submitComposerFromKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (
    event.key === 'Enter' &&
    (event.metaKey || event.ctrlKey) &&
    !event.nativeEvent.isComposing
  ) {
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }
}

function useTextareaSelectionSync(
  draft: ComposerDraft,
  onDraftChange: (draft: ComposerDraft) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const value = editableDraftText(draft)

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
      projectTextareaEdit(draft, value, {
        anchor:
          control.selectionDirection === 'backward'
            ? control.selectionEnd
            : control.selectionStart,
        focus:
          control.selectionDirection === 'backward'
            ? control.selectionStart
            : control.selectionEnd,
      }),
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
  }, [draft, textareaRef, value])

  return { updateSelection, value }
}

function useComposerMenu({
  commands,
  draft,
  onDraftChange,
  references,
  textareaRef,
  value,
}: Pick<
  ChatComposerProps,
  'commands' | 'draft' | 'onDraftChange' | 'references'
> & {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
}) {
  const [activeMenu, setActiveMenu] = useState<ActiveComposerMenu>()

  function updateText(next: string) {
    const control = textareaRef.current
    const start = control?.selectionStart ?? next.length
    const end = control?.selectionEnd ?? next.length
    const backward = control?.selectionDirection === 'backward'
    onDraftChange(
      projectTextareaEdit(draft, next, {
        anchor: backward ? end : start,
        focus: backward ? start : end,
      }),
    )
    setActiveMenu(
      detectComposerMenu(
        next,
        backward ? start : end,
        draft.mode,
        (commands?.length ?? 0) > 0,
        (references?.length ?? 0) > 0,
      ),
    )
  }

  function openMenu(
    kind: ActiveComposerMenu['kind'],
    source: ActiveComposerMenu['source'] = 'trigger',
  ) {
    const offset = textareaRef.current?.selectionEnd ?? value.length
    setActiveMenu({ end: offset, kind, query: '', source, start: offset })
  }

  function closeMenu() {
    const returnToEditor = activeMenu?.source !== 'trigger'
    setActiveMenu(undefined)
    if (returnToEditor) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function selectCommand(command: ComposerCommand) {
    if (!activeMenu) return
    const needsSpace =
      activeMenu.source !== 'text' &&
      activeMenu.start > 0 &&
      !/\s/.test(value[activeMenu.start - 1] ?? '')
    const insertion = `${needsSpace ? ' ' : ''}${command.value} `
    const next = replaceMenuToken(value, activeMenu, insertion)
    const offset = activeMenu.start + insertion.length
    onDraftChange(
      projectTextareaEdit(draft, next, { anchor: offset, focus: offset }),
    )
    setActiveMenu(undefined)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function selectReference(reference: ComposerReference) {
    if (!activeMenu) return
    const nextText = replaceMenuToken(value, activeMenu, '')
    const offset = activeMenu.start
    const next = projectTextareaEdit(draft, nextText, {
      anchor: offset,
      focus: offset,
    })
    onDraftChange(
      insertDraftReference(next, offset, {
        id: `reference-${reference.id}-${next.revision}`,
        label: reference.label,
        referenceType: reference.referenceType,
        type: 'reference',
        value: reference.value,
      }),
    )
    setActiveMenu(undefined)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return {
    activeMenu,
    closeMenu,
    openMenu,
    selectCommand,
    selectReference,
    setActiveMenu,
    updateText,
  }
}

function useComposerFiles(
  onFilesAdd: ChatComposerProps['onFilesAdd'],
  setDragging: Dispatch<SetStateAction<boolean>>,
) {
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

  return { dropFiles, pasteFiles, pickFiles }
}

function ComposerDraftContext({
  accept,
  capabilities,
  draft,
  fileInputRef,
  onDraftChange,
  onFilesAdd,
  onRemoveAttachment,
  onRemoveReference,
  onRetryAttachment,
  pickFiles,
}: {
  accept: ChatComposerProps['accept']
  capabilities: ChatCapabilities
  draft: ComposerDraft
  fileInputRef: RefObject<HTMLInputElement | null>
  onDraftChange: ChatComposerProps['onDraftChange']
  onFilesAdd: ChatComposerProps['onFilesAdd']
  onRemoveAttachment: ChatComposerProps['onRemoveAttachment']
  onRemoveReference: ChatComposerProps['onRemoveReference']
  onRetryAttachment: ChatComposerProps['onRetryAttachment']
  pickFiles: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <ReferenceTray
        draft={draft}
        {...(onRemoveReference === undefined
          ? {}
          : {
              onRemove: (
                segment: Extract<DraftSegment, { type: 'reference' }>,
              ) => {
                if (
                  draft.selection.anchor.segmentId === segment.id ||
                  draft.selection.focus.segmentId === segment.id
                ) {
                  onDraftChange(removeDraftReference(draft, segment.id))
                }
                onRemoveReference(segment)
              },
            })}
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
      {capabilities.canAttach && onFilesAdd && (
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
      )}
    </>
  )
}

export function ChatComposer({
  accept,
  actions,
  activity,
  capabilities,
  composerLabel = 'Message composer',
  commands = noCommands,
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
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { dropFiles, pasteFiles, pickFiles } = useComposerFiles(
    onFilesAdd,
    setDragging,
  )
  const { updateSelection, value } = useTextareaSelectionSync(
    draft,
    onDraftChange,
    textareaRef,
  )
  const {
    activeMenu,
    closeMenu,
    openMenu,
    selectCommand,
    selectReference,
    setActiveMenu,
    updateText,
  } = useComposerMenu({
    commands,
    draft,
    onDraftChange,
    references,
    textareaRef,
    value,
  })
  const intent = submitIntent(activity, capabilities)
  const canSubmit =
    intent !== undefined &&
    (value.trim().length > 0 ||
      draft.attachments.some((item) => item.state === 'ready'))
  const showStop =
    activity.status !== 'idle' && capabilities.canStop && !canSubmit
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit && intent) onSubmit(draft, intent)
  }

  function setMode(mode: ComposerDraft['mode']) {
    setActiveMenu(undefined)
    onDraftChange({ ...draft, mode, revision: draft.revision + 1 })
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The form delegates Escape and file-drop events from its controls.
    <form
      ref={formRef}
      aria-label={composerLabel}
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
      <ComposerDraftContext
        accept={accept}
        capabilities={capabilities}
        draft={draft}
        fileInputRef={fileInputRef}
        onDraftChange={onDraftChange}
        onFilesAdd={onFilesAdd}
        onRemoveAttachment={onRemoveAttachment}
        onRemoveReference={onRemoveReference}
        onRetryAttachment={onRetryAttachment}
        pickFiles={pickFiles}
      />
      <TextareaField
        autoComplete="off"
        label={draft.mode === 'shell' ? 'Shell command' : 'Message'}
        labelHidden
        onKeyDown={submitComposerFromKeyboard}
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
        <p
          role="alert"
          data-slot="submission-error"
          {...stylex.props(styles.error)}
        >
          {error.message}
        </p>
      )}

      <ComposerToolbar
        actions={actions}
        activeMenu={activeMenu}
        canSubmit={canSubmit}
        capabilities={capabilities}
        commands={commands}
        draft={draft}
        fileInputRef={fileInputRef}
        formRef={formRef}
        intent={intent}
        onCloseMenu={closeMenu}
        onDraftChange={onDraftChange}
        onFilesAdd={onFilesAdd}
        onOpenMenu={openMenu}
        onSelectCommand={selectCommand}
        onSelectReference={selectReference}
        onSetMode={setMode}
        onStop={onStop}
        references={references}
        setActiveMenu={setActiveMenu}
        showStop={showStop}
      />
      <VisuallyHidden>Ctrl/⌘ + Enter to submit</VisuallyHidden>
    </form>
  )
}

type ComposerToolbarProps = {
  actions: ReactNode
  activeMenu: ActiveComposerMenu | undefined
  canSubmit: boolean
  capabilities: ChatCapabilities
  commands: readonly ComposerCommand[]
  draft: ComposerDraft
  fileInputRef: RefObject<HTMLInputElement | null>
  formRef: RefObject<HTMLFormElement | null>
  intent: SubmitIntent | undefined
  onCloseMenu: () => void
  onDraftChange: (draft: ComposerDraft) => void
  onFilesAdd: ChatComposerProps['onFilesAdd']
  onOpenMenu: (
    kind: ActiveComposerMenu['kind'],
    source?: ActiveComposerMenu['source'],
  ) => void
  onSelectCommand: (command: ComposerCommand) => void
  onSelectReference: (reference: ComposerReference) => void
  onSetMode: (mode: ComposerDraft['mode']) => void
  onStop: () => void
  references: readonly ComposerReference[]
  setActiveMenu: Dispatch<SetStateAction<ActiveComposerMenu | undefined>>
  showStop: boolean
}

function ComposerToolbar(props: ComposerToolbarProps) {
  const { activeMenu, capabilities, commands, draft, formRef, references } =
    props
  const referenceTypes = new Set(capabilities.referenceTypes)
  const referenceItems = references.filter((item) =>
    referenceTypes.has(item.referenceType),
  )
  const menuItems = composerActionItems(props)
  const updateQuery = (kind: ActiveComposerMenu['kind'], query: string) =>
    props.setActiveMenu((current) =>
      current?.kind === kind ? { ...current, query } : current,
    )

  return (
    <div data-slot="chat-composer-toolbar" {...stylex.props(styles.toolbar)}>
      <div
        data-slot="chat-composer-context-actions"
        {...stylex.props(styles.leading)}
      >
        {menuItems.length > 0 && (
          <ActionMenu
            items={menuItems}
            label="Composer actions"
            portalContainer={formRef}
            side="top"
            trigger={<Plus aria-hidden="true" size={18} strokeWidth={1.75} />}
          />
        )}
        <span aria-hidden="true" {...stylex.props(styles.menuHosts)}>
          {commands.length > 0 && draft.mode === 'prompt' && (
            <FilterMenu
              inputValue={
                activeMenu?.kind === 'command' ? activeMenu.query : ''
              }
              items={commands}
              label="Commands"
              onInputValueChange={(query) => updateQuery('command', query)}
              onOpenChange={(open) =>
                open ? props.onOpenMenu('command') : props.onCloseMenu()
              }
              onSelect={props.onSelectCommand}
              open={activeMenu?.kind === 'command'}
              placeholder="Filter commands…"
              portalContainer={formRef}
              triggerLabel="/"
            />
          )}
          {referenceItems.length > 0 && (
            <FilterMenu
              inputValue={
                activeMenu?.kind === 'reference' ? activeMenu.query : ''
              }
              items={referenceItems}
              label="References"
              onInputValueChange={(query) => updateQuery('reference', query)}
              onOpenChange={(open) =>
                open ? props.onOpenMenu('reference') : props.onCloseMenu()
              }
              onSelect={props.onSelectReference}
              open={activeMenu?.kind === 'reference'}
              placeholder="Filter references…"
              portalContainer={formRef}
              triggerLabel="@"
            />
          )}
        </span>
        <ComposerModelControls
          capabilities={capabilities}
          draft={draft}
          formRef={formRef}
          onDraftChange={props.onDraftChange}
        />
        {props.actions}
      </div>
      <div
        data-slot="chat-composer-submit-controls"
        {...stylex.props(styles.trailing)}
      >
        <IconButton
          aria-label={props.showStop ? 'Stop' : submitLabel(props.intent)}
          disabled={!props.showStop && !props.canSubmit}
          iconSize="small"
          onClick={props.showStop ? props.onStop : undefined}
          title={props.showStop ? 'Stop response' : submitLabel(props.intent)}
          type={props.showStop ? 'button' : 'submit'}
          variant="primary"
        >
          {props.showStop ? (
            <Square fill="currentColor" size={16} strokeWidth={1.75} />
          ) : (
            <SendHorizontal size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      </div>
    </div>
  )
}

function composerActionItems(props: ComposerToolbarProps) {
  const { capabilities, commands, draft, references } = props
  return [
    ...(commands.length > 0 && draft.mode === 'prompt'
      ? [
          {
            icon: <Command aria-hidden="true" size={15} strokeWidth={1.75} />,
            id: 'commands',
            label: 'Commands',
            onSelect: () =>
              requestAnimationFrame(() => props.onOpenMenu('command', 'menu')),
          },
        ]
      : []),
    ...(references.length > 0 && capabilities.referenceTypes.length > 0
      ? [
          {
            icon: <AtSign aria-hidden="true" size={15} strokeWidth={1.75} />,
            id: 'references',
            label: 'References',
            onSelect: () =>
              requestAnimationFrame(() =>
                props.onOpenMenu('reference', 'menu'),
              ),
          },
        ]
      : []),
    ...(capabilities.canAttach && props.onFilesAdd
      ? [
          {
            icon: <Paperclip aria-hidden="true" size={15} strokeWidth={1.75} />,
            id: 'attach',
            label: 'Attach files',
            onSelect: () => props.fileInputRef.current?.click(),
          },
        ]
      : []),
    ...(capabilities.canUseShell
      ? [
          {
            icon: <Terminal aria-hidden="true" size={15} strokeWidth={1.75} />,
            id: 'shell',
            label:
              draft.mode === 'shell' ? 'Use prompt mode' : 'Use shell mode',
            onSelect: () =>
              props.onSetMode(draft.mode === 'shell' ? 'prompt' : 'shell'),
          },
        ]
      : []),
    ...capabilities.agents
      .filter((agent) => draft.agent?.id !== agent.id)
      .map((agent) => ({
        icon: <Bot aria-hidden="true" size={15} strokeWidth={1.75} />,
        id: `agent-${agent.id}`,
        label: `Use ${agent.label} agent`,
        onSelect: () =>
          props.onDraftChange({
            ...draft,
            agent,
            revision: draft.revision + 1,
          }),
      })),
    ...capabilities.variants
      .filter((variant) => draft.variant !== variant.id)
      .map((variant) => ({
        description: variant.unavailableReason,
        disabled: variant.unavailableReason !== undefined,
        icon: (
          <SlidersHorizontal aria-hidden="true" size={15} strokeWidth={1.75} />
        ),
        id: `variant-${variant.id}`,
        label: `Use ${variant.label} variant`,
        onSelect: () =>
          props.onDraftChange({
            ...draft,
            revision: draft.revision + 1,
            variant: variant.id,
          }),
      })),
  ]
}

function ComposerModelControls({
  capabilities,
  draft,
  formRef,
  onDraftChange,
}: Pick<
  ComposerToolbarProps,
  'capabilities' | 'draft' | 'formRef' | 'onDraftChange'
>) {
  return (
    <>
      {capabilities.models.length > 0 && (
        <SelectPicker
          label="Model"
          portalContainer={formRef}
          onValueChange={(id) => {
            const model = capabilities.models.find(
              (item) => modelOptionValue(item) === id,
            )
            if (!model) return
            const { reasoningEffort, ...rest } = draft
            onDraftChange({
              ...rest,
              model,
              ...(reasoningEffort &&
              model.reasoningEfforts?.includes(reasoningEffort)
                ? { reasoningEffort }
                : {}),
              revision: draft.revision + 1,
            })
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
      {draft.model?.reasoningEfforts &&
        draft.model.reasoningEfforts.length > 0 && (
          <SelectPicker
            label="Reasoning effort"
            portalContainer={formRef}
            onValueChange={(reasoningEffort) =>
              onDraftChange({
                ...draft,
                reasoningEffort,
                revision: draft.revision + 1,
              })
            }
            options={draft.model.reasoningEfforts.map((value) => ({
              label:
                value === 'xhigh'
                  ? 'Extra high'
                  : value.charAt(0).toUpperCase() + value.slice(1),
              value,
            }))}
            value={
              draft.reasoningEffort &&
              draft.model.reasoningEfforts.includes(draft.reasoningEffort)
                ? draft.reasoningEffort
                : (draft.model.defaultReasoningEffort ??
                  draft.model.reasoningEfforts[0] ??
                  '')
            }
            placeholder="Reasoning effort"
          />
        )}
    </>
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
      <AnimatePresence initial={false}>
        {attachments.map((item) => (
          <PresenceItem
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
              <span
                dir="auto"
                title={item.attachment.name}
                {...stylex.props(styles.trayLabel)}
              >
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
              <Button
                onClick={() => onRetry(item)}
                size="compact"
                variant="quiet"
              >
                Retry
              </Button>
            )}
            {onRemove && (
              <Button
                onClick={() => onRemove(item)}
                size="compact"
                variant="quiet"
              >
                Remove
              </Button>
            )}
          </PresenceItem>
        ))}
      </AnimatePresence>
    </ul>
  )
}

export type ReferenceTrayProps = {
  draft: ComposerDraft
  onRemove?: (segment: Extract<DraftSegment, { type: 'reference' }>) => void
}

export function ReferenceTray({ draft, onRemove }: ReferenceTrayProps) {
  const references = draft.segments.filter(
    (segment): segment is Extract<DraftSegment, { type: 'reference' }> =>
      segment.type === 'reference',
  )
  if (references.length === 0) return null

  return (
    <ul
      aria-label="References"
      data-slot="reference-tray"
      {...stylex.props(styles.tray)}
    >
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
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <PresenceSurface
          kind="content"
          role="region"
          aria-label="Queued prompts"
          data-slot="queue-list"
          {...stylex.props(styles.queue)}
        >
          <p {...stylex.props(styles.queueTitle)}>Queued · {items.length}</p>
          <ol {...stylex.props(styles.queueItems)}>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <PresenceItem
                  data-queue-id={item.id}
                  data-state={item.state}
                  key={item.id}
                  {...stylex.props(styles.queueItem)}
                >
                  <div {...stylex.props(styles.queueCopy)}>
                    <span {...stylex.props(styles.queueText)}>
                      {composerDraftText(item.draft) || 'Attachment prompt'}
                    </span>
                    {item.state === 'failed' && (
                      <span role="alert" {...stylex.props(styles.queueError)}>
                        {item.error.message}
                      </span>
                    )}
                  </div>
                  <span
                    {...stylex.props(
                      styles.trayState,
                      styles.queueState,
                      item.state === 'failed' && styles.queueStateFailed,
                    )}
                  >
                    {item.state}
                  </span>
                  <div {...stylex.props(styles.queueActions)}>
                    {item.state === 'failed' &&
                      item.error.retryable &&
                      onRetry && (
                        <Button
                          onClick={() => onRetry(item)}
                          size="compact"
                          variant="primary"
                        >
                          Retry
                        </Button>
                      )}
                    {onEdit && (
                      <Button
                        onClick={() => onEdit(item)}
                        size="compact"
                        variant="quiet"
                      >
                        Edit
                      </Button>
                    )}
                    {onRemove && (
                      <Button
                        onClick={() => onRemove(item)}
                        size="compact"
                        variant="danger"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </PresenceItem>
              ))}
            </AnimatePresence>
          </ol>
        </PresenceSurface>
      )}
    </AnimatePresence>
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
  if (activity.status === 'idle')
    return capabilities.canSubmit ? 'send' : undefined
  if (capabilities.busySubmission.includes('follow-up')) return 'follow-up'
  if (capabilities.busySubmission.includes('queue')) return 'queue'
  return undefined
}

function submitLabel(intent: SubmitIntent | undefined) {
  if (intent === 'queue') return 'Queue'
  if (intent === 'follow-up') return 'Follow up'
  return 'Send'
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

const styles = stylex.create({
  root: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'transparent',
    borderRadius: radii.panel,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      default: chatAppearance.composerShadow,
      ':focus-within': stylex.firstThatWorks(
        chatAppearance.composerFocusShadow,
        chatAppearance.composerShadow,
      ),
    },
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    inlineSize: '100%',
    outlineColor: {
      default: 'transparent',
      ':focus-within': colors.focus,
    },
    outlineOffset: chatAppearance.composerFocusOffset,
    outlineStyle: 'solid',
    outlineWidth: '2px',
    transitionProperty: 'box-shadow',
    transitionDuration: {
      default: motion.durationFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionTimingFunction: motion.easingStandard,
  },
  shell: {
    borderColor: colors.warning,
  },
  dragging: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.focus,
  },
  fileInput: {
    display: 'none',
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: chatAppearance.composerToolbarSurface,
    margin: '0 6px 6px',
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    justifyContent: 'space-between',
    minBlockSize: {
      default: '2.5rem',
      '@media (hover: none)': '3.25rem',
    },
    paddingBlock: space.x1,
    paddingInline: space.x2,
  },
  leading: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minInlineSize: 0,
    overflowX: 'auto',
    overscrollBehaviorInline: 'contain',
    scrollbarWidth: 'none',
    position: 'relative',
  },
  trailing: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    justifyContent: 'flex-end',
    minInlineSize: 0,
  },
  menuHosts: {
    blockSize: 0,
    insetBlockEnd: '100%',
    insetInlineStart: 0,
    pointerEvents: 'none',
    position: 'absolute',
    visibility: 'hidden',
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
    paddingBlockStart: space.x3,
    paddingInline: space.x4,
  },
  trayItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: radii.control,
    boxShadow: shadows.inset,
    boxSizing: 'border-box',
    display: 'flex',
    flex: '1 1 18rem',
    gap: space.x2,
    maxInlineSize: '100%',
    minInlineSize: 0,
    minBlockSize: '2.75rem',
    padding: space.x2,
  },
  attachmentPreview: {
    blockSize: '2rem',
    borderRadius: '0.25rem',
    flexShrink: 0,
    inlineSize: '2rem',
    objectFit: 'cover',
  },
  attachmentCopy: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  attachmentError: {
    color: colors.danger,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    maxInlineSize: '18rem',
    overflowWrap: 'anywhere',
  },
  reference: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    display: 'flex',
    gap: space.x1,
    maxInlineSize: '100%',
    minInlineSize: 0,
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
    gap: space.x2,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  queueItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: radii.surface,
    padding: space.x3,
    display: 'grid',
    gap: space.x2,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) auto',
      '@media (min-width: 40rem)': 'minmax(0, 1fr) 5rem auto',
    },
    minBlockSize: '2.75rem',
  },
  queueCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    gridColumn: 1,
    gridRow: 1,
    minInlineSize: 0,
  },
  queueText: {
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  },
  queueError: {
    color: colors.danger,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    overflowWrap: 'anywhere',
  },
  queueActions: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x1,
    minInlineSize: { default: 0, '@media (min-width: 40rem)': '12rem' },
    gridColumn: {
      default: '1 / -1',
      '@media (min-width: 40rem)': 3,
    },
    gridRow: {
      default: 2,
      '@media (min-width: 40rem)': 1,
    },
    justifyContent: 'flex-end',
  },
  queueState: {
    gridColumn: 2,
    gridRow: 1,
    textAlign: 'end',
  },
  queueStateFailed: {
    color: colors.danger,
  },
})
