# OpenCode chat-interface parity specification

Research snapshot: **September 3, 2026**  
Status: **implementation specification**

This document narrows the broader [OpenCode UI replacement gap analysis](opencode-north-star.md) to the chat/session surface. It defines the reusable React + StyleX library work and the minimum application adapter needed to prove that work against OpenCode.

OpenCode is the behavioral reference, not the visual template. Pretty Amped should preserve the state, interaction, and recovery semantics of the reference while presenting them with a quieter visual system.

## Outcome

The phase is complete when an application can use Pretty Amped to render and operate an OpenCode session with:

- stable paginated turns and streaming message parts;
- text, reasoning, retries, interruptions, errors, compaction, and all tool states;
- specialized coding-tool views plus a lossless generic fallback;
- a rich composer with references, attachments, commands, shell mode, model controls, history, queueing, and stop;
- permission, question, todo, queue, follow-up, and revert workflows;
- optimistic submission and correct event/page reconciliation;
- preserved draft, selection, focus, and scroll state across asynchronous changes; and
- keyboard, screen-reader, touch, reflow, reduced-motion, and long-session behavior suitable for daily use.

The result is a component system and chat composition that other runtimes can also use. OpenCode SDK types, event names, persistence, and network calls may not enter component props.

## Scope

### Included

1. The transcript viewport and historical pagination.
2. Turn, message, and message-part composition.
3. Streaming Markdown and reasoning.
4. Context, shell, file-change, task, web, skill, MCP, and unknown tool presentation.
5. Permission, question, todo, queue, follow-up, and revert surfaces.
6. Structured prompt drafting, references, attachments, commands, shell mode, history, model/agent/variant controls, submission, queueing, and cancellation.
7. A protocol-neutral chat snapshot and action contract.
8. The minimum OpenCode adapter required for stream reduction, reconciliation, optimistic state, and request routing.
9. Deterministic fixtures, browser interaction tests, reducer race tests, accessibility checks, and performance budgets for the above.

### Excluded

- project, workspace, server, and session navigation;
- tabs, titlebars, routing, and window persistence;
- file trees, full file viewers, review panes, and review comments;
- interactive PTY terminals—the shell tool's streamed command output is included;
- provider credentials, server management, settings, onboarding, sharing, and updates;
- Electron or another native shell; and
- registry, CLI, and MCP distribution work.

Model selection inside the composer is included as a controlled UI contract. Discovering providers, authenticating them, and changing provider settings are not.

## Baseline and gap

The current library already has useful visual foundations: `Thread`, `Message`, `Response`, `Markdown`, `Reasoning`, `Composer`, `ToolActivity`, `PermissionRequest`, `Plan`, `Outcome`, and loading primitives.

Those components currently render isolated snapshots. They do not yet form a production chat system:

| Existing component | Keep | Required change |
| --- | --- | --- |
| `Thread` | Semantic empty/list wrapper | Keep static; add a separate timeline composition for history, virtualization, follow state, and anchors |
| `Message` | Actor alignment and article semantics | Add delivery state, richer anatomy, stable part composition, attachments, metadata, and actions |
| `Response` | Explicit terminal states | Add queued, retrying, partial completion, normalized errors, and turn relationship |
| `Markdown` | GFM rendering and streaming surface | Add paced large updates, sanitization fixtures, code actions, cache/worker boundary, and long-content limits |
| `Reasoning` | Controlled disclosure | Add running/complete/interrupted states, timing, labels, grouping, and announcement rules |
| `ToolActivity` | Compact lifecycle row and evidence disclosure | Separate input and execution phases; support progress, approvals, errors, metadata, expansion policy, and specialized bodies |
| `PermissionRequest` | Consequence and focus handling | Add once/always/reject, failed response, child-session origin, stale protection, and exact request identity |
| `Plan` | Generic ordered-plan presentation | Keep generic; add canonical todo list and dock components rather than making `Plan` protocol-aware |
| `Composer` | Text/send/stop behavior | Recompose as structured, controlled parts with attachments, references, menus, controls, queueing, and draft restoration |
| `ActivityList` | Grouped disclosure | Use as a foundation for calm context-tool aggregation, not as the timeline state model |

The missing work is primarily **stateful composition**, not another set of cards.

## Architecture and ownership

```diagram
┌────────────────────────────────────────────────────────────┐
│ OpenCode SDK                                               │
│ pages · events · mutations · permission/question replies   │
└─────────────────────────────┬──────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Reference-app adapter                                      │
│ reduce · reconcile · optimistic state · drafts · commands  │
└─────────────────────────────┬──────────────────────────────┘
                              │ immutable ChatSnapshot
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Chat blocks                                                │
│ timeline projection · request region · composer composition│
└─────────────────────────────┬──────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│ AI/session components                                      │
│ turns · parts · tools · requests · composer parts           │
└─────────────────────────────┬──────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────┐
│ Owned primitives → semantic StyleX foundations             │
└────────────────────────────────────────────────────────────┘
```

### Foundations

Own protocol-neutral chat contracts, semantic tokens, density, typography, motion, layers, and responsive constants. Chat contracts must not import React, StyleX runtime objects, OpenCode, or an AI provider SDK.

The first implementation may place these types in a side-effect-free foundations entry point. Create a separate contracts package only if real consumers demonstrate that the foundation boundary causes build or dependency problems.

### Primitives

Own accessible behavior for text entry, disclosure, selection, menus, popovers, tooltips, overflow, and feedback. Wrap Base UI where it supplies the right behavior. Do not leak Base UI types into AI component APIs.

### Components

Own controlled presentation and local interaction state such as disclosure. Leaf components receive coherent view models and named callbacks. They do not subscribe to an event stream, persist state, inspect a tool protocol, send network requests, or infer status from text.

