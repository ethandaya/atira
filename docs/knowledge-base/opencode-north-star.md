# OpenCode UI replacement north star

Research snapshot: **September 3, 2026**

Reference: [`anomalyco/opencode`](https://github.com/anomalyco/opencode), current default `dev` branch at the time of research.

## Decision

OpenCode's graphical web/desktop client is the north star for Pretty Amped.

The target is not a visual clone and not a port of SolidJS components to React. The target is a React 19 + StyleX component system and reference application capable of replacing OpenCode's graphical UI while preserving its observable behavior:

- session, message, part, and tool state;
- streaming, pagination, reconciliation, interruption, and recovery;
- prompt drafting, mentions, attachments, commands, queueing, and rollback;
- permissions, questions, todos, and child-session blockers;
- files, diffs, review comments, and terminal workflows;
- projects, servers, models, providers, settings, tabs, and routing;
- keyboard, focus, screen-reader, touch, reflow, and reduced-motion behavior; and
- the desktop platform security and lifecycle boundary.

Visual design may become substantially quieter and more coherent. Protocol payloads, state transitions, persistence scope, focus ownership, and consequential action semantics may not change accidentally.

The terminal TUI is outside the replacement scope except where it exposes runtime behavior that the graphical client must preserve.

## Why this changes the roadmap

The earlier 50-component tracker is useful as an AI-component vocabulary, but it is not a replacement specification. OpenCode is a workbench, not a chat page. Its difficult parts are the relationships between streaming state, optimistic state, requests, navigation, files, terminals, and persistence.

A screenshot-equivalent transcript could still be unusable if it:

- shifts while older history is prepended;
- duplicates optimistic messages when server events arrive;
- loses a draft when a permission request replaces the composer;
- treats interruption as failure;
- sends a permission reply for the wrong child session;
- routes a tab to the wrong server or directory;
- binds terminals to sessions instead of workspaces;
- loses review selection or terminal focus after navigation; or
- bypasses the desktop preload boundary.

Therefore reducer fixtures, focus tests, protocol assertions, persistence migrations, and end-to-end workflows are parity evidence. Screenshots are design evidence only.

## Reference architecture

OpenCode's graphical surface is split across four primary packages:

| Reference package | Responsibility |
| --- | --- |
| [`packages/ui`](https://github.com/anomalyco/opencode/tree/dev/packages/ui) | Themes, icons, typography, accessible primitives, overlays, feedback, and shared visual utilities |
| [`packages/session-ui`](https://github.com/anomalyco/opencode/tree/dev/packages/session-ui) | Messages, parts, tools, Markdown, files, diffs, review, turns, and prompt input |
| [`packages/app`](https://github.com/anomalyco/opencode/tree/dev/packages/app) | Routes, providers, synchronization, session workbench, composer integration, commands, settings, servers, models, and persistence |
| [`packages/desktop`](https://github.com/anomalyco/opencode/tree/dev/packages/desktop) | Electron preload/main boundary, sidecar, filesystem, updater, native menu, notifications, WSL, windows, and diagnostics |

The replacement boundary should remain similarly explicit:

```diagram
┌─────────────────────────────────────────────────────────────┐
│ OpenCode server / SDK event and request contracts           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenCode adapter                                            │
│ protocol compatibility · event reduction · optimistic state │
│ caches · persistence · commands · platform capabilities     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Reference application                                      │
│ router · workbench · timeline · docks · files · terminal    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Pretty Amped                                                │
│ blocks → AI components → owned primitives → StyleX tokens   │
└─────────────────────────────────────────────────────────────┘

          ┌─────────────────────────────────────────┐
          │ Desktop platform adapter                │
          │ typed IPC · pickers · storage · updater │
          └─────────────────────────────────────────┘
```

Protocol-specific types must stop at the adapter. Reusable components receive controlled, library-owned view models and named callbacks. Conversely, protocol reconciliation must not be reimplemented inside render components.

## Current Pretty Amped baseline

### Shipped foundation

- React 19.2 and source-consumed workspace packages.
- StyleX 0.19 semantic variables and scoped light/dark themes.
- Geist and Geist Mono.
- A small spacing, radius, typography, motion, and neutral color vocabulary.
- Base UI-backed interactive primitives where an accessible behavior primitive is useful.
- Stable `data-slot` and `data-state` markers.
- WCAG 2.2 AA policy, 44 px target preference, 3 px focus rings, 16 px mobile inputs, reduced-motion handling, and explicit state text.

Sources: [`tokens.stylex.ts`](../../packages/foundations/src/tokens.stylex.ts), [`themes.ts`](../../packages/foundations/src/themes.ts), and [`accessibility.md`](accessibility.md).

### Shipped primitives

`Button`, `IconButton`, `TextField`, `TextareaField` / `ComposerField`, `Disclosure`, `Dialog`, `Status`, `Progress`, `Spinner`, `Shimmer`, and `VisuallyHidden`.

Source: [`packages/primitives/src/index.ts`](../../packages/primitives/src/index.ts).

### Shipped AI presentation

`Thread`, `Message`, `Response`, `Markdown`, `Composer`, `Reasoning`, `Loader`, `Activity`, `ActivityList`, `ToolActivity`, `Outcome`, `PermissionRequest`, `Plan`, `Diff`, `CodeBlock`, `CitationList`, `InlineCitation`, `Artifact`, `Actions`, and `Suggestions`.

Source: [`packages/components/src/index.ts`](../../packages/components/src/index.ts).

### Current proving surface

The demo proves source consumption, themes, responsive basics, streamed Markdown, cancellation, and a real Nanocodex tool lifecycle. It does not prove OpenCode integration, durable synchronization, a coding workbench, or the critical state races below.

There is currently no component unit-test suite, Storybook state matrix, browser regression suite, protocol fixture suite, or visual regression suite. The gallery is useful review coverage but not compatibility evidence.

## Status legend

- **Ready** — sufficiently close to use in an initial OpenCode-backed slice.
- **Partial** — useful visual/API foundation, but missing required states or scale behavior.
- **Missing** — no reusable implementation exists.
- **Adapter** — belongs in OpenCode-specific state/integration code, not the generic component package.
- **Platform** — belongs behind the desktop capability boundary.

## Gap analysis: foundations and primitives

| Capability | Status | Gap to OpenCode replacement | Priority |
| --- | --- | --- | --- |
| Semantic color tokens | Partial | Missing overlay, input, selection, icon, agent, diff, syntax, Markdown, terminal, success/warning, and review-specific roles | P0 |
| Spacing/type/radius tokens | Partial | No density modes, elevation/shadow model, pane dimensions, z-index layers, or workbench geometry | P0 |
| Themes | Partial | Only one light and dark palette; no system mode controller, preview, cross-window sync, theme catalog, forced-colors strategy, or generated syntax/diff roles | P1 |
| Typography | Partial | Geist choice is valid, but code/editor/terminal metrics, tabular data, dense utility text, international scripts, and zoom/reflow matrices are unproven | P0 |
| Motion | Partial | Basic timings only; no shared enter/exit, pane, DnD, tab, list-reconciliation, spring, or interrupted-animation contracts | P1 |
| Icons | Missing | Need typed general, file/folder, provider, model, agent, app/editor, tool, and status icon sets with accessible wrappers | P1 |
| Button/IconButton | Ready | Add busy, split-button, toggle/pressed, tooltip integration, and denser desktop variants without shrinking touch hit areas | P0 |
| Text fields/textareas | Partial | Need validation, prefix/suffix, inline edit, search, clear, shortcut hints, token/mention affordances, and async suggestion ownership | P0 |
| Checkbox/Switch/RadioGroup | Missing | Required by settings, questions, filters, permissions, and selection workflows | P0 |
| Select/Combobox/Listbox | Missing | Required by models, agents, providers, servers, projects, files, commands, themes, and search | P0 |
| Tabs/Segmented control | Missing | Required by titlebar, sessions, files, terminals, settings, review modes, and mobile session/changes mode | P0 |
| Menu/Context menu | Missing | Required for rows, tabs, sessions, projects, files, terminals, models, and native-menu parity | P0 |
| Popover/HoverCard/Tooltip | Missing | Required for selectors, status, previews, icon actions, shortcuts, and disclosure of dense metadata | P0 |
| Toast/Alert | Missing | Required for mutation results, connection failures, share/update state, request errors, and background requests | P0 |
| Drawer/Sheet | Missing | Required for responsive navigation, files, settings, and secondary mobile workbench surfaces | P1 |
| Card/Badge/Tag/Avatar | Missing | Required for provider/model/agent identity, attachments, status, sessions, and structured metadata | P1 |
| Scroll area | Missing | Need keyboard-focusable overflow, edge affordances, scroll anchoring, restored position, and nested-pane behavior | P0 |
| Resize handle/split pane | Missing | Need pointer and keyboard resizing, bounds, persisted sizes, double-click reset, and non-drag alternatives | P0 |
| Virtual list | Missing | Required for long timelines, sessions, files, diffs, and search without focus or scroll instability | P0 |
| Tree | Missing | Required for files, changed files, projects, and nested sessions; needs keyboard tree semantics and non-drag actions | P1 |
| Drag and drop | Missing | Required for tabs/tree ordering and attachments; must include keyboard announcements and ordinary action alternatives | P1 |
| Progress/Spinner/Shimmer | Ready | Add determinate download/update variants and ensure aggregate statuses never create duplicate activity indicators | P1 |
| Dialog | Partial | Basic modal exists; needs stacked dialog management, drawers, alert decisions, command palette composition, and cross-route focus restoration | P0 |
| Disclosure | Ready | Add accordion grouping, sticky disclosure headers, controlled persistence, and virtualization-safe expansion | P1 |
| Image/media preview | Missing | Needed for attachments and generated/file artifacts, including loading, invalid, unavailable, zoom, open, and save states | P1 |

OpenCode reference: [`packages/ui/src/components`](https://github.com/anomalyco/opencode/tree/dev/packages/ui/src/components) and [`packages/ui/src/v2/components`](https://github.com/anomalyco/opencode/tree/dev/packages/ui/src/v2/components).

## Gap analysis: conversation and agent UI

| Capability | Status | Gap to OpenCode replacement | Priority |
| --- | --- | --- | --- |
| Thread/timeline | Partial | Current `Thread` is a static list. Need paginated prepend, virtualization, stable rows, bottom anchoring, jump-to-latest, tab restoration, loading/error boundaries, and focused-item retention | P0 |
| Turn grouping | Missing | Need one user turn plus assistant messages, tool groups, retries, interruption, duration, model/agent metadata, change summaries, and turn actions | P0 |
| Message | Partial | Need stable part anatomy, rich user mentions, attachments, review comments, copy, revert, metadata, synthetic messages, and lineage | P0 |
| Response lifecycle | Partial | Basic streaming/complete/interrupted/failed exists; missing retry state, provider errors, partial completion, compaction, shell semantic messages, and turn-level outcomes | P0 |
| Markdown | Partial | Streaming GFM exists; missing pacing for large deltas, worker/cache strategy, syntax highlighting policy, math, code actions, hostile-content fixtures, and long-response performance limits | P0 |
| Reasoning | Partial | Missing provider state, start/end timing, changing labels without summaries, grouped reasoning, and suppression rules | P0 |
| Generic tool activity | Partial | Lifecycle is strong, but OpenCode maps `pending/running/completed/error`, partial JSON input, raw input, metadata, files, diagnostics, and per-tool expansion defaults | P0 |
| Context tool group | Missing | Contiguous read/list/glob/grep calls need one calm aggregate row with disclosed details and counts | P0 |
| Read/list/glob/grep tools | Missing | Need path, pattern, include, offset/limit, result count, scrollable output, loaded-file notices, and grouped context semantics | P0 |
| Web fetch/search tools | Missing | Need safe URL rendering, provider-aware labels, extracted sources, unavailable links, and external-link policy | P1 |
| Task/subagent tool | Missing | Need agent identity/color, child session navigation, background state, nested blockers, progress, and missing-child recovery | P0 |
| Shell/bash tool | Missing | Need command, streaming output, ANSI handling, copy, overflow, running/open defaults, cancellation, failure, and distinction from interactive PTY | P0 |
| Edit/write/patch tools | Missing | Need file identity, add/delete/move/modify states, diagnostics, change counts, one/many-file disclosure, deferred diffs, and virtualized large output | P0 |
| Todo tool and dock | Partial | `Plan` is present, but canonical todos must replace hidden tool parts, auto-open while live, animate close safely, and clear stale state | P0 |
| Question tool and dock | Missing | Need single/multiple choice, free-form answers, validation, dismiss semantics, responding/error states, transcript summary, and exact payload preservation | P0 |
| Skill/MCP/unknown tools | Missing | Need known skill presentation and a robust generic fallback preserving tool identity, input, output, metadata, errors, and approval state | P1 |
| Tool error/retry | Partial | Generic failure exists; missing normalized provider/tool errors, terminal retry status, contextual recovery, and distinction from interrupted execution | P0 |
| Permission request | Partial | Need `once/always/reject`, submitting/failure, child-session origin, remembered-policy explanation, auto-accept scope, duplicate-response prevention, and draft restoration | P0 |
| Outcome | Partial | Useful terminal presentation; must distinguish execution success, review readiness, reviewed state, interruption, retry, and runtime/session errors | P1 |
| Message actions | Partial | Need copy, retry, revert, redo, fork, share/unshare, open child, open file, inspect evidence, and disabled/busy states | P1 |
| Attachments | Missing | Need image/file cards, picker/paste/drop, progress, type/size, preview, remove/retry, tokenized desktop reads, and request-part construction | P0 |
| Mentions and references | Missing | Need file, selected range, resource, agent, and review-comment tokens; async search; keyboard navigation; serialization; and plain-text fallback | P0 |
| Suggestions/history/commands | Partial | Suggestions exist; missing slash commands, shell mode, prompt history, caret-aware completion, IME behavior, and searchable command catalog | P0 |
| Composer | Partial | Current textarea covers only text/send/stop. Need rich draft state, queue/follow-up, edit, shell mode, model/agent/variant, attachments, mentions, commands, history, request replacement, and optimistic recovery | P0 |
| Queue/follow-up/revert docks | Missing | Need queued prompts, steer/edit/remove, reverted prompt restoration, and arbitration with permission/question/todo docks | P0 |
| Context usage/controls | Missing | Need context-window usage, model/agent/variant controls, paid/unavailable states, and compact responsive presentation | P1 |

OpenCode reference: [`message-part.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/message-part.tsx), [`session-turn.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/session-turn.tsx), and [`prompt-input`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/components/prompt-input).

## Gap analysis: coding workbench and application shell

| Capability | Status | Gap to OpenCode replacement | Priority |
| --- | --- | --- | --- |
| Connection gate/status | Missing | Server health, reconnecting, incompatible/unavailable server, credentials, alternate server, and recovery states | P0 |
| Application/titlebar shell | Missing | Window-safe titlebar, route identity, portals, right mounts, tab strip, update state, native drag regions, and responsive utility actions | P1 |
| Projects/workspaces/sessions home | Missing | Recent projects, worktrees, grouped sessions, archive/rename/search, empty/loading/error states, and keyboard navigation | P1 |
| Session tabs | Missing | Server+directory+session identity, drafts, close/reopen, preview/pinned, reorder, overflow, atomically selected neighbor, and persistence | P1 |
| Session workbench layout | Missing | Conversation, files, review, and terminal visibility; resizable panes; stacked review+terminal; mobile mode; safe areas; persisted dimensions | P1 |
| File tree | Missing | Lazy loading, search/filter, changed status, keyboard navigation, context actions, DnD alternative, and file-type icons | P1 |
| File viewer | Partial | `CodeBlock`/`Diff` are small output components. Need full text/media files, line numbers, search, selection, annotations, large-file virtualization, loading/error/binary states, and editor opening | P1 |
| Review panel | Missing | Changed-file tree/filter, git/snapshot modes, unified/split diff, comments, focused ranges, file persistence, empty/no-git states, and scaling | P1 |
| Diff engine | Partial | Current structured diff is non-virtualized and presentation-only. Need robust parsing/normalization, huge files, line selection, annotations, syntax, comments, worker reuse, and per-tool/session/turn contexts | P1 |
| Interactive terminal | Missing | Ghostty/xterm surface, PTY tabs, connection, resize, buffer/scroll/cursor persistence, focus ownership, reconnect, exit/error, and workspace scope | P1 |
| Command palette | Missing | Dynamic contextual command registry, combobox, categories, shortcuts, custom bindings, duplicate precedence, and editable-target suppression | P1 |
| Model/agent selector | Missing | Connected providers, unavailable/paid states, recents, visibility, search, variants/thinking, persistence, and request payload identity | P0 |
| Provider management | Missing | Credentials, OAuth, custom provider forms, status/errors, model visibility, and secure storage boundary | P2 |
| Server management | Missing | HTTP, local sidecar, WSL, SSH, recent roots, server-scoped projects, health, credentials, and switching | P2 |
| Settings | Missing | General, appearance, language, shell, notifications, permissions, keybindings, servers, providers, models, zoom, and transition settings | P2 |
| Notifications/toasts | Missing | Background requests, session completion, errors, permission navigation, sounds, native notifications, and deduplication | P1 |
| Sharing/export | Missing | Create/revoke URL, copy feedback, policy-disabled state, error recovery, and export/save paths | P2 |
| Onboarding/releases/updater | Missing | First launch, directory selection, release notes, checking/downloading/ready/install/error, CLI install, and restart | P2 |

OpenCode reference: [`packages/app/src/pages/session.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/pages/session.tsx), [`session-side-panel.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/pages/session/session-side-panel.tsx), and [`packages/app/src/components`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/components).

## Gap analysis: state and integration contracts

These are not visual-library features, but a UI replacement cannot work without them.

| Contract | Status | Required behavior | Owner |
| --- | --- | --- | --- |
| V1/V2 protocol compatibility | Missing | Detect protocol, expose one compatible request API, adapt legacy events while retaining current v2 events | Adapter |
| Event transport | Missing | Reconnecting stream, lifecycle-safe shutdown/resume, directory routing, 16 ms batching, time-sliced work, and adjacent delta coalescing | Adapter |
| V2 reducer | Missing | Input admission/promotion; model/agent events; step, text, reasoning, tool, compaction, and shell transitions | Adapter |
| Session cache | Missing | Global indexes plus lazy directory state, ref counting, eviction protection, ancestor retention, and generation guards | Adapter |
| Message/part ordering | Missing | Stable IDs, created-time plus ID ordering, part ordering, tombstones, and duplicate prevention | Adapter |
| HTTP/event reconciliation | Missing | Keep streamed deltas received during page loads, targeted hydration for missing parents, and cleanup of true orphans | Adapter |
| Optimistic submission | Missing | Client IDs, immediate user message/parts, independent confirmations, rollback only unconfirmed state, and draft/caret restoration | Adapter |
| Pagination/history | Missing | Latest and historical page sizes, complete turn roots, prepend anchoring, loading deduplication, and cache restoration | Adapter + workbench |
| Session status | Missing | Busy, idle, retry, interruption, blocked request, open assistant message, and terminal result are independent facts | Adapter |
| Request arbitration | Missing | Search parent and child sessions, replace composer with highest-priority dock, preserve draft/caret, and prevent duplicate replies | Adapter + workbench |
| Permission policy | Missing | Once/always/reject, server/directory/session-lineage scopes, existing-request sweep, stale async recheck, and bounded deduplication | Adapter |
| Prompt state | Missing | Text, cursor, selection, mentions, files/images, comments, model, agent, variant, mode, history, and route-safe drafts | Adapter |
| Submission routing | Missing | Normal prompt, configured command, shell, queued follow-up, new session/worktree creation, timeout, interrupt, and recovery | Adapter |
| Session mutations | Missing | Create, rename, move, archive/delete, fork, revert/redo, share/unshare, compaction, and cache effects | Adapter |
| Tab/router state | Missing | Server+route identity, drafts, atomic promotion/close/navigation, closed history, and cross-server request isolation | Adapter + shell |
| File/review state | Missing | Workspace/session scopes, opened/preview/pinned tabs, selected review file/mode, comments, and persisted restoration | Adapter |
| Terminal state | Missing | Workspace-scoped PTYs, optimistic updates, active tab, dimensions, serialized buffer, scroll/cursor, focus versions, and cleanup | Adapter + platform |
| Persistence | Missing | Global/window/server/workspace/session/draft scopes, async readiness, migrations, quota recovery, and memory fallback | Adapter + platform |
| Error normalization | Missing | Distinguish abort, interruption, provider failure, retry, tool failure, connection loss, mutation failure, and fatal desktop state | Adapter |
| Platform capabilities | Missing | Typed browser/desktop interface for storage, blobs, pickers, clipboard, opening/revealing, notifications, updater, menu, zoom, WSL, logs, and relaunch | Platform |

Critical source references:

- [`server-sdk.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-sdk.tsx) — protocol adaptation and event transport.
- [`server-session.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session.ts) — canonical session cache, pagination, reconciliation, eviction, requests, and status.
- [`server-session-v2-reducer.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session-v2-reducer.ts) — v2 state transitions.
- [`submit.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/components/prompt-input/submit.ts) — creation, optimistic prompt submission, queueing, rollback, and interruption.
- [`permission.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/permission.tsx) — permission policy and races.
- [`tabs.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/tabs.tsx) — tab identity, navigation, and persistence.
- [`terminal.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/terminal.tsx) — PTY state and focus ownership.
- [`persist.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/utils/persist.ts) — storage scopes, migrations, and quota handling.
- [`platform.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/platform.tsx) and [`desktop preload`](https://github.com/anomalyco/opencode/blob/dev/packages/desktop/src/preload/types.ts) — native capability boundary.

## Design-engineering gap

### Information architecture

Pretty Amped currently demonstrates isolated components and one linear transcript. OpenCode requires a coherent hierarchy spanning server → project/worktree → session → turn → message/part → tool/file evidence. The design system needs explicit rules for what remains always visible, what collapses, what moves into a dock, and what belongs in a secondary pane.

The visual goal remains “quiet surface, legible state”:

- one primary activity signal, not stacked loaders;
- concise tool summaries with progressive evidence;
- stable composer/dock placement;
- low-chrome navigation with unambiguous scope;
- files, diffs, and terminal available without dominating conversation;
- status text in addition to color and motion; and
- explicit consequence and recovery at approval boundaries.

### Responsive behavior

The current demo handles a single-column mobile transcript. Replacement parity requires:

- desktop split panes and bounded resize;
- mobile session/changes modes or an equally complete alternative;
- drawers/sheets for secondary navigation;
- virtual-keyboard-safe composer and request docks;
- no obscured focused controls under titlebar or composer;
- 320 CSS px reflow without losing commands;
- touch alternatives to hover, right-click, resize, and drag; and
- restored pane/tab/scroll state across breakpoint changes.

### Accessibility

OpenCode already relies on accessible primitive behavior, inert hidden panes, labelled overflow regions, localized icon actions, RTL propagation, and keyboard command routing. Pretty Amped's accessibility policy is stronger on paper, but it is not yet exercised against a workbench.

Required additions include:

- combobox/listbox/menu/tree/tab/grid keyboard models;
- focus arbitration among composer, modal layers, terminal, timeline, and request docks;
- virtualized transcript and tree accessibility;
- non-drag resize/reorder controls;
- coarse streaming announcements without token chatter;
- request-dock replacement and focus restoration;
- forced-colors, 200% text, 400% zoom, and 320 px tests;
- RTL with LTR paths, commands, diffs, and terminal content; and
- representative assistive-technology testing before stable release.

### Performance

The current demo has no long-session performance model. OpenCode's replacement target requires:

- event coalescing before React renders;
- paced Markdown updates for large deltas;
- stable timeline projection separate from transport mutation;
- virtualization that preserves focused rows and prepend anchors;
- worker/cache boundaries for Markdown, syntax, files, and diffs;
- bounded DOM for huge tool output and files;
- cached-tab first paint without flashing or row replacement; and
- explicit performance budgets for stream, tab switch, history prepend, review, and terminal resize.

### Test infrastructure

This is a P0 gap, not release polish. The north star requires:

1. primitive unit and browser behavior tests;
2. component state matrices and fixtures;
3. Storybook or an equivalent review surface with automated accessibility checks;
4. protocol reducer fixtures for every handled event;
5. optimistic/reconciliation race tests;
6. focus and keyboard regression tests;
7. timeline scroll and performance tests;
8. persistence migration tests;
9. desktop platform contract tests; and
10. end-to-end workflows against an isolated OpenCode server.

OpenCode's existing suites under [`packages/app/e2e`](https://github.com/anomalyco/opencode/tree/dev/packages/app/e2e) are behavior specifications to study and reproduce, not merely upstream tests to copy.

## Proposed ownership boundaries

### Pretty Amped foundations

Own semantic StyleX tokens, themes, typography, icon contracts, motion policy, density, layers, and responsive constants. These remain runtime-neutral.

### Pretty Amped primitives

Own React APIs and accessible behavior for controls, overlays, selection, navigation, disclosure, overflow, resizing, and feedback. Base UI may implement behavior internally; Base UI types should not leak upward.

### Pretty Amped AI/session components

Own controlled presentation for timeline rows, turns, parts, tools, composer anatomy, requests, todos, queue/revert state, files, diffs, and evidence. They should accept normalized data and named side-effect callbacks.

### Pretty Amped blocks/workbench

Own reusable compositions such as a transcript timeline, request-aware composer region, file review pane, session header, and responsive coding workbench. Blocks may coordinate component state but must not call OpenCode endpoints directly.

### OpenCode adapter/reference app

Own SDK clients, protocol detection, event reducers, caches, optimistic mutation, persistence, routing, commands, model/provider resolution, permissions policy, terminals, and mapping to Pretty Amped view models.

### Desktop adapter

Own Electron or another native shell's typed capability bridge. Components call capabilities; they never import native APIs.

## Priority and sequencing

### P0 — prove replacement feasibility

1. Add the missing behavior primitives required by one session: tabs, menu, popover, tooltip, toast, combobox, checkbox/radio, scroll area, and resize handle.
2. Define normalized turn/message/part/tool/request view models from OpenCode's actual states.
3. Build protocol fixtures and a thin adapter around the existing OpenCode SDK/reducer behavior; do not invent a second event model.
4. Upgrade timeline, message, Markdown, tool, composer, permission, question, and todo components for the states in this document.
5. Implement specialized context, shell, edit/write/patch, task/subagent, question, and generic MCP tool renderers.
6. Prove one real session with optimistic submit, streaming text/reasoning/tool state, interruption, permission, draft restoration, and stable history prepend.
7. Establish component browser tests, reducer tests, accessibility checks, and timeline performance checks before widening the shell.

### P1 — reach daily-driver coding parity

1. Rich composer: files/images, mentions, commands, shell mode, history, model/agent/variant, queue, and revert.
2. Session and project navigation with persistent, cross-server-safe tabs.
3. File tree, file viewer, virtualized diffs, review panel, and comments.
4. Workspace-scoped interactive terminal with correct focus and persistence.
5. Responsive split workbench, mobile modes/drawers, command palette, notifications, sharing, and context usage.
6. Full theme/icon/density system and long-session performance hardening.

### P2 — complete graphical application parity

1. Provider, model, server, project/worktree, and settings management.
2. Desktop capability bridge, sidecar, native pickers, clipboard, menus, notifications, updater, deep links, WSL/SSH, zoom, logs, and relaunch.
3. Onboarding, releases, diagnostics, migration compatibility, and failure recovery.
4. Full cross-platform assistive-technology and performance matrix.

## Smallest credible vertical slice

A static transcript is not sufficient. The first OpenCode-backed slice passes only when it can:

1. connect to one isolated OpenCode server and open one known session;
2. render paginated user and assistant turns with text, reasoning, one specialized tool, generic tool fallback, completion, retry, interruption, and failure;
3. submit a real text prompt with a stable client message ID;
4. show the optimistic user message immediately, reconcile message and parts independently, and roll back only unconfirmed state on failure;
5. interrupt a busy response and preserve partial content;
6. replace the composer with a permission request, send the exact `once` reply, then restore the untouched draft and caret;
7. auto-follow only at the bottom and prepend history without moving the viewed content;
8. preserve focus through streaming, tool disclosure, interruption, and request dismissal; and
9. pass keyboard, touch-target, reduced-motion, reflow, and automated accessibility checks.

This slice exercises the foundation, primitive, component, block, adapter, and real-runtime boundaries with the fewest unrelated surfaces.

## Full-parity acceptance criteria

The UI is replaceable only when all of the following are true:

### State and protocol

- Every event handled by OpenCode's current v2 reducer has an equivalent fixture and normalized result.
- V1/V2 compatibility and request payload selection remain correct.
- Streaming deltas, tombstones, optimistic parts, targeted hydration, reconnection, and stale request races are covered.
- Abort, interruption, retry, provider error, tool error, connection loss, and mutation failure remain distinct.

### Conversation and composer

- Cold and cached session load, historical prepend, tab switch, follow opt-out, and jump-to-latest are stable.
- Text, reasoning, compaction, shell, all built-in tools, unknown/MCP tools, todos, questions, permissions, and child sessions render correctly.
- Text, commands, shell mode, agents, models, variants, mentions, files/images, history, edits, queueing, abort, and optimistic rollback work.
- Request docks preserve exact payloads, draft, selection, caret, focus, and child-session origin.

### Workbench

- Files, review, and terminal coexist with responsive and persisted pane state.
- File/diff selection, comments, large-file virtualization, and review modes survive navigation and reload.
- PTY tabs, buffer, scroll, cursor, dimensions, reconnect, resize, exit, and focus-race behavior pass.
- Sessions, drafts, tabs, projects, servers, and worktrees retain correct scope and cross-server isolation.

### Platform and persistence

- Persisted tabs, drafts, prompt history, models, permissions, terminals, review, layout, settings, and server state have tested migrations.
- Desktop IPC tests cover tokenized pickers, storage/blobs, menus, deep links, notifications, updater, zoom/fullscreen, WSL, logs, and relaunch.
- Browser and desktop storage failure degrade without losing current-session work.

### Design quality

- Every interactive surface works with keyboard and touch without drag-, hover-, or shortcut-only actions.
- Focus is never lost or obscured by streaming, virtualization, dialogs, titlebars, docks, or terminal mounting.
- Status and consequence never rely on color, icon, or animation alone.
- Light, dark, forced-colors, reduced-motion, RTL, 200% text, 400% zoom, and 320 px reflow are tested.
- Long sessions, large tool output, large files, streaming Markdown, tab switching, and history prepend stay within agreed performance budgets.
- Representative desktop and mobile states have inspected visual evidence after behavioral verification.

## Immediate implications

1. OpenCode replaces the generic 50-component list as the prioritization authority. The list remains a vocabulary and secondary parity check.
2. The next component phase should not add isolated cards alphabetically. It should build the P0 session slice and only the primitives it actually requires.
3. `Composer`, `Thread`, `Message`, `ToolActivity`, `PermissionRequest`, `Plan`, `Diff`, and `Markdown` should be evolved from their current APIs where possible rather than duplicated with OpenCode-specific names.
4. OpenCode protocol and persistence code belongs outside the library. The library remains usable by other runtimes.
5. Existing OpenCode behavior and E2E tests are the compatibility oracle; Pretty Amped's visual and interaction quality is the redesign opportunity.

## Primary source map

- App/provider hierarchy and routes: [`packages/app/src/app.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/app.tsx)
- Session orchestration: [`packages/app/src/pages/session.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/pages/session.tsx)
- Session timeline: [`packages/app/src/pages/session/timeline`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/pages/session/timeline)
- Composer docks: [`packages/app/src/pages/session/composer`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/pages/session/composer)
- Prompt state and submission: [`packages/app/src/components/prompt-input`](https://github.com/anomalyco/opencode/tree/dev/packages/app/src/components/prompt-input)
- Session UI registry and renderers: [`packages/session-ui/src/components/message-part.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/message-part.tsx)
- Turn composition: [`packages/session-ui/src/components/session-turn.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/session-turn.tsx)
- Files and diffs: [`packages/session-ui/src/components/file.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/session-ui/src/components/file.tsx) and [`packages/session-ui/src/pierre`](https://github.com/anomalyco/opencode/tree/dev/packages/session-ui/src/pierre)
- Event transport: [`packages/app/src/context/server-sdk.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-sdk.tsx)
- Session state: [`packages/app/src/context/server-session.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session.ts)
- V2 transitions: [`packages/app/src/context/server-session-v2-reducer.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/server-session-v2-reducer.ts)
- Permission policy: [`packages/app/src/context/permission.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/permission.tsx)
- Tabs and routes: [`packages/app/src/context/tabs.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/tabs.tsx)
- Terminal state: [`packages/app/src/context/terminal.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/terminal.tsx)
- Persistence: [`packages/app/src/utils/persist.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/utils/persist.ts)
- Platform contract: [`packages/app/src/context/platform.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/context/platform.tsx)
- Desktop preload API: [`packages/desktop/src/preload/types.ts`](https://github.com/anomalyco/opencode/blob/dev/packages/desktop/src/preload/types.ts)
- OpenCode graphical E2E specifications: [`packages/app/e2e`](https://github.com/anomalyco/opencode/tree/dev/packages/app/e2e)
