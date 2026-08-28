# Agent runtime options

Research snapshot: **August 28, 2026**

## Decision

Use native **`fx acp` as the first live adapter** for the reference client. It provides the public interaction boundary the component system needs to exercise: sessions, semantic streaming updates, tool lifecycle, human permission requests and responses, cancellation, model/mode configuration, native coding tools, and MCP.

Keep **Nanocodex as a second adapter and lifecycle reference**. It has a stronger ordered event model, steering, snapshots, and optional durable execution, but it is intentionally tied to one OpenAI coding-agent stack and does not provide a generic human tool-approval protocol.

Neither runtime defines component props. Both map into library-owned contracts.

```diagram
                           ┌────────────────────────┐
fx ACP events ────────────▶│ fx adapter             │
                           └───────────┬────────────┘
                                       │
                           neutral events/snapshots
                                       │
                           ┌───────────▼────────────┐
Nanocodex events ─────────▶│ Nanocodex adapter      │
                           └───────────┬────────────┘
                                       │
                           ┌───────────▼────────────┐
                           │ React/StyleX components│
                           └────────────────────────┘
```

## fx

Repository: https://github.com/vercel-labs/fx

Status: Apache-2.0, explicitly experimental. `libfx` is very early and currently declares package version `0.0.0`, so pin the fx binary/package and expect changes.

### Native ACP server

`fx acp` runs one native process per primary workspace and communicates through newline-delimited JSON-RPC 2.0 over stdin/stdout. It supports:

- `initialize`;
- session create, load, resume, close, list, and remove;
- prompt and cancel;
- model/configuration and mode changes; and
- one active session and prompt per connection.

The client receives structured `session/update` notifications for user/assistant chunks, tool calls and updates, available commands, and fx-specific session/recovery information. Tool updates expose coarse kinds such as read, edit, search, execute, think, and fetch, plus pending, in-progress, completed, and failed statuses.