### Blocks

Own reusable compositions such as a virtualized transcript and request-aware composer region. Blocks may coordinate scroll, focus, disclosure, and rendering registries. They still receive controlled snapshots and actions; they do not call OpenCode.

Introduce a blocks package when the first timeline/request composition exists. Do not create it only to move existing one-component wrappers.

### Reference-app adapter

Own OpenCode SDK compatibility, event transport, reduction, reconciliation, optimistic state, drafts, persistence, commands, request policy, and mutation errors. It converts OpenCode entities into the contracts below and exposes an external store to React.

## Canonical chat model

The model is a render contract, not a copy of OpenCode's wire schema. IDs are opaque and stable. Times are epoch milliseconds. User-visible strings are already localized or localization-ready before reaching leaf components.

### Session and turn state

```ts
type ChatError = Readonly<{
  kind: 'provider' | 'tool' | 'connection' | 'mutation' | 'validation' | 'unknown'
  message: string
  code?: string
  retryable: boolean
}>

type ConnectionState =
  | { status: 'connected' }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'offline'; error?: ChatError }

type HistoryState =
  | { status: 'initial-loading' }
  | { status: 'ready'; hasPrevious: boolean }
  | { status: 'loading-previous' }
  | { status: 'complete' }
  | { status: 'failed'; error: ChatError; canRetry: boolean }

type ModelIdentity = Readonly<{
  providerId: string
  modelId: string
  label: string
}>

type AgentIdentity = Readonly<{
  id: string
  label: string
}>

type SelectorOption = Readonly<{
  id: string
  label: string
  unavailableReason?: string
}>

type DraftReferenceType = 'file' | 'range' | 'resource' | 'agent'

type ChatCapabilities = Readonly<{
  canSubmit: boolean
  canStop: boolean
  busySubmission: readonly ('queue' | 'follow-up')[]
  canUseShell: boolean
  canAttach: boolean
  referenceTypes: readonly DraftReferenceType[]
  permissionDecisions: readonly PermissionDecision[]
  models: readonly ModelIdentity[]
  agents: readonly AgentIdentity[]
  variants: readonly SelectorOption[]
}>

type ChatSnapshot = Readonly<{
  sessionId: string
  connection: ConnectionState
  activity:
    | { status: 'idle' }
    | { status: 'busy'; turnId: string }
    | { status: 'retrying'; turnId: string; attempt: number; resumeAt?: number }
  history: HistoryState
  turns: readonly ChatTurn[]
  requests: readonly ChatRequest[]
  todos?: TodoListView
  queue: readonly QueuedPrompt[]
  revertedPrompt?: RevertedPrompt
  composer: ComposerDraft
  capabilities: ChatCapabilities
}>

type TurnState =
  | { status: 'queued' }
  | { status: 'running'; startedAt: number }
  | { status: 'retrying'; attempt: number; error: ChatError; resumeAt?: number }
  | { status: 'complete'; startedAt: number; endedAt: number; stopReason?: string }
  | { status: 'interrupted'; startedAt: number; endedAt: number; reason?: string }
  | { status: 'failed'; error: ChatError; startedAt?: number; endedAt: number }

type ChatTurn = Readonly<{
  id: string
  user: ChatMessage
  assistant: readonly ChatMessage[]
  state: TurnState
  model?: ModelIdentity
  agent?: AgentIdentity
}>
```

A pending request, a streaming part, a retry timer, and a session connection state are separate facts. A single `isLoading` or `status: "blocked"` value must not erase those distinctions.

### Messages and parts

```ts
type MessageDelivery =
  | { status: 'optimistic'; clientId: string }
  | { status: 'confirmed' }
  | { status: 'failed'; error: ChatError; retryable: boolean }

type ChatMessage = Readonly<{
  id: string
  turnId: string
  role: 'user' | 'assistant' | 'system'
  createdAt: number
  delivery: MessageDelivery
  parts: readonly MessagePart[]
}>

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | AttachmentPart
  | CompactionPart
  | RetryPart
  | NoticePart
  | UnknownPart

type PartState =
  | { status: 'streaming' }
  | { status: 'complete' }
  | { status: 'interrupted' }
  | { status: 'failed'; error: ChatError }

type TextPart = Readonly<{
  type: 'text'
  id: string
  markdown: string
  state: PartState
}>

type ReasoningPart = Readonly<{
  type: 'reasoning'
  id: string
  text: string
  state: PartState
  startedAt?: number
  endedAt?: number
}>

type AttachmentDescriptor = Readonly<{
  id: string
  name: string
  kind: 'file' | 'image'
  mediaType?: string
  size?: number
  previewUrl?: string
}>

type AttachmentPart = Readonly<{
  type: 'attachment'
  id: string
  attachment: AttachmentDescriptor
  state: Extract<PartState, { status: 'complete' | 'failed' }>
}>

type CompactionPart = Readonly<{
  type: 'compaction'
  id: string
  summary?: string
  state: PartState
}>

type RetryPart = Readonly<{
  type: 'retry'
  id: string
  attempt: number
  error: ChatError
  resumeAt?: number
}>

type NoticePart = Readonly<{
  type: 'notice'
  id: string
  tone: 'neutral' | 'warning' | 'danger'
  message: string
}>

type UnknownPart = Readonly<{
  type: 'unknown'
  id: string
  partType: string
  data?: JsonValue
}>
```

Step boundaries, snapshots, and other protocol bookkeeping should inform the normalized turn state without automatically producing visible rows. If unknown data is potentially useful, preserve it in `UnknownPart`; do not silently stringify it into assistant prose.

### Tool state

Tool input and execution form one explicit state machine:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

