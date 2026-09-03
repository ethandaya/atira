# Initial knowledge base

Research snapshot: **August 28, 2026**

This knowledge base turns the reference material into implementation guidance for an AI component library and a thin protocol-neutral reference client. It separates:

- **Observed** — supported directly by a primary source or public code;
- **Requirement** — a standard or project quality floor;
- **Proposal** — the current recommended implementation direction; and
- **Hypothesis** — something that should be tested with prototypes or users.

The distinction matters. Design discourse is useful evidence, but it is not a specification. StyleX improves constraints, but it does not make generated UI correct. Accessibility standards cover people; “LLM accessibility” is not an established standard.

## Current north star

As of September 3, 2026, the reference client's north star is behavioral replacement of [OpenCode's graphical web/desktop UI](opencode-north-star.md). The component library remains protocol-neutral; OpenCode-specific event reconciliation, persistence, routing, and native integration remain application concerns. The earlier generic runtime proposals are retained as research, but they no longer determine component priority.

Implementation is currently narrowed to the [OpenCode chat-interface parity specification](opencode-chat-parity-spec.md): transcript, message parts, tools, composer, request docks, and the minimum adapter needed to prove them. Project navigation, files/review, interactive terminal, settings, and desktop-shell parity follow only after that surface meets its definition of done.

## Executive thesis

The construction model should borrow shadcn’s layering without depending on shadcn’s schemas, CLI, or Tailwind machinery: owned primitives with accessibility behavior, components and blocks built on those primitives, and source distribution through first-party CLI and MCP tooling. The StyleX-first primitive APIs and machine-readable contracts are the product, not a styling substitution inside someone else’s registry.

The resulting source-owned component system should be deliberately legible to both humans and coding agents:

- finite, typed variants instead of arbitrary utility strings;
- semantic tokens instead of hard-coded presentation;
- explicit anatomy, states, events, side effects, and accessibility behavior;
- developer-authored components selected by model/tool output rather than generated JSX;
- live, bounded controls for tuning taste-sensitive values;
- examples, non-examples, and machine-readable manifests beside the source; and
- a real client that continuously tests those contracts under streaming, tools, errors, approvals, long-running work, and responsive use.

StyleX is a strong fit because its advantages line up with agent failure modes: it favors co-location, deterministic application-order merging, static extraction, typed style props, explicit theme variables, and encapsulation. It is not inherently “for AI”; the value comes from removing ambiguous styling paths and making the intended path enforceable.

## What the references converge on

### 1. Taste must become executable

