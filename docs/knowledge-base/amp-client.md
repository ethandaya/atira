# Amp client feasibility

**Status:** deferred integration research. The current reference-client plan uses native fx ACP because it exposes a documented custom-client protocol and interactive permission exchange. This document remains relevant if an Amp adapter is revisited; it does not define the component library architecture.

## Verdict

An ultraminimal custom Amp client is supportable today **as a trusted local or native application that uses the official Amp CLI/SDK as its backend**.

A pure browser replacement for Amp’s web client is not supportable from the public interfaces reviewed. Amp does not document a general cloud REST/WebSocket API, third-party OAuth flow, account-wide thread subscription, remote file/terminal protocol, or external tool-approval response protocol.

The hard boundary should be:

```diagram
┌─────────────────────┐
│ Pretty Amped UI     │
└──────────┬──────────┘
           │ typed local IPC
           ▼
┌─────────────────────┐
│ Trusted backend     │
│ auth · process · IO │
└──────────┬──────────┘
           │ @ampcode/sdk or stream JSON
           ▼
┌─────────────────────┐
│ Official Amp CLI    │
└──────────┬──────────┘
           │ supported Amp behavior
           ▼
┌─────────────────────┐
│ Local executor/orb  │
│ + durable thread    │
└─────────────────────┘
```

Do not reverse-engineer the web application’s private endpoints.

## Official capabilities

### Execution and streaming

The TypeScript SDK exposes `execute()` as an `AsyncIterable<StreamMessage>`. It wraps the Amp CLI and supports:

- new local runs;
- continuing the latest or a known thread ID;
- message-level structured output;
- multi-turn input through an async iterable;
- mode and effort selection;
- cancellation through `AbortSignal`;
- tool permissions, enabled tools, MCP configuration, and skills for local execution; and
- orb execution for a string prompt.

The CLI equivalent uses `amp --execute --stream-json`. Output is JSONL with:

- `system/init`: session/thread ID, current directory, tools, MCP statuses, and optional mode;
- `assistant`: text and `tool_use` blocks;
- `user`: user text and `tool_result` blocks;
- `result/success`: result, duration, turns, usage, and permission denials; and
- error system/result records.

The stream is structured as messages and tool events; the published schema does not define token-delta events. `--stream-json-thinking` adds Amp-specific thinking blocks and breaks Claude Code schema compatibility.

Streaming JSON input accepts text and images. Keeping stdin open permits multiple turns; `steer: true` asks Amp to handle a queued message at the next interruption point.