type ToolProgress = Readonly<{
  current?: number
  total?: number
  label?: string
}>

type ToolState =
  | { status: 'receiving-input'; rawInput: string; partialInput?: JsonValue }
  | { status: 'queued'; input: JsonValue }
  | { status: 'running'; input: JsonValue; startedAt: number; progress?: ToolProgress }
  | { status: 'awaiting-permission'; input: JsonValue; requestId: string }
  | { status: 'succeeded'; input: JsonValue; output?: JsonValue; endedAt: number }
  | { status: 'failed'; input?: JsonValue; error: ChatError; endedAt: number }
  | { status: 'cancelled'; input?: JsonValue; endedAt: number; reason?: string }

type ToolPart = Readonly<{
  type: 'tool'
  id: string
  callId: string
  toolName: string
  presentation: ToolPresentation
  state: ToolState
  metadata?: Readonly<Record<string, JsonValue>>
}>

type ToolPresentation =
  | { kind: 'context'; operation: 'read' | 'list' | 'glob' | 'grep' }
  | { kind: 'shell' }
  | { kind: 'file-change'; operation: 'edit' | 'write' | 'patch' }
  | { kind: 'task'; childSessionId?: string; agent?: AgentIdentity }
  | { kind: 'web'; operation: 'fetch' | 'search' }
  | { kind: 'todo' }
  | { kind: 'skill' }
  | { kind: 'generic' }
```

Specialized renderers may refine validated input and output into more precise local types. The canonical fallback retains the tool name, JSON-safe input, output, metadata, error, and request identity. It must never fail because a tool is unknown.

```diagram
receiving-input ─▶ queued ─▶ running ─────────────▶ succeeded
                      │         │  │                    
                      │         │  ├───────────────────▶ failed
                      │         │  └───────────────────▶ cancelled
                      │         ▼
                      └──▶ awaiting-permission ─▶ running
                                      │
                                      └───────────────▶ cancelled
```

Invalid backward transitions are ignored only when they are provably stale or duplicate. Otherwise they become adapter diagnostics rather than being hidden by the component.

### Requests and todos

```ts
type RequestOrigin = Readonly<{
  sessionId: string
  parentSessionId?: string
  label?: string
}>

type RequestState<Decision> =
  | { status: 'pending' }
  | { status: 'submitting'; decision: Decision }
  | { status: 'failed'; decision: Decision; error: ChatError }
  | { status: 'resolved'; decision: Decision }
  | { status: 'expired' }

type PermissionDecision = 'once' | 'always' | 'reject'

type PermissionRequestView = Readonly<{
  type: 'permission'
  id: string
  order: number
  origin: RequestOrigin
  title: string
  effect: string
  consequence: 'reversible' | 'destructive' | 'external'
  scope?: string
  state: RequestState<PermissionDecision>
}>

type QuestionRequestView = Readonly<{
  type: 'question'
  id: string
  order: number
  origin: RequestOrigin
  questions: readonly QuestionView[]
  state: RequestState<QuestionResponse>
}>

type ChatRequest = PermissionRequestView | QuestionRequestView

type QuestionOption = Readonly<{
  id: string
  label: string
  description?: string
}>

type QuestionView =
  | Readonly<{
      type: 'single-choice' | 'multiple-choice'
      id: string
      label: string
      required: boolean
      options: readonly QuestionOption[]
    }>
  | Readonly<{
      type: 'text'
      id: string
      label: string
      required: boolean
      multiline?: boolean
      maxLength?: number
    }>

type QuestionAnswer =
  | Readonly<{
      type: 'choice'
      questionId: string
      optionIds: readonly string[]
    }>
  | Readonly<{
      type: 'text'
      questionId: string
      value: string
    }>

type QuestionResponse = Readonly<{
  answers: readonly QuestionAnswer[]
}>

type TodoItemView = Readonly<{
  id: string
  title: string
  state: 'pending' | 'in-progress' | 'complete' | 'cancelled'
}>

type TodoListView = Readonly<{
  id: string
  state: 'active' | 'complete'
  items: readonly TodoItemView[]
}>
```

Every question and option needs a stable ID. A `QuestionResponse` carries those IDs and typed free-form values so the adapter can produce the exact server payload without parsing visible labels.

Todos are canonical session state, not a repeated tool transcript. The adapter suppresses redundant todo tool bodies after converting their result to one `TodoListView`. The todo surface auto-opens while items are changing, can be manually collapsed, and removes stale state when the server clears the list.

### Drafts, references, and queue

```ts
type DraftSegment =
  | { type: 'text'; id: string; text: string }
  | {
      type: 'reference'
      id: string
      referenceType: DraftReferenceType
      label: string
      value: string
    }

type DraftPoint = Readonly<{ segmentId: string; offset: number }>

type DraftAttachment =
  | Readonly<{
      attachment: AttachmentDescriptor
      state: 'reading'
    }>
  | Readonly<{
      attachment: AttachmentDescriptor
      state: 'ready'
      sourceId: string
    }>
  | Readonly<{
      attachment: AttachmentDescriptor
      state: 'failed'
      error: ChatError
    }>

type ComposerDraft = Readonly<{
  revision: number
  mode: 'prompt' | 'shell'
  segments: readonly DraftSegment[]
  selection: Readonly<{ anchor: DraftPoint; focus: DraftPoint }>
  attachments: readonly DraftAttachment[]
  model?: ModelIdentity
  agent?: AgentIdentity
  variant?: string
}>

type QueuedPrompt = Readonly<{
  id: string
  draft: ComposerDraft
}> &
  (
    | { state: 'queued' | 'submitting' }
    | { state: 'failed'; error: ChatError }
  )