[AI for Designers and Engineers](https://aiforui.dev/) frames AI as an amplifier of taste rather than a replacement for it. [Interfaces](https://interfaces.dev/) teaches craft through small decisions, interactive examples, source, and agent skills. [Interface Craft](https://www.interfacecraft.dev/) combines working knowledge, demonstrations, tools, and AI collaboration. The shared lesson is that “make it beautiful” is not a usable contract.

The library should encode taste as:

- defaults and semantic tokens;
- component anatomy and finite variants;
- motion, typography, color, spacing, and surface policies;
- prohibited patterns and escape-hatch rules;
- complete state examples;
- review criteria and executable checks; and
- dials for the few values that benefit from judgment in context.

### 2. Minimal does not mean silent

Agent interfaces need more operational truth than ordinary chat: current work, tool effects, execution location, permissions, failures, cancellation, queued input, changed files, and review status. Hiding those facts makes an interface visually quieter but operationally worse.

**Proposal:** keep the primary surface calm and expose detail progressively:

```diagram
┌───────────────────────────────────────────────┐
│ Thread context · execution state · permission │
├───────────────────────────────────────────────┤
│                                               │
│ Conversation                                  │
│                                               │
│ Current activity (one concise live row)       │
│                                               │
├───────────────────────────────────────────────┤
│ Composer · queue/steer · stop                 │
├───────────────────────────────────────────────┤
│ Outcome · review · changed files              │
└───────────────────────────┬───────────────────┘
                            │ disclose
                            ▼
                ┌────────────────────────┐
                │ Full activity/evidence │
                └────────────────────────┘
```

The drawer may be closed; the information may not be discarded.

### 3. Chat should carry intent, not every interaction

Language works well for underspecified goals. Direct manipulation works better for choosing, correcting, comparing, approving, and committing. Vercel’s [generative UI guidance](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) uses a bounded mapping from validated tool results to application-owned React components.

**Proposal:** the model may select a registered component and supply schema-valid data. It may not emit executable component code into the product runtime.

### 4. Styling is an API boundary

Linear’s [StyleX migration](https://linear.app/now/styling-linear-for-the-future-stylex) is primarily a story about boundaries: styling at a distance and open-ended component restyling had made regressions difficult to contain. Linear chose static extraction, deterministic merging, typed styling contracts, co-location, and a small API, then enforced its conventions with linting and repository checks.

**Proposal:** component style customization should be explicit and typed. A component owns its structure. Consumers receive semantic props, documented slots, theme variables, and narrowly constrained StyleX style props—not unrestricted `className` and `style` by default.

### 5. “Dial in” is an authoring workflow, not a runtime feature

[DialKit](https://joshpuckett.me/dialkit) shows the useful shape: a typed declaration produces live values and editor controls; stable IDs, persistence, presets, reset, and export make results reproducible. Its strongest idea is not the floating panel—it is converting subjective feedback into exact values that can be handed back to code or an agent.

**Proposal:** begin with a much smaller dev-only tool:

- number/range, boolean, enum, color/token, and nested group controls;
- finite variants mapped to precompiled StyleX styles;
- continuous preview values mapped to CSS custom properties;
- reset and optional local persistence;
- export as a deterministic token/component-default patch; and
- Base UI React form controls before custom widgets.

## Product principles

1. **Quiet surface, legible state.** Remove ornamental chrome, never status, consequence, provenance, or recovery.
2. **Semantic before visual.** Model messages, tool calls, plans, diffs, citations, artifacts, approvals, and outcomes as typed domain objects before styling them.
3. **Composition over configuration sprawl.** Prefer clear anatomy and subcomponents over dozens of booleans.
4. **Finite variants over arbitrary values.** Use continuous values only where live tuning or real data requires them.
5. **Style locally; theme semantically.** Components author against semantic variables and expose narrow styling contracts.
6. **Bounded generation.** Models choose from audited components; application code owns DOM, accessibility, and side effects.
7. **Reversible autonomy.** Consequential actions need clear effect, cancellation, review, undo, or an explicit irreversible boundary.
8. **Streaming is a state machine.** Never infer operational state from animated dots or prose.
9. **Accessibility is component behavior.** Keyboard, focus, naming, announcement, touch, zoom, and reduced motion are part of the API.
10. **Agent legibility comes from explicit contracts.** Structured manifests, complete examples, stable identifiers, and deterministic output are more useful than prompt-oriented marketing copy.
11. **Dials tune; they do not become production truth.** Preview overrides must export back to reviewed source.
12. **The reference client is the proving ground, not the library boundary.** Start with native fx ACP, keep adapters outside component props, and add other runtimes only through explicit capability mapping.

## Proposed system boundary

```diagram
┌──────────────────────────────────────────────────────────────┐
│ StyleX foundations → accessible primitives → AI components   │
│ Each item: source · contract · fixtures · tests · manifest    │
└──────────────────────────────┬───────────────────────────────┘
                               │ registry build
                               ▼
                     ┌──────────────────────┐
                     │ Versioned artifacts  │
                     │ catalog · source     │
                     └──────────┬───────────┘
                                │ shared registry engine
                        ┌───────┴────────┐
                        ▼                ▼
                  ┌──────────┐      ┌──────────┐
                  │ CLI      │      │ MCP      │
                  └────┬─────┘      └────┬─────┘
                       └────────┬────────┘
                                ▼
                     ┌──────────────────────┐
                     │ Consumer-owned source│
                     │ + install receipt    │
                     └──────────┬───────────┘
                                │ controlled state
        ┌───────────────────────┴────────────────────────┐
        ▼                                                ▼
┌──────────────────┐                           ┌──────────────────┐
│ Reference client │                           │ Other AI products│
└──────────────────┘                           └──────────────────┘
```

Protocol-specific event names must not leak into reusable components. Adapters reduce wire events into coherent library-owned state types before rendering.

## Initial decisions to validate

| Area | Starting position | Validation needed |
| --- | --- | --- |
| React | Target React 19.2 stable; test pinned Canary periodically | Confirm whether React 18 consumers matter before v1 |
| Primitives | Base UI React parts wrapped in owned StyleX-first APIs and machine contracts | Prove Button, Field, Disclosure, and one overlay without leaking Base UI-specific types upward |
| Styling | StyleX-only for owned source; explicit scoped CSS fallback for third-party/global DOM | First-party registry install and extraction spike in Vite |
| Themes | Typed StyleX variables and static scoped themes first | Test runtime-generated palettes only after core tokens work |
| Generation | Schema-to-registered-component mapping | Prototype tool result, approval, and artifact payloads |
| Dials | Dev-only typed controls that export source patches | Prototype token and component tuning separately |
| Accessibility | WCAG 2.2 AA floor, enhanced 44 px targets where practical | Browser and assistive-technology state matrix |
| Agent integration | Native `fx acp` through a thin trusted backend; Nanocodex second | Spike event mapping, history, cancellation, permissions, and recovery |
| Distribution | Owned versioned source registry; one core planner exposed through CLI and MCP | Clean install, receipt, diff, and three-way update fixture |

## What not to decide yet

- Electron versus Tauri versus a local web shell;
- final package and npm scope names;
- a hosted registry marketplace;
- framework adapters beyond React;
- arbitrary runtime theme generation;
- animation timeline tooling;
- a broad primitive library unrelated to AI interfaces; or
- support for private or reverse-engineered Amp APIs.

These decisions become cheaper after one vertical slice proves the event model, styling pipeline, theme contract, accessibility behavior, and adapter integration.

## Recommended first vertical slice

The first implementation should exercise the whole system with the fewest components:

1. the item manifest, registry build, shared planner, install receipt, and clean Vite fixture;
2. semantic tokens and light/dark themes installed as foundation items;
3. owned StyleX-first `Button`, `ComposerField`, `Disclosure`, `Status`, and `VisuallyHidden` wrappers built on Base UI wherever it supplies the primitive;
4. `Thread`, `Message`, `Composer`, `ToolActivity`, `PermissionRequest`, and `Outcome` AI components;
5. CLI `add`, `diff`, and safe `update`, with equivalent plan/apply MCP tools using the same engine;
6. deterministic event fixtures before any live runtime;
7. an fx ACP adapter for one isolated local execution, including cancellation and approval;
8. a small dial panel for density, measure, type scale, radius, and motion duration; and
9. keyboard, touch, zoom/reflow, reduced-motion, DOM semantics, and screen-reader announcement checks.

Do not start with the full component catalog. A vertical slice will reveal the real contract boundaries faster than designing dozens of isolated cards.

See the [library construction plan](library-construction.md) for registry boundaries, authoring units, build/distribution choices, quality gates, and implementation sequencing. See [agent runtime options](agent-runtimes.md) for the fx and Nanocodex decision.
