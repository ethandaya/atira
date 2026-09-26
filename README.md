# Atira

A React 19 and StyleX component library for agent interfaces, with an interactive
catalog and a Nanocodex playground. Applications own providers, transport,
credentials, and persistence; the library owns presentation and interaction.

## Development

Use Node 22.13 or newer and the declared pnpm version:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `/` for the docs overview. The docs navigate client-side to the full-height
playground at `/playground` and the component reference at `/components`.
Component examples do not require credentials. Sign in with ChatGPT in the
playground or set `OPENAI_API_KEY` on the server.

`NANOCODEX_MODEL` defaults to `gpt-6-sol` and must be supported by the installed
Nanocodex version. Each conversation uses that model.

Nanocodex 0.6.5 owns device-code login, credential refresh, and the agent loop.
ChatGPT credentials stay in server memory, isolated by browser session; they expire
after an hour without API activity or a server restart. Sign-in/sign-out resets
that browser's agent contexts; saved transcripts remain readable. This demo does
not persist credentials or offer cross-device accounts.

The agent can search the component catalog, but cannot access your workspace.
Public web search additionally requires the server API key. There is no subagent
service of our own or image-generation service; reusable UI components remain
available. Nanocodex includes its built-in delegation tools by default.

Deterministic workflow and stress fixtures are test-only. Playwright enables
them with `VITE_TEST_FIXTURES=true`; ordinary development and production builds
do not expose a deterministic chat demo.

## Conversations and recovery

The Conversation history menu starts and reopens chats. Transcripts and drafts
live in browser `sessionStorage`, not a durable or cross-device archive. Runtime
context stays server-side and expires after 30 minutes idle or a server restart.
Expired transcripts remain readable; resuming one reports an error rather than
silently starting without context.

Runs continue when a browser disconnects. Reloading an unfinished response
reconnects and replays the latest run without resubmitting its prompt or tools.
Stream interruptions reconnect up to three times. Stop explicitly cancels the
active Nanocodex turn.

Replay is isolated by browser session and conversation, retained in memory for
the latest turn only, and limited to 8 MiB. Larger responses continue live, but
reconnect reports an error rather than replaying truncated content.

Retry response submits a failed prompt again and may repeat tool calls. The demo
does not implement execution checkpoints or durable recovery.

Integration tests direct the real Nanocodex agent to a local provider with
`NANOCODEX_WEBSOCKET_URL` and `NANOCODEX_API_BASE_URL`. Leave both unset for normal
use. These settings do not redirect the separate web-search tool.

## Library boundaries

- `packages/foundations` — semantic StyleX tokens, themes, and neutral chat types
- `packages/primitives` — owned React APIs backed by Base UI and styled with StyleX
- `packages/components` — agent-interface components built on owned primitives
- `packages/blocks` — controlled chat-session and virtualized timeline compositions
- `apps/demo` — catalog, Nanocodex runtime, and application state

Tool renderers use explicit `ToolPresentation` fields. They do not guess meaning
from raw JSON keys. Applications map their tool data into presentation fields;
raw input and output remain available as evidence.

Zod validates untrusted HTTP, stream, model, and saved-history data in the demo.
The library receives typed props and controlled state; it does not import these
schemas or require Nanocodex.

Library releases target the public npm registry under the `@atira` scope.
`pnpm publish:library -- --dry-run` builds the compiled package contents and
shows the packages that a publish would upload.

## Verification

```bash
pnpm check
```

The full gate runs formatting, lint, typechecks, tests, React Doctor, production
builds, and browser tests in that order. It stops at the
first failure. Oxlint covers JavaScript and TypeScript, including backend `.ts`
files; React Doctor covers the demo and the three React library packages.
Warnings fail both Oxlint and React Doctor. Narrow source comments explain
exceptions for provider-free animation primitives, persistent handoff slots,
and cancellable external-state synchronization. Doctor's remote scoring and
supply-chain scan are disabled; this is not a dependency security audit.

For focused iteration:

```bash
pnpm exec oxfmt --write <changed-paths>
pnpm lint
pnpm lint:fix
pnpm doctor:changed --base <review-base>
```

Review automatic fixes before staging; do not use dangerous fixes or disable
rules just to pass checks. `pnpm format` formats the full repository; keep a
formatting migration separate from behavioral changes. Generated outputs,
lockfiles, local Amp data, and vendored skills are excluded from formatting.

Installation runs `prepare` to install the Husky hook. `pnpm precommit` checks
staged formatting and lint, plus React Doctor when React-package files change.
The hook does not fix or stage files; it hides and restores unstaged tracked
edits so an unstaged fix cannot mask a staged defect. Use `pnpm run doctor` for
the full React scan; `pnpm doctor` is pnpm's unrelated built-in command.

Browser tests cover loading, unavailable, recovery, keyboard, and narrow layouts.
The backend typecheck covers contracts, catalog, conversations, replay, and web
search; server orchestration is not yet fully typechecked.

## License

MIT