type RevertedPrompt = Readonly<{
  id: string
  turnId: string
  draft: ComposerDraft
}>
```

The structured draft is the public contract regardless of editor implementation. It preserves references and caret position without encoding DOM ranges or a third-party editor model.

A draft always contains at least one text segment. Every selection point names an existing segment, and its offset is valid for that segment. The adapter rejects or repairs invalid persisted drafts before publishing a snapshot; render components do not guess.

An implementation spike must compare:

1. a native textarea with references and attachments rendered outside the text flow; and
2. an owned contenteditable/editor implementation with inline tokens.

The second option is justified only if it passes IME composition, VoiceOver/NVDA, mobile selection, paste, undo/redo, caret restoration, and reference deletion tests materially better. Do not adopt a heavy editor solely to make mention tokens appear inline.

## Component architecture

### Composition rules

- Prefer compound anatomy over a component with dozens of visibility booleans.
- Keep the root controlled when state affects the runtime; allow uncontrolled state only for local disclosure.
- Forward refs and appropriate native props at the DOM-owning part.
- Keep named actions explicit: `onStop`, `onPermissionDecision`, and `onLoadPrevious`, not a generic event callback.
- Preserve stable `data-slot`, `data-state`, and domain ID attributes.
- Expose bounded StyleX style props only where consumers have a legitimate composition need.
- Never make a renderer depend on human-readable tool labels or Markdown text to recover machine state.

Representative composition:

```tsx
<Timeline.Root followState={followState} onFollowStateChange={setFollowState}>
  <Timeline.History state={history} onLoadPrevious={loadPrevious} />
  <Timeline.List items={turns} renderItem={renderTurn} />
  <Timeline.JumpToLatest pendingCount={pendingCount} />
</Timeline.Root>

<Composer.Root state={composerState} onSubmit={submit} onStop={stop}>
  <Composer.Attachments items={draft.attachments} />
  <Composer.Editor draft={draft} onDraftChange={setDraft} />
  <Composer.Suggestions state={suggestionState} />
  <Composer.Toolbar>
    <Composer.ContextActions />
    <Composer.ModelControls />
    <Composer.Submit />
  </Composer.Toolbar>
</Composer.Root>
```

The exact export style may use prefixed named exports rather than namespaces if that produces better source-copy ergonomics. The anatomy and ownership are binding; syntax is not.

### Components to add

| Area | Components |
| --- | --- |
| Timeline | `Timeline`, `HistoryControl`, `JumpToLatest`, `Turn`, `TurnStatus`, `RetryNotice` |
| Parts | `MessageParts`, `CompactionNotice`, `Attachment`, `AttachmentList`, `UnknownPart` |
| Tools | `ContextTool`, `ContextToolGroup`, `ShellTool`, `FileChangeTool`, `TaskTool`, `WebTool`, `SkillTool`, `GenericTool` |
| Requests | `RequestRegion`, `QuestionRequest`, `TodoList`, `TodoDock`, `RevertDock` |
| Composer | compound composer parts, `Mention`, `AttachmentTray`, `CommandMenu`, `PromptHistory`, `QueueList`, `FollowUp` |
| Feedback | `ConnectionNotice`, `SubmissionError`, `StreamStatus` |

Tool bodies should compose the common `ToolActivity` shell. They should not duplicate its state label, disclosure, or announcement behavior.

### Primitives needed by this phase

Add only primitives exercised by chat:

- `ScrollArea` or an owned native-overflow contract with edge state;
- `Tooltip` for icon-only desktop affordances;
- `Popover`, `Combobox`, and `Listbox` for references and selectors;
- `Menu` for message, attachment, and queue actions;
- `Checkbox` and `RadioGroup` for questions and selectors;
- `Toast` or `Alert` for non-local mutation and connection failures; and
- a virtualization boundary with a normal non-virtualized mode for small fixtures.

Use Base UI where it provides behavior. Virtualization and scroll anchoring are not Base UI responsibilities and should be owned behind Pretty Amped APIs.

### Tool-renderer registry

`MessageParts` uses an application-provided, ordered renderer registry. A renderer declares the normalized tool kind or exact tool names it supports. The final renderer is always `GenericTool`.

The registry must:

- choose deterministically;
- validate specialized input before rendering;
- fall back instead of throwing;
- allow app-specific MCP renderers without changing the base component;
- expose the chosen renderer through machine-readable metadata; and
- keep component rendering pure.

This is bounded generative UI: the model/runtime selects a known tool, and reviewed React code renders its state. The model does not generate JSX.

## Transcript behavior

### Projection and order

- One timeline row represents one turn root, not every transport event.
- A turn groups one user message with zero or more assistant messages, parts, retries, and tools.
- Message and part IDs are stable across optimistic confirmation and page refresh.
- The adapter sorts by server order with deterministic ID tie-breaking; the React key never uses an array index.
- Tombstoned entities disappear without allowing a stale page response to resurrect them.
- Tool grouping is a projection. It never changes canonical tool IDs or state.

### Follow state

```ts
type FollowState =
  | { status: 'following' }
  | { status: 'detached'; pendingCount: number }
  | { status: 'restoring'; anchorId: string; offset: number }
