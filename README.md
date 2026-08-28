# Pretty Amped

Pretty Amped is the working title for two related products:

1. a StyleX-first React component system with its own accessible primitives, source registry, CLI, and MCP server for AI and agent interfaces; and
2. an ultraminimal reference client that proves the component system against a real coding-agent workflow.

The client should stay thin and protocol-neutral. The first live adapter will use native `fx acp`; Nanocodex and Amp remain useful future adapters. Protocol handling and product-specific composition belong at the application edge; visual language, interaction contracts, accessibility, semantic agent states, and theming belong in the library.

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
- [Library construction plan](docs/knowledge-base/library-construction.md)
- [StyleX and React foundation](docs/knowledge-base/stylex-react.md)
- [Design-engineering research](docs/knowledge-base/design-engineering.md)
- [Component-system model](docs/knowledge-base/component-system.md)
- [Human and machine accessibility](docs/knowledge-base/accessibility.md)
- [Agent runtime options](docs/knowledge-base/agent-runtimes.md)
- [Amp client feasibility, deferred](docs/knowledge-base/amp-client.md)
- [Annotated sources](docs/knowledge-base/sources.md)

## Status

The first slice includes light/dark themes, a Base UI-backed `Button`, and a
controlled `PermissionRequest`. Registry, CLI, MCP, blocks, and runtime adapters
remain future tasks. Statements marked **Proposal** or **Hypothesis** in the
knowledge base are starting positions to validate, not settled project decisions.
