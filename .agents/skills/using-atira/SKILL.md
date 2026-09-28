---
name: using-atira
description: Builds React agent interfaces with Atira components, primitives, blocks, themes, and chat contracts. Use when choosing, composing, integrating, or explaining @atiraui packages and their public components.
---

# Using Atira

Use Atira to present agent activity in React 19. The application owns providers,
transport, credentials, persistence, and runtime mutations. Atira owns accessible
presentation and interaction. Never pass provider events or SDK clients directly
to Atira; normalize them into `@atiraui/foundations/chat` types first.

## Choose the layer

What is being built?

```text
Complete chat surface backed by an application store
└─ Use ChatSession from @atiraui/blocks

Long transcript with custom controls around it
└─ Use Timeline from @atiraui/blocks

Agent-aware UI assembled by the application
└─ Use @atiraui/components

General controls or low-level interaction pieces
└─ Use @atiraui/primitives

Types, themes, or design tokens
└─ Use @atiraui/foundations
```

Start at the highest layer that fits. Do not rebuild timeline virtualization,
request arbitration, composer state, or message-part dispatch from primitives.
Drop to a lower layer only when the application needs to own that composition.

## Before writing code

1. Check the target package's `package.json` exports and corresponding source
   entry point. Primitives, components, and blocks use `src/index.ts`;
   foundations uses explicit subpath modules.
2. Read the component's props type and its nearest test or demo example. Props in
   source are authoritative; do not invent prop names from this guide.
3. For chat work, read `packages/components/src/chat.manifest.json` and
   `packages/blocks/src/chat.manifest.json`. Their `useWhen`, `avoidWhen`, states,
   and accessibility fields define the intended contract.
4. Reuse `apps/demo/src/catalog-examples/` for small examples and
   `apps/demo/src/component-gallery.tsx` for representative states.

## Components

### Blocks: complete compositions

- `ChatSession`: complete controlled chat surface: timeline, requests, queue,
  recovery, and composer. Use when the app can provide a `ChatStore`.
- `Timeline`: virtualized transcript with history loading, detached scrolling,
  and jump-to-latest behavior. Use for long `ChatTurn` collections.
- `HistoryControl`: load-earlier, loading, complete, and failure UI for history.
- `JumpToLatest`: returns a detached transcript to the newest turn.
- `useChatStore`: subscribes React to a `ChatStore` with
  `useSyncExternalStore`.

### Components: agent interface pieces

**Conversation**

- `Thread`: semantic shell for a short, application-composed message list.
- `Turn` / `TurnStatus`: one normalized user/assistant turn and its lifecycle.
- `MessageParts`: dispatches normalized message parts, including custom tools.
- `Message`: visual and semantic shell for one user, assistant, or system
  message when working below the normalized turn model.
- `Response`: streaming, complete, interrupted, or failed response content.
- `Markdown`: safe model-authored Markdown with streaming presentation.
- `Reasoning`: disclosed reasoning with thinking and complete states.

**Tool and agent activity**

- `ToolActivity`: one tool lifecycle row with optional disclosed evidence.
- `ContextTool`, `ShellTool`, `FileChangeTool`, `TaskTool`, `WebTool`,
  `SkillTool`, and `ImageGenerationTool`: specialized renderers for normalized
  `ToolPart` presentations.
- `ContextToolGroup`: condenses adjacent context reads into one disclosure.
- `GenericTool`: lossless fallback for unknown or unvalidated tools.
- `Activity`: generic queued/running/waiting/terminal activity row.
- `ActivityList`: expanded or disclosed collection of activities.
- `Loader`: compact pending, streaming, or complete status.

**Composer and recovery**

- `Composer`: simple controlled text composer. Use for a text-only prompt box.
- `ChatComposer`: structured `ComposerDraft` editor with runtime-gated models,
  agents, references, attachments, shell mode, queueing, follow-up, and stop.
- `AttachmentTray` / `ReferenceTray`: structured draft attachments and refs.
- `PromptHistory`: selects an earlier prompt into the controlled draft.
- `QueueList`: edits, retries, or removes queued prompts.
- `ConnectionNotice`, `SubmissionError`, and `StreamStatus`: connection,
  mutation failure, and coarse screen-reader stream feedback.

**Requests and task state**

- `RequestRegion`: selects one active permission/question ahead of the composer
  and manages focus. Prefer it over manually stacking requests.
- `PermissionPrompt`: renders a normalized chat permission request.
- `QuestionRequest`: renders one or more normalized runtime questions.
- `QuestionAnswerSummary`: read-only summary for a resolved question request.
- `TodoDock`: progress for the runtime's normalized todo list.
- `RevertDock`: restore, redo, or dismiss a reverted prompt.
- `PermissionRequest`: standalone approval card outside the `ChatStore` flow.

