# Pretty Amped

Pretty Amped is the working title for two related products:

1. a StyleX-first React component system with its own accessible primitives, source registry, CLI, and MCP server for AI and agent interfaces; and
2. an ultraminimal reference client capable of replacing OpenCode's graphical UI while proving the component system against a real coding-agent workflow.

OpenCode's web/desktop UI is the behavioral north star, not a visual template. The reusable library stays protocol-neutral; OpenCode SDK handling, event reconciliation, persistence, routing, and desktop capabilities belong at the application edge. Visual language, interaction contracts, accessibility, semantic agent states, and theming belong in the library.

The repository now contains the first runnable vertical slice. Start with the
[knowledge base](docs/knowledge-base/README.md), then run the demo:

```bash
pnpm install
pnpm dev
```

The playground keeps provider credentials server-side. Use **Sign in** to connect
a ChatGPT subscription through OpenAI's device flow; credentials are encrypted
per browser session and never exposed to client code. Without a subscription it
uses Anthropic when `ANTHROPIC_API_KEY` is available and otherwise Nanocodex with
`OPENAI_API_KEY`. Set `PRETTY_AMPED_RUNTIME` to `anthropic` or `nanocodex` to
choose the fallback explicitly. The ChatGPT runtime can delegate bounded research,
review, and planning tasks to isolated, non-recursive subagents.

The composer's **Model** picker selects the model for the next message without
resetting conversation history. Selection persists with the draft; retries use
the original turn's model, and ChatGPT subagents inherit that model. Options are
discovered server-side from the authenticated provider and cached for five minutes
per credential/account. ChatGPT uses Codex's model-discovery endpoint (not a public
API contract); Anthropic and OpenAI API keys use their Models APIs. Discovery failures
show an error instead of guessed options; refresh to retry. The Nanocodex fallback
filters discovery to its configured model because its agent is created once per
conversation. Provider access and generation-capability errors can still apply.

ChatGPT models that advertise reasoning levels also show a **Reasoning effort**
picker. It starts at the model's advertised default, persists with the draft,
and is retained for retries and inherited by subagents. Unsupported effort choices
are rejected server-side; providers without effort metadata do not show the control.

Paid ChatGPT subscriptions with an image-capable model can use `generate_image`
when explicitly asked to create an image. This uses Codex's subscription image
proxy, not a stable public API; there is no paid API-key fallback. New image
generation is supported, not reference-image editing. The reusable `GeneratedImage`
component handles generation, preview, load retry, opening, and downloading.
PNG files are private to the browser session and stored under
`.amp/data/generated-images/` until that directory or the orb is removed; there
is no automatic retention cleanup. Files survive server restarts, but losing the
session cookie loses access. Browser transcripts store URLs, never image payloads.

The **Conversations** menu starts a new chat without discarding earlier ones and
reopens saved chats with their original runtime context. Transcripts and drafts
are stored in browser `sessionStorage` (the current tab's session, not a durable
or cross-device archive). Runtime contexts remain server-side and expire after
30 minutes idle, a server restart, or a provider sign-in change. Expired chats
remain readable; resuming them shows an explicit error rather than silently
starting without context. Runs continue server-side when a browser disconnects.
Reloading an unfinished response reconnects and replays the latest run's events
without resubmitting the prompt or tools. Stream interruptions reconnect automatically
up to three times; **Stop** still explicitly cancels the run. Replay is private to
the browser session and conversation, retained in server memory for the latest
turn only, and does not survive a server restart.

## Workspace

- `packages/foundations` — semantic StyleX tokens and scoped themes
- `packages/primitives` — owned React APIs backed by Base UI and styled with StyleX
- `packages/components` — agent-interface components built only on owned primitives
- `packages/blocks` — controlled chat-session and virtualized timeline compositions
- `apps/demo` — Vite playground, component gallery, and reference runtime adapters

## Knowledge base

- [Executive synthesis](docs/knowledge-base/README.md)
- [OpenCode UI replacement north star and gap analysis](docs/knowledge-base/opencode-north-star.md)
- [OpenCode chat-interface parity specification and work plan](docs/knowledge-base/opencode-chat-parity-spec.md)
- [Library construction plan](docs/knowledge-base/library-construction.md)
- [StyleX and React foundation](docs/knowledge-base/stylex-react.md)
- [Design-engineering research](docs/knowledge-base/design-engineering.md)
- [Component-system model](docs/knowledge-base/component-system.md)
- [Human and machine accessibility](docs/knowledge-base/accessibility.md)
- [Agent runtime options](docs/knowledge-base/agent-runtimes.md)
- [Amp client feasibility, deferred](docs/knowledge-base/amp-client.md)
- [Annotated sources](docs/knowledge-base/sources.md)

## Status

The workspace includes themed StyleX foundations, owned Base UI-backed
primitives, conversation and agent-state components, structured coding output,
the controlled chat composition, OpenCode and provider-backed playground adapters,
and a component gallery. The [50-component parity tracker](docs/knowledge-base/component-system.md#external-ai-component-parity-tracker)
records shipped equivalents and the remaining component work. Registry, CLI,
and MCP distribution remain future tasks. Statements marked
**Proposal** or **Hypothesis** in the knowledge base are starting positions to
validate, not settled project decisions.