Sources: [streaming JSON](https://ampcode.com/manual/cli-streaming-json.md), [TypeScript SDK](https://ampcode.com/docs/sdk/typescript), [SDK overview](https://ampcode.com/manual/sdk).

### Authentication

The supported paths are:

- reuse a local interactive `amp login`; or
- provide an access token from Amp Security Settings as `AMP_API_KEY`.

Credentials belong in the trusted backend process, never a browser bundle. No public third-party OAuth client-registration flow was found.

### Threads and history

The SDK currently exposes:

- `threads.new()`;
- `threads.markdown()`; and
- `threads.setMultiplayer()`.

The official CLI provides broader thread commands, including listing, search, continue, Markdown/export, rename, labels, archive, and delete. The app can invoke documented CLI commands where necessary, but should not pretend they are all part of a stable in-process SDK API.

The durable Amp thread ID should be the client’s primary identity. A local process lifetime is not a thread lifetime.

Source: [Amp threads](https://ampcode.com/docs/markdown/threads).

### Local versus orb execution

The SDK defaults to local. With `executor: 'orb'`:

- the prompt must be a string rather than streaming input;
- project selection is explicit or inferred; and
- local-only options such as permissions, enabled tools, skills, MCP configuration, and `dangerouslyAllowAll` are ignored with a warning and must be configured in the Amp project.

**Implication:** local and orb sessions can share visual components but do not have identical control capabilities. The client must display execution location and should not expose controls the selected executor ignores.

### MCP and portals

Amp owns MCP connections. `system/init` reports server names and statuses such as connecting, connected, authenticating, awaiting approval, denied, failed, and blocked by registry. The custom client can surface those states without becoming an MCP host.

Amp portals are authenticated URLs for orb services. The public SDK does not expose a general portal-list API. The app may open explicit portal links from output or use documented CLI/service manifests later; it must not reconstruct private portal URLs.

Sources: [Amp MCP](https://ampcode.com/docs/customize/mcp), [Amp portals](https://ampcode.com/docs/orbs/portals).

## Critical permission boundary

Amp’s current default is to run tools without approval. Permissions/plugin rules can `allow`, `reject`, `ask`, or `delegate` based on tool and arguments.

However, the public SDK/stream schema reviewed here does **not** define:

- an `awaiting-approval` execution event for a tool call; or
- an input message by which an external SDK client approves or rejects that pending call.

The plugin thread API can observe a thread-level `awaiting-approval` state, but the public external SDK is not the plugin API, and the reviewed plugin thread methods do not establish a remote approval transport.

**Therefore:** do not claim that the first client can reproduce Amp’s interactive approval UI through the SDK. The safe supported starting choices are:

1. use Amp’s normal default in an isolated/local environment;
2. apply static `allow`/`reject` rules for the run;
3. use `delegate` with a separately designed local policy bridge only if the extra complexity is justified; or
4. hand the thread to an official Amp surface when interactive approval is required.

Treat a future official approval event/response protocol as an extension point. Do not build the generic library’s `PermissionRequest` component around the assumption that Amp can drive it today.

Sources: [Amp tools and permissions](https://ampcode.com/docs/tools), [permissions manual](https://ampcode.com/manual/permissions.md), [plugin API](https://ampcode.com/docs/plugin-api), [SDK permissions](https://ampcode.com/manual/sdk#tool-permissions).

## Feasibility matrix

| Capability | Publicly supportable now | Notes |
| --- | --- | --- |
| Start local Amp work | Yes | SDK or CLI JSON stream |
| Start orb work | Yes | SDK string prompt; project/orb settings own tools and policy |
| Continue a known thread | Yes | SDK `continue` option or CLI |
| Multi-turn local session | Yes | Async input/JSONL input |
| Steer local running work | Yes | CLI input supports `steer`; validate SDK exposure in spike |
| Show tool calls/results | Yes | Structured assistant/user blocks |
| Show MCP connection state | Yes | `system/init` status |
| Cancel the SDK run | Yes | `AbortSignal` |
| Attach images | Yes through CLI JSON input | Confirm desired SDK wrapper API in spike |
| Render historical Markdown | Yes | SDK `threads.markdown()` |
| Account-wide list/search | CLI, not documented SDK | Wrap official commands or defer |
| External interactive tool approval | Not established | No public stream response schema found |
| Live remote subscription to arbitrary existing thread | Not established | Continue/follow-up is not a general event subscription |
| Remote file tree, diff, or terminal parity | Not established | Official web/CLI remains fallback |
| Portal listing/management in SDK | Not established | Open known official links only |
| Pure browser sign-in/client | No supported route found | No third-party OAuth/public cloud client API |

## Thin-client interaction model

The main interface can remain very small if state is modeled rather than hidden.

### Persistent regions

1. **Thread context**
   - title;
   - local or orb execution;
   - mode/effort when known;
   - current durable state; and
   - link to the official Amp thread.

2. **Conversation**
   - user and assistant content;
   - concise current activity;
   - failures and blocked states inline with the work they affect; and
   - no raw JSON or every successful read by default.

3. **Composer**
   - draft and send;
   - queue/steer distinction when supported;
   - stop/cancel while running;
   - attachment state when implemented; and
   - queued-message visibility.

4. **Outcome**
   - completed, failed, or cancelled;
   - duration and usage when present;
   - permission denials;
   - open official thread; and
   - explicit review handoff.

5. **Activity inspector, disclosed on demand**
   - chronological tool calls;
   - exact inputs and outputs;
   - MCP status;
   - errors; and
   - copy/open actions.

The UI may summarize repeated low-risk successful operations, but the evidence remains inspectable.

## App state model

The adapter can derive a conservative state machine from the public stream:

```ts
type RunState =
  | { type: 'idle' }
  | { type: 'starting' }
  | { type: 'running'; activity?: ToolActivity }
  | { type: 'stopping' }
  | { type: 'completed'; result: string; durationMs: number }
  | { type: 'failed'; error: string; permissionDenials?: string[] }
  | { type: 'cancelled' }
```

Do not synthesize `awaiting-approval` from silence. Do not label completion “ready for review” unless the application has evidence of changes to review. The published execution stream does not itself provide a changed-file count.

## Product-pattern findings

Official material from Devin, Codex, Cursor, and Claude Code points to a common operational pattern:

- keep a compact current-progress surface;
- retain full chronological commands and evidence behind it;
- separate working, blocked, failed, completed, and ready-for-review states;
- make background work durable and link to its authoritative task;
- keep interrupt/takeover near the running state; and
- show the active permission posture rather than surprising users at the moment of action.

This is compatible with an ultraminimal visual design. It argues against a transcript that prints every tool result at equal visual weight.

## Recommended implementation sequence

### Spike 1: supported transport

- one local `execute()` call;
- render system, text, tool-use, tool-result, success, and error records;
- cancel with `AbortSignal`;
- continue the returned thread ID; and
- compare SDK events with captured CLI JSON fixtures.

### Spike 2: durable viewing

- load `threads.markdown()` for a known thread;
- reconcile historical Markdown with current structured events without duplicating messages;
- preserve drafts and scroll position; and
- link to the official thread for unsupported history/detail.

### Spike 3: executor differences

- run one orb task;
- expose project/executor capability differences;
- show MCP init states; and
- verify cancellation and continuation semantics.

### Only then choose the desktop shell

The transport spike should inform Electron/Tauri/local-web decisions. The shell must support:

- a trusted backend and local child process;
- secure reuse of Amp login/token state;
- streaming IPC and cancellation;
- filesystem-aware execution directory selection; and
- opening official Amp/editor/portal links.

## Non-goals for the first client

- replacing Amp account settings;
- reproducing the entire thread feed;
- embedding a terminal or file editor;
- implementing private remote-control protocols;
- managing portals or multiplayer;
- implementing an approval bridge before a supported need is proven;
- hiding the official Amp client as a fallback; or
- becoming a generic multi-agent orchestration product.

The first product should be a calmer daily conversation and progress surface, not an incomplete clone of every Amp pane.