```

- Start in `following` at the latest content.
- Continue following while streaming only if the user remains at the bottom threshold.
- Deliberate upward scroll changes to `detached`; new content increments a concise jump control and never moves the viewport.
- Jump-to-latest restores following and focuses only when invoked by keyboard.
- Loading history records the first visible turn and pixel offset, prepends, then restores that anchor to within 1 CSS pixel.
- Resizing Markdown, opening tools, loading fonts, and replacing optimistic rows must not silently re-enable following.
- A focused turn or open disclosure cannot be unmounted by virtualization. Pin it until focus leaves or move focus by an explicit user action.

### History states

History distinguishes `initial-loading`, `ready`, `loading-previous`, `complete`, and `failed`. A failed historical page leaves current messages operable and offers a retry. Concurrent load requests deduplicate. Each historical page includes complete turn roots even when the server page boundary falls within a turn.

### Streaming updates

- Coalesce adjacent text and reasoning deltas before notifying React.
- Pace expensive Markdown rendering independently of transport ingestion; never discard source content.
- Show one activity indicator for the current assistant turn. Individual running tool rows show textual state, not nested spinners.
- Do not remount complete Markdown when a following part changes.
- Treat interruption as a terminal partial result, not an error.

## Tool presentation requirements

### Context tools

Contiguous `read`, `list`, `glob`, and `grep` calls form one calm context group while retaining individually addressable rows. The summary includes operation counts and current state. Details expose path/pattern, range or limit, result count, output, errors, and loaded-file notices.

### Shell tool

Show the exact command in LTR monospace, working-directory context when available, streamed output, exit status, duration, copy action, truncation state, and explicit running/cancelled/failed/completed text. ANSI output must be sanitized. Large output uses a bounded viewport with an explicit reveal/download path supplied by the application.

This is not a PTY. It does not emulate terminal cursor input, process tabs, or interactive stdin.

### File-change tools

Show file identity and add/delete/move/modify state before the diff. Preserve diagnostics and line counts. One-file changes may disclose inline; many-file changes use a summary and per-file rows. Defer expensive diffs until opened and virtualize large results.

### Task/subagent tool

Show agent identity, child-session origin, progress, blockers, terminal state, and a named `onOpenChild` action. A missing or inaccessible child is an explicit recoverable state, not an empty result.

### Web, skill, MCP, and unknown tools

URLs use safe external-link behavior and cannot inject HTML. Skills show known identity and result. MCP and unknown tools use the generic renderer unless the application registers a validated specialization.

## Request region and composer arbitration

The bottom region has one primary interactive owner and optional supplemental state:

```diagram
┌───────────────────────────────────────────────────────────┐
│ Optional todo dock                                        │
├───────────────────────────────────────────────────────────┤
│ Permission request                                        │ priority 1
│ or question request                                       │ priority 2
│ or reverted-prompt recovery                               │ priority 3
│ or composer + queue/follow-up                              │ default
└───────────────────────────────────────────────────────────┘
```

### Selection rules

1. Consider unresolved requests from the current session lineage, including child-session blockers exposed by the adapter.
2. Permissions precede questions because unresolved consequential actions must not be hidden by lower-risk prompts.
3. Within one kind, use server order and then stable ID—not event arrival time.
4. Always display origin when the request belongs to a child session.
5. Bind every response to both request ID and origin session ID. Recheck that the request is still pending before sending.
6. Disable all decisions after the first submission. A failed submission may be retried with the same explicit decision or reset to pending.
7. Never auto-approve because a visually equivalent request was approved earlier; permission policy lives in the adapter.

### Draft and focus preservation

- Replacing the composer captures the full draft revision, semantic selection, and focused subcontrol.
- If focus was inside the composer, move it to the request heading or first decision after the request is painted.
- If focus was elsewhere, announce the request without stealing focus.
- On settlement, restore the composer and exact selection only if the draft revision has not been superseded.
- Restore focus only when focus remained inside the request. Never pull focus back from the transcript, a menu, or another application surface.
- `Escape` must not imply reject, discard a draft, or stop execution.
- Streaming and request updates never focus the composer by default.

### Permission behavior

The visual component offers `Allow once`, `Always allow` when the adapter exposes that capability, and `Reject`. It states the effect, consequence, scope, child origin, submitting decision, failure, and resolution. The adapter owns policy scope, matching, existing-request sweeps, stale asynchronous rechecks, and deduplication.

### Question behavior

Support single choice, multiple choice, and free-form answers in one request. Each control has a real label and validation. Preserve option IDs, ordering, custom answers, dismissal, submitting, and error state. After resolution, the transcript may show a concise immutable answer summary while retaining the exact structured response in adapter state.

### Todo, queue, follow-up, and revert

- Todo state is supplemental and may coexist with the composer or a blocking request.
- Queue items are controlled, editable, removable, and individually failed/retryable.
- Sending while busy follows explicit capabilities: queue, follow-up/steer, or disabled. The component never guesses from session status.
- Stop aborts the active turn but does not clear the queue or draft unless the adapter reports that policy.
- Revert restores a prompt to a controlled draft only after the user chooses to edit/resubmit it. Redo and dismiss are separate actions.

## Composer behavior

### Submission modes

The adapter exposes capabilities for:

- submit now while idle;
- queue while busy;
- steer/follow up while busy;
- execute shell input;
- stop the active turn; and
- retry a failed optimistic submission.

The submit button label and action reflect the selected capability. A disabled control explains why through adjacent text or a tooltip; it does not look interactive and then silently fail.

### Text editing

- Enter behavior is configurable at the composition boundary; the initial default remains Cmd/Ctrl+Enter to submit.
- Never submit during IME composition.
- Preserve native undo/redo, selection direction, multiline paste, and spellcheck policy.
- Inputs remain at least 16 CSS px on mobile.
- Prompt history must not replace a non-empty draft without an explicit action.
- Slash-command and mention menus are caret-aware, keyboard navigable, dismissible, and controlled by the application catalog.
- Shell mode is visibly and semantically distinct and cannot be triggered by interpreting ordinary prose.

### Attachments and references

Support picker, paste, and drop as equivalent input paths. Every attachment shows type, size when known, loading/upload state, invalid/error state, preview when safe, remove, and retry. Drag and drop always has a button alternative.

References preserve typed identity for file, range, resource, and agent values and have a plain-text serialization. Paths and code ranges remain LTR inside RTL UI. Deleting an inline reference is one undoable editing operation.

### Optimistic submission

```diagram
draft ─▶ client message + client parts ─▶ request
              │                           │
              │                           ├─ message confirmed
              │                           ├─ parts confirmed independently
              │                           └─ request fails
              │                                  │
              └──────────────────────────────────┴─ rollback only unconfirmed
                                                        │
                                                        ▼
                                             restore draft + selection
