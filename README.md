# Atira

A React 19 and StyleX component library for agent interfaces, with an interactive
catalog and a Nanocodex playground. Applications own providers, transport,
credentials, and persistence; the library owns presentation and interaction.

## Installation

Install the highest-level package you need together with its stylesheet
dependencies and peers. For the complete chat surface:

```bash
npm install @atiraui/blocks @atiraui/components @atiraui/primitives @atiraui/foundations \
  @stylexjs/stylex react react-dom
```

Import each package's CSS once, then render Atira inside a theme:

```tsx
import '@atiraui/foundations/styles.css'
import '@atiraui/primitives/styles.css'
import '@atiraui/components/styles.css'
import '@atiraui/blocks/styles.css'
import * as stylex from '@stylexjs/stylex'
import { ChatSession } from '@atiraui/blocks'
import type { ChatStore } from '@atiraui/foundations/chat'
import { lightTheme } from '@atiraui/foundations/themes'

export function AgentChat({ store }: { store: ChatStore }) {
  return (
    <main {...stylex.props(lightTheme)}>
      <ChatSession label="Agent conversation" store={store} />
    </main>
  )
}
```

Applications own the `ChatStore` implementation and adapt provider events into
the neutral types exported by `@atiraui/foundations/chat`. Install
`@atiraui/components` instead of `@atiraui/blocks` when composing the chat surface
yourself, or `@atiraui/primitives` for general controls.

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

## Deployment

The public demo is configured to run as one Cloudflare Container behind a Worker. A single
container preserves the server's session-isolated authentication, conversation
contexts, streaming responses, and reconnect buffers. The container sleeps after
30 minutes without traffic; a cold start resets the same in-memory state that a
local server restart resets. Placement is restricted to North America because
ChatGPT device authentication is unavailable from some regions.

Cloudflare Containers require a Workers Paid plan and Docker for local deploys:

```bash
pnpm deploy:cloudflare
```

Cloudflare Builds deploys pushes to `main` from the repository root with no
separate build command and `npx wrangler deploy` as the deploy command. The
Dockerfile owns the production build, so building once before Wrangler would
duplicate work whose output the container does not use.

The production server serves the compiled Vite application and exposes
`/healthz` for runtime checks. Do not configure a shared `OPENAI_API_KEY` for the
public demo unless you intend to pay for visitor usage; users can authenticate
with their own ChatGPT subscription instead.

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

Library releases target the public npm registry under the `@atiraui` scope.
`pnpm publish:library -- --dry-run` builds the compiled package contents and
installs and imports the packed artifacts in a clean consumer before showing the
packages that a publish would upload.

The four library packages release as one fixed version group. Add a changeset to
each pull request that changes their public contract:

```bash
pnpm changeset
```

Merging the generated **Version packages** pull request publishes the compiled
packages through `.github/workflows/release.yml` using npm trusted publishing
and provenance, without a repository token. Configure each package on npm with
GitHub owner `ethandaya`, repository `atira`, workflow `release.yml`, and direct
publish permission.

npm requires a package to exist before it can trust a publisher. Bootstrap the
four packages once with
`pnpm publish:library -- --provenance=false` from an npm-authenticated terminal,
then configure the trusted publisher before merging the initial version pull
request. npm prompts for the account's one-time password during this bootstrap.
The pending initial changeset prepares version `0.1.0`.

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