Sources: [fx ACP documentation](https://fx.sh/docs/using-fx/acp), [ACP server implementation](https://github.com/vercel-labs/fx/blob/main/src/acp/server.zig), [ACP types](https://github.com/vercel-labs/fx/blob/main/src/acp/types.zig).

### Permissions

Native ACP has a real interactive permission exchange. The server sends `session/request_permission` with a session ID, tool-call ID, human-readable title, tool kind, validated input, and choices equivalent to:

- allow once;
- allow for this session; and
- reject once.

Malformed, missing, cancelled, and error responses fail closed. Session-wide grants are not written to persistent settings or restored with a session.

This is precisely the behavior needed to validate `PermissionRequest` components without inventing a fake approval loop.

Sources: [fx permissions](https://fx.sh/docs/configure-fx/permissions), [ACP prompt permission request](https://github.com/vercel-labs/fx/blob/main/src/acp/prompt.zig), [ACP permission response handling](https://github.com/vercel-labs/fx/blob/main/src/acp/server.zig).

### Cancellation and steering

ACP cancellation is public. It cancels the active prompt and pending permission/elicitation requests, and the prompt result reports `cancelled`.

The interactive fx terminal has model-boundary steering, but neither the current ACP method surface nor `libfx` exposes active-turn steering. The first adapter should advertise cancellation but not steering. The application can cancel and resend or queue a follow-up as an app-level behavior.

### Native authority

Native `fx acp` uses fx’s full native workspace, filesystem, shell, background-process, web, and MCP environment. It therefore has the operating-system authority of the process that launched it.

Permission policy is not sandboxing. A hosted client needs a separate container/VM/workspace boundary per trust model. A local client should make the active directory and permission mode visible.

### `libfx`

`libfx` exposes `createFxAgent()` for Node or browser/WASM, returning sessions and async-iterable turns with host callbacks for events, permissions, persistence, and fetch. This is the lowest-friction custom-JavaScript integration.

It is not equivalent to native `fx acp`:

- the embedded Node agent advertises no native tools, filesystem, commands, background processes, MCP, or native secret store;
- browser/WASM excludes native tools, MCP, subagents, and arbitrary filesystem/process access;
- the browser workspace adapter is constrained and exec-only; and
- the public embedded SDK is primarily Vercel AI Gateway/host-fetch oriented.

Use `libfx` for browser demonstrations, constrained environments, or a text-only embedded agent. Use native ACP for a real coding-agent client.

Sources: [embedding overview](https://fx.sh/docs/lib), [Node SDK limits](https://fx.sh/docs/lib/node#what-the-embedded-agent-can-do), [WebAssembly SDK limits](https://fx.sh/docs/lib/webassembly#webassembly-runtime-limits), [browser integration](https://fx.sh/docs/lib/host-integration).

## Nanocodex

Repository: https://github.com/gakonst/nanocodex

Status: dual MIT/Apache-2.0, Rust/JS package version `0.5.0`, with supported public APIs and broad CI. It remains pre-1.0, while some companion React and execution packages are younger or explicitly experimental.

### Strong lifecycle model

Nanocodex exposes:

- a canonical versioned ordered event stream with request ID and sequence;
- assistant and reasoning deltas/messages;
- run start, completion, failure, and error;
- tool calls and terminal results;
- retry, model, context, transport, and compaction lifecycle;
- a `Turn` that is both a stream and a final-result future;
- acknowledged cancellation;
- steering at safe model boundaries;
- serializable snapshots, spawn, and fork; and
- optional append-only durable execution.

These are valuable reference semantics for the neutral contract and future runtime. In particular, terminal results should not depend on a UI draining every event, and cancellation should acknowledge that model/tool resources actually stopped.

Sources: [Nanocodex README](https://github.com/gakonst/nanocodex/blob/master/README.md), [event stream](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-oai-api/src/events/stream.rs), [event data](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-oai-api/src/events/data.rs), [turn lifecycle](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-agent/src/agent/turn.rs), [durability](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-durability/README.md).

### JavaScript and React surfaces

The JS package exposes Node/browser/worker entry points, agent events, prompt/turn control, cancellation, steering, snapshots, usage, and caller-owned tools. Its headless React controller deliberately owns no markup, Markdown, scrolling, or CSS.

That makes direct JS or worker embedding the intended application path. If adopted later, its controller should still sit behind a small local adapter so Nanocodex types do not become the component library’s types.

Sources: [JS types](https://github.com/gakonst/nanocodex/blob/master/js/bindings/types.d.mts), [React controller types](https://github.com/gakonst/nanocodex/blob/master/js/react/agent/index.d.mts), [React package guidance](https://github.com/gakonst/nanocodex/blob/master/js/react/README.md).

### Provider and permission boundaries

Nanocodex deliberately implements one OpenAI Responses coding-agent stack and a closed set of supported models. It is not a public provider adapter framework.

It also explicitly lacks a generic human approval subsystem. Native execution describes full access with approval policy “never”; shell fields that resemble sandbox/approval metadata are accepted for compatibility but ignored. A product requiring permission requests must mediate tools at a higher layer and own correlation, timeout, denial, persistence, and resumption.

Sources: [stability and scope](https://github.com/gakonst/nanocodex/blob/master/web/docs/src/pages/stability.mdx), [model input policy](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-agent/src/model/input.rs), [shell tool](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-tools/src/shell/tool.rs).

### CLI boundary

`nanocodex run` is a one-prompt headless JSONL runner suitable for scripts, evaluation, and event fixtures. It is not a persistent bidirectional application protocol: there is no generic daemon, JSON-RPC command channel, multiplexed sessions, approval response channel, or protocol-level steering after launch.

Use direct JS/Rust embedding or build an application-owned process protocol. Do not treat the current CLI JSON implementation details as stable client-server API.

Sources: [CLI runner](https://github.com/gakonst/nanocodex/blob/master/bin/nanocodex/src/run.rs), [stability policy](https://github.com/gakonst/nanocodex/blob/master/web/docs/src/pages/stability.mdx).

## Capability comparison

| Capability | Native fx ACP | `libfx` agent | Nanocodex direct API |
| --- | --- | --- | --- |
| Public custom-client boundary | JSON-RPC stdio | JavaScript API | Rust/JavaScript API |
| Structured streaming | Yes | Yes | Yes, ordered/versioned |
| Saved sessions/history | Yes | Host store | Snapshots; optional durability |
| Native coding tools | Yes | No | Yes/caller-owned |
| MCP | Yes | No | Tools include MCP support |
| Interactive human approval | Yes | Callback, but embedded agent has no native tools | No generic subsystem |
| Cancellation | Yes | Yes | Yes, acknowledged |
| Active-turn steering | No | No | Yes |
| Provider breadth | Gateway, Codex, Grok routes | Primarily Gateway/host fetch | OpenAI-specific |
| Browser-only custom UI | Through backend | Yes, constrained WASM | Yes through JS/WASM surfaces |
| Execution sandbox included | No | Host boundary | No; application-owned |

## Adapter contract implications

The neutral layer should be able to express:

- session create, load, resume, and close where supported;
- turn start, completion, failure, cancellation, and stop reason;
- message deltas and coherent completed messages;
- tool start, progress, success, failure, and cancellation;
- permission requested, accepted once/session, rejected, cancelled, and expired;
- recovery/reconnect state;
- model/mode metadata without assuming a universal selector; and
- explicit capabilities for cancel, steer, queue, approvals, attachments, and history.

Not every adapter supports every state. Capability negotiation should hide unsupported actions; it should not simulate them.

Keep unknown vendor events and raw payloads in an evidence channel. Version-pin integrations, tolerate unknown update kinds, and test adapters against recorded conformance fixtures. A protocol change should fail at the adapter boundary rather than silently changing the rendered meaning.

## First fx integration spike

After the deterministic component slice exists:

1. launch one `fx acp` process in an isolated test workspace;
2. initialize and inspect negotiated capabilities;
3. create a session and run one text response;
4. map assistant chunks and tool updates into neutral snapshots;
5. exercise allow-once, session allow, and rejection;
6. cancel during model output and during a tool/permission wait;
7. load history and verify replay does not duplicate current state;
8. retain sanitized raw events in the evidence inspector; and
9. capture protocol fixtures with secrets and workspace-specific paths removed.

Success means the adapter can drive the existing components without adding fx-shaped props. If it cannot, first determine whether the neutral contract is genuinely incomplete or the adapter is leaking wire details.