```

The adapter allocates client IDs before sending. Confirmation may arrive independently for the message and each part. On failure, confirmed entities remain; only unconfirmed optimistic state rolls back. Draft restoration checks the submission revision so a newer draft is never overwritten.

## Adapter contract

The adapter should expose an external store compatible with `useSyncExternalStore`:

```ts
interface ChatStore {
  getSnapshot(): ChatSnapshot
  subscribe(listener: () => void): () => void
  loadPrevious(): Promise<void>
  submit(draft: ComposerDraft, intent: 'send' | 'queue' | 'follow-up'): Promise<void>
  stop(turnId: string): Promise<void>
  decidePermission(input: {
    requestId: string
    originSessionId: string
    decision: PermissionDecision
  }): Promise<void>
  answerQuestion(input: {
    requestId: string
    originSessionId: string
    response: QuestionResponse
  }): Promise<void>
  updateDraft(draft: ComposerDraft): void
  updateQueue(queue: readonly QueuedPrompt[]): void
}
```

Blocks may receive this interface. Leaf components receive only the relevant snapshot and callback; they must not import or require a global provider.

### Event responsibilities

The adapter must:

1. detect supported OpenCode protocol behavior through SDK types/capabilities rather than string heuristics;
2. connect, reconnect, and stop without duplicate subscriptions;
3. batch notifications to at most one normal render notification per animation frame under a delta burst;
4. time-slice large page/event reductions so input stays responsive;
5. coalesce adjacent deltas for the same text or reasoning part;
6. preserve stable message/part order and tombstones;
7. hydrate a missing parent before discarding an otherwise valid child event;
8. merge HTTP page results without overwriting newer streamed state;
9. reject stale page, mutation, and request responses by generation/request identity;
10. confirm optimistic messages and parts independently;
11. normalize abort, interruption, retry, provider error, tool error, connection loss, and mutation failure separately;
12. search the permitted session lineage for blockers while preserving exact request origin; and
13. retain raw protocol evidence only in adapter diagnostics, with secrets redacted before any UI exposure.

Do not duplicate OpenCode's application reducer line for line. Use its reducer and E2E behavior as compatibility evidence, then map the resulting observable state into the smaller chat model.

### Event mapping coverage

Reducer fixtures must cover every OpenCode event category that affects this scope:

| Category | Normalized result |
| --- | --- |
| Session status and retry | `activity`, active `TurnState`, retry notice |
| Message create/update/remove | stable `ChatMessage`, delivery confirmation, or tombstone |
| Part create/update/delta/remove | typed `MessagePart`, coalesced content, or tombstone |
| Step start/finish | turn timing and terminal outcome; no ornamental row by default |
| Tool input/call/progress/result/error | one valid `ToolState` transition |
| Permission create/update/remove | request state with exact origin and tool linkage |
| Question create/update/remove | structured question request and answer state |
| Todo update | canonical `TodoListView`, duplicate tool-body suppression |
| Compaction/retry/interruption | distinct part/turn state and recovery action |
| Connection loss/recovery | connection notice without rewriting terminal turn state |

## Accessibility requirements

### Semantics and announcements

- The transcript is a labelled region containing ordered turn articles.
- Do not put the entire token stream in a live `log`; use one coarse live region for events such as “response started,” “permission required,” “response complete,” and failures.
- Tool and turn status remains visible text. Color, icon, spinner, and motion are supplementary.
- Markdown keeps valid heading/list/table/code semantics and sanitizes unsafe content.
- Disclosure labels describe their evidence; icon-only controls have localized accessible names.
- Request errors use `role="alert"`; routine state changes use `role="status"` without repeated token announcements.
- Unknown tools and parts remain named and understandable rather than disappearing.

### Keyboard and focus

- All actions are reachable without pointer, drag, hover, or right-click.
- Visible focus indicators remain at least 3 CSS px and are not clipped by scroll containers.
- Menus, listboxes, comboboxes, radios, and disclosures follow their standard keyboard models.
- Timeline prepend, streaming, tool updates, and optimistic confirmation never reset focus.
- Virtualization pins the focused row and restores focus only through explicit rules.
- Composer shortcuts suppress during IME and do not override platform text-editing shortcuts.
- Request focus follows the preservation rules above and is covered by browser tests.

### Touch, reflow, and international input

- Primary controls prefer 44 × 44 CSS px hit areas; compact desktop visuals may use pseudo-element hit expansion.
- The entire surface reflows at 320 CSS px and 400% zoom without horizontal page scrolling. Code, command, and tool-output regions may scroll internally and are labelled.
- The composer remains visible above the mobile virtual keyboard and safe-area inset.
- Reduced motion removes nonessential transitions without removing status.
- RTL layout is supported while paths, commands, hashes, code, and line coordinates remain LTR.
- IME composition, speech input, dictation, and mobile selection are part of the editor acceptance suite.

### Machine legibility

Machine accessibility is explicit metadata, not hidden ARIA text:

- stable `data-slot`, `data-state`, entity ID, tool-kind, and request-origin attributes;
- exported discriminated unions with no contradictory optional states;
- manifests documenting anatomy, state, actions, side effects, examples, and non-examples;
- deterministic fixtures for every public state; and
- no state inferred from color, animation, visible prose, or DOM order alone.

## Visual and interaction rules

1. One active turn gets one primary activity indicator. Do not nest spinners in tools, reasoning, and composer simultaneously.
2. Tool calls are compact inline rows. Evidence is progressively disclosed rather than nested in inset cards by default.
3. User prompts may use a quiet bounded surface; assistant content remains aligned to the reading column without an enclosing bubble.
4. Requests can use stronger boundaries because they require action, but remain aligned with the composer and transcript measure.
5. Status labels use plain language: `Running`, `Complete`, `Stopped`, `Failed`, `Needs permission`.
6. Code, commands, paths, IDs, timings, and numeric progress use Geist Mono with tabular numerals where appropriate.
7. Streaming changes may animate opacity only when useful; layout movement and fake progress are prohibited.
8. Empty, loading, partial, failure, unavailable, and stale states must be designed alongside success.

The required StyleX token additions are status roles, selected/hover surfaces, overlay layers, code/tool surfaces, diff roles, focus-within composition, z-index layers, and responsive chat geometry. Do not add decorative palette roles that no component uses.

## Performance requirements

Use a deterministic stress fixture with at least 500 turns, 5,000 parts, a 200 KB Markdown response, a 1 MB tool output, and a burst of 1,000 deltas.

| Behavior | Budget |
| --- | --- |
| Normal streaming | No more than one store notification per animation frame; p95 React commit below 16 ms in the reference browser fixture |
| Event burst | Composer remains responsive; no long task above 50 ms caused by one unbounded reduction |
| Timeline DOM | Bounded through turn-level virtualization after a measured threshold; focused/open rows may be pinned |
| History prepend | First visible anchor moves less than 1 CSS px after restoration |
| Detached follow | Zero programmatic viewport movement while new parts arrive |
| Large Markdown | Source remains complete; parsing/rendering is paced and does not remount unrelated completed parts |
| Tool output | Initial DOM is bounded; full evidence is disclosed or exported intentionally |
| Cached revisit | Render stable cached rows first; reconciliation may update them without replacing all row identities |

Record the browser, CPU throttle, fixture version, and sample count with performance results. Budgets may change only with measured evidence, not to make a regression pass.

## Test specification

### Component fixtures

Every component ships deterministic fixtures for:

- default, empty, busy, partial, complete, interrupted, failed, stale, and unavailable states that apply;
- short and pathological copy, Unicode, long paths/commands, and hostile Markdown;
- light, dark, forced-colors, reduced-motion, RTL, 200% text, 400% zoom, and 320 px width;
- mouse, touch, keyboard, and focus-visible behavior; and
- all meaningful state transitions, not only terminal screenshots.

### Reducer and race fixtures

At minimum:

1. ordinary text and reasoning stream;
2. partial tool JSON followed by call, progress, success, failure, and cancellation;
3. duplicate and out-of-order events;
4. part event before parent message with targeted hydration;
5. event delta arriving while an older HTTP page is in flight;
6. tombstone followed by a stale page;
7. optimistic message confirmation before parts and parts before message;
8. failed submit after partial confirmation;
9. abort versus provider failure;
10. retry with updated attempt and resumed stream;
11. permission removed while a response mutation is in flight;
12. duplicate permission decision attempt;
13. child-session permission and question routing;
14. todo replacement and clearing; and
15. reconnect without duplicate messages, parts, tools, or announcements.

### Browser workflows

1. Load latest session, detach from bottom, receive output, and jump to latest.
2. Load previous history and preserve the exact visible anchor.
3. Submit optimistically, reconcile, stream Markdown/reasoning/tool state, then complete.
4. Stop during text and during a shell tool; preserve partial content.
5. Receive a child permission while typing, decide once, and restore draft, selection, and focus.
6. Fail a permission reply, retry it once, and prevent a duplicate decision.
7. Answer mixed question types with validation and exact payload IDs.
8. Add/remove/retry attachments through button, paste, and drop paths.
9. Select a reference and slash command entirely by keyboard without submitting during IME.
10. Queue, edit, remove, fail, and retry a prompt while the session is busy.
11. Revert a prompt into the composer without overwriting a newer draft.
12. Exercise every specialized tool and the unknown-tool fallback.

### Quality gates

- TypeScript and StyleX compilation.
- Component/reducer unit tests.
- Browser interaction and focus tests.
- Automated accessibility scan with no serious or critical violations.
- Manual screen-reader smoke test for streaming, tools, one permission, and one question.
- Stress-fixture performance budgets.
- Inspected desktop and mobile screenshots only after the behavior checks pass.
- One end-to-end run against a freshly started, isolated OpenCode server.

## Delivery plan

Work in vertical, reviewable changes. Preserve behavior while refactoring an existing component, verify it, then add new behavior.

### Phase 0 — contracts and evidence harness

**Deliverables**

- Side-effect-free chat contracts and invariant tests.
- OpenCode event/page fixture corpus covering the mapping table.
- A fixture runner that replays events at controllable speed.
- Browser-test setup and an accessibility/performance stress route.
- The tool-renderer registry contract with a guaranteed fallback.

**Exit criteria**

One fixture reduces to a stable turn with streaming text, one tool, and a terminal state. Duplicate replay produces the same snapshot. Components are not yet connected to OpenCode.

### Phase 1 — transcript core

**Depends on:** Phase 0.

**Deliverables**

- Evolved `Message`, `Response`, `Markdown`, and `Reasoning` contracts.
- New `Turn`, `MessageParts`, `RetryNotice`, and compaction presentation.
- Timeline block with follow/detached state, history control, jump-to-latest, stable anchoring, and turn virtualization.
- Coarse live-region announcements and focus pinning.

**Exit criteria**

The stress fixture streams, detaches, prepends history, opens disclosures, and retains scroll/focus within budget on desktop and mobile.

### Phase 2 — coding tools

**Depends on:** Phases 0–1.

**Deliverables**

- Evolved `ToolActivity` state/anatomy.
- Context aggregation and read/list/glob/grep details.
- Shell output, file-change/diff, task/subagent, web, skill, and generic tool components.
- Bounded output, sanitization, error, permission, cancellation, and expansion policies.

**Exit criteria**

Every tool-state transition renders from fixtures; unknown input cannot crash the transcript; the timeline still shows only one primary activity indicator.

### Phase 3 — requests and todos

**Depends on:** Phases 0–2.

**Deliverables**

- `RequestRegion` arbitration.
- Evolved permission component with once/always/reject and origin.
- Question request, validation, and immutable answer summary.
- Canonical todo list/dock and suppression of redundant todo tool bodies.
- Request focus, draft capture, stale-response, and duplicate-response tests.

**Exit criteria**

A permission or question from a child session can replace the composer, submit exactly once, recover from failure, and restore the untouched draft and semantic selection.

### Phase 4 — rich composer and queue

**Depends on:** Phases 0 and 3. The editor spike occurs first.

**Deliverables**

- Compound composer API over `ComposerDraft`.
- References, attachment tray, picker/paste/drop, command menu, shell mode, and prompt history.
- Controlled model, agent, and variant slots.
- Queue, follow-up, stop, optimistic failure, and revert surfaces.
- IME, undo/redo, caret, screen-reader, mobile keyboard, and draft-revision tests.

**Exit criteria**

All composer browser workflows pass without protocol knowledge in component props. The chosen editor has documented evidence against the rejected alternative.

### Phase 5 — OpenCode adapter vertical slice

**Depends on:** Phases 0–4.

**Deliverables**

- External chat store using the official OpenCode SDK.
- Latest/history loading, event reduction, batching, reconciliation, tombstones, and reconnection.
- Optimistic submit, independent confirmation, interruption, retry, and rollback.
- Permission/question routing and request-lineage resolution.
- Mapping into the library contracts and one isolated-server E2E harness.

**Exit criteria**

The smallest credible vertical slice below passes live. No OpenCode type is exported from foundations, primitives, components, or blocks.

### Phase 6 — parity hardening

**Depends on:** live evidence from Phase 5.

**Deliverables**

- All remaining built-in tool and message-part fixtures.
- Reconnection, stale-response, long-session, large-output, and cached-revisit hardening.
- Forced-colors, RTL, zoom/reflow, reduced-motion, touch, and assistive-technology fixes.
- Component manifests with anatomy, state, actions, effects, examples, and non-examples.
- Final visual pass using the established quiet-surface rules.

**Exit criteria**

Every requirement and quality gate in this specification has durable evidence. Known differences from OpenCode are documented as intentional product decisions rather than untested gaps.

## Smallest credible vertical slice

Before widening the component catalog, prove one real session that can:

1. connect to one freshly started isolated OpenCode server and open a known session;
2. render latest and historical turns with stable IDs;
3. submit a text prompt optimistically and reconcile message and parts independently;
4. stream Markdown, reasoning, one context tool, one shell tool, and the generic fallback;
5. distinguish complete, interrupted, retrying, provider failure, and tool failure;
6. stop a busy response without losing partial content;
7. replace the composer with a child-session permission, send exact `once`, and restore the untouched draft and caret;
8. auto-follow only at the bottom and prepend history without moving viewed content; and
9. pass keyboard, focus, touch-target, reduced-motion, 320 px reflow, automated accessibility, and stress-fixture checks.

Static gallery states are necessary but do not satisfy this slice.

## Definition of done for chat parity

Chat-interface parity is complete only when:

- every OpenCode message/part/tool/request event in this scope has a fixture and normalized result;
- latest load, historical prepend, reconnection, optimistic confirmation, tombstones, and stale responses cannot duplicate or lose visible state;
- every built-in chat tool has an appropriate renderer or intentionally uses the lossless generic fallback;
- the composer supports the complete draft, command, attachment, selection, model, queue, stop, and recovery contract;
- permission, question, todo, queue, follow-up, and revert behavior preserves exact identity, payload, draft, selection, focus, and origin;
- the transcript remains stable and responsive under the stress fixture;
- all component and browser quality gates pass in light, dark, forced-colors, reduced-motion, RTL, zoom, and mobile states; and
- the entire workflow passes against a current isolated OpenCode server without importing protocol code into the reusable library.

Only after this definition is met should project navigation, files/review, terminal, or desktop-shell parity become the active implementation target.

## OpenCode source map for this phase

- Session timeline: [`packages/app/src/pages/session/timeline`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/pages/session/timeline)
- Composer and request docks: [`packages/app/src/pages/session/composer`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/pages/session/composer)
- Prompt state and submission: [`packages/app/src/components/prompt-input`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/components/prompt-input)
- Message-part dispatch: [`packages/session-ui/src/components/message-part.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/message-part.tsx)
- Turn composition: [`packages/session-ui/src/components/session-turn.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/session-turn.tsx)
- Event transport and protocol adaptation: [`packages/app/src/context/server-sdk.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-sdk.tsx)
- Session state and reconciliation: [`packages/app/src/context/server-session.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session.ts)
- V2 transitions: [`packages/app/src/context/server-session-v2-reducer.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session-v2-reducer.ts)
- Permission policy: [`packages/app/src/context/permission.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/permission.tsx)
- Graphical E2E behavior: [`packages/app/e2e`](https://github.com/anomalyco/opencode/tree/dev/packages/app/e2e)
