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

## Workspace

- `packages/foundations` — semantic StyleX tokens and scoped themes
- `packages/primitives` — owned React APIs backed by Base UI and styled with StyleX
- `packages/components` — agent-interface components built only on owned primitives
- `apps/demo` — Vite app consuming the workspace packages from source

## Knowledge base

- [Executive synthesis](docs/knowledge-base/README.md)
- [OpenCode UI replacement north star and gap analysis](docs/knowledge-base/opencode-north-star.md)
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
and a component gallery. The [50-component parity tracker](docs/knowledge-base/component-system.md#external-ai-component-parity-tracker)
records shipped equivalents and the remaining component work. Registry, CLI,
MCP, blocks, and runtime adapters remain future tasks. Statements marked
**Proposal** or **Hypothesis** in the knowledge base are starting positions to
validate, not settled project decisions.