**Results and content**

- `CodeBlock`: labelled code with filename, language, wrap, and copy behavior.
- `Diff`: one or more files with hunks and accessible line semantics.
- `Artifact`: file, image, portal, or result lifecycle with optional open action.
- `GeneratedImage`: generating, failed, load-failed, and ready image states.
- `Plan`: proposed, active, partial, or complete ordered work plan.
- `Outcome`: blocked, cancelled, complete, failed, or reviewable result.
- `CitationList` / `InlineCitation`: source list and safe inline references.
- `Actions` / `Action`: labelled message action group and icon actions.
- `Suggestions` / `Suggestion`: selectable starter or follow-up prompts.

### Primitives: general controls

- `Button` / `IconButton`: standard text and accessible icon-only actions.
- `TextField` / `TextareaField` (`ComposerField` alias): labelled controlled or
  uncontrolled inputs with descriptions and invalid states.
- `CheckboxField`, `RadioGroup`, `RadioOption`, `SelectPicker`: choices and
  selection. `SelectPickerParts` is unstyled Base UI, not a styled replacement.
- `ActionMenu`: short action list; `FilterMenu`: searchable item selection.
- `Dialog`: styled modal composition. `DialogParts` is unstyled Base UI.
- `Disclosure`: controlled or uncontrolled show/hide region.
- `Progress`: determinate or indeterminate progress with a visible label.
- `Status`: compact live status text; `Spinner`: visual busy indicator;
  `Shimmer`: animated text treatment.
- `VisuallyHidden`: screen-reader-only content.
- Presence exports (`PresenceSurface`, `ActivityPresence`, `ActivitySlot`,
  `PresenceItem`, `StateTransition`, `TextTransition`): Atira's low-level motion
  vocabulary. Use them only when extending an existing Atira interaction pattern.

## Minimal usage

Atira is currently unpublished. Inside this repository, import workspace
packages directly. After a public npm release, install the needed `@atiraui/*`
packages from npm.

When using compiled artifacts, import each used package's CSS once and apply a
theme at an ancestor:

```tsx
import '@atiraui/foundations/styles.css'
import '@atiraui/primitives/styles.css'
import '@atiraui/components/styles.css'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '@atiraui/foundations/themes'
import { Composer, Message, Response } from '@atiraui/components'
import { useState } from 'react'

export function AgentPanel() {
  const [value, setValue] = useState('')

  return (
    <main {...stylex.props(lightTheme)}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <Message actor="assistant" label="Assistant response">
          <Response status="complete">How can I help?</Response>
        </Message>
      </ol>
      <Composer
        value={value}
        onValueChange={setValue}
        onSubmit={(prompt) => {
          // Send through application-owned runtime code.
          setValue('')
        }}
      />
    </main>
  )
}
```

For a complete chat surface, keep the runtime adapter outside the component:

```tsx
import '@atiraui/foundations/styles.css'
import '@atiraui/primitives/styles.css'
import '@atiraui/components/styles.css'
import '@atiraui/blocks/styles.css'
import { ChatSession } from '@atiraui/blocks'
import type { ChatStore } from '@atiraui/foundations/chat'

export function AgentChat({ store }: { store: ChatStore }) {
  return <ChatSession label="Agent conversation" store={store} />
}
```

The adapter must expose immutable `ChatSnapshot` values, stable turn/message/part
IDs, exact request IDs and origins, and named `ChatStore` mutations. Map raw tool
data to explicit `ToolPresentation` fields; preserve unknown tools with
`GenericTool` rather than guessing meaning from arbitrary JSON keys.

## Composition rules

- Keep state controlled when a component exposes `value`, `open`, `state`, or a
  domain object. Update it through the matching callback.
- Render controls only when the runtime capability and callback exist. Never show
  retry, stop, attach, redo, or open actions that cannot work.
- Use `MessageParts` or `Turn` for normalized chat data; use `Message` and
  `Response` for hand-composed content. Do not mix both models for the same turn.
- Use `GenericTool` when specialized `ToolPresentation` validation fails.
- Keep commands, paths, raw input/output, and diffs as evidence. Do not replace
  them with a friendly summary that loses information.
- Use `className`, `style`, or `xstyle` only for local layout/customization.
  Preserve component anatomy and state attributes.
- Menus and selects inherit their local theme. If clipping requires a portal,
  pass `portalContainer` pointing to an unclipped ancestor inside that theme.
- Do not add a second live region or spinner around components that already
  announce lifecycle state.

## Verify

For a focused change, run the affected package typecheck and test first. Before
handoff, run the relevant repository checks from `package.json`. For visual work,
open the demo catalog, inspect the changed component's active and terminal states
at desktop and mobile widths, and exercise keyboard interaction.
