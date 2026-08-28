# Component-system model

## Goal

Build components that make AI work understandable, controllable, and beautiful without tying them to one model vendor or agent protocol.

The system should optimize for three consumers at once:

1. **People using the rendered interface** need clarity, accessibility, and control.
2. **Product engineers** need composable React APIs and predictable styling.
3. **Coding agents** need explicit contracts, complete examples, and deterministic validation.

Meeting the third need must not degrade the first. Extra hidden ARIA, metadata, or prose is not a substitute for a well-designed visible interface.

## Layers

```diagram
┌───────────────────────────────────────────────────────┐
│ Blocks                                                │
│ Thread view · coding task · research task · approval  │
├───────────────────────────────────────────────────────┤
│ AI patterns                                           │
│ Message · ToolActivity · Plan · Diff · Artifact       │
├───────────────────────────────────────────────────────┤
│ Owned accessible primitives                           │
│ Button · Field · Disclosure · Dialog · Status         │
├───────────────────────────────────────────────────────┤
│ Styling foundations                                   │
│ semantic tokens · themes · motion · typography        │
├───────────────────────────────────────────────────────┤
│ Contracts                                             │
│ domain types · state machines · schemas · manifests   │
└───────────────────────────────────────────────────────┘

                Development-only authoring layer
┌───────────────────────────────────────────────────────┐
│ Playground · fixtures · dials · state matrix · export │
└───────────────────────────────────────────────────────┘
```

The application belongs above blocks. Agent protocol adapters, auth, persistence, routing, and local process management are not component-library concerns.

Higher-level components may import only the owned primitive layer, not Base UI directly. Primitive wrappers use Base UI React parts and own the public props, StyleX styles, stable state markers, and human/machine contracts.

## Domain model before components

Protocol event names should be normalized into a small library-owned model. The following shapes are illustrative, not settled TypeScript:

```ts
type Actor = 'user' | 'assistant' | 'system'

type ConversationPart =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string; language?: string }
  | { type: 'citation'; label: string; href: string }
  | { type: 'tool'; activity: ToolActivity }
  | { type: 'plan'; plan: Plan }
  | { type: 'artifact'; artifact: Artifact }

type ToolActivityBase = {
  id: string
  tool: string
  summary: string
}

type ToolActivity = ToolActivityBase &
  (
    | { status: 'queued' }
    | { status: 'running'; startedAt?: string }
    | { status: 'awaiting-approval'; request: PermissionRequest }
    | { status: 'succeeded'; output?: unknown; endedAt?: string }
    | { status: 'failed'; error: string; endedAt?: string }
    | { status: 'cancelled'; endedAt?: string }
  )

type PermissionRequest = {
  id: string
  title: string
  effect: string
  consequence: 'reversible' | 'destructive' | 'external'
  choices: readonly ActionChoice[]
}
```

The adapter owns lossy protocol decisions such as turning `Bash` input into “Running tests.” The raw protocol event should remain available to the application’s evidence inspector.

## State machines

Streaming UI should be driven by explicit state, not by the presence of animated dots.

### Response

```diagram
┌──────┐ send ┌──────────┐ first content ┌───────────┐ complete ┌───────────┐
│ idle │─────▶│ starting │──────────────▶│ streaming │─────────▶│ completed │
└──────┘      └────┬─────┘               └──┬─────┬──┘          └───────────┘
                   │ error                   │     │ stop
                   ▼                         │     ▼
               ┌────────┐◀───────────────────┘ ┌──────────┐
               │ failed │       error           │ stopping │
               └────────┘                       └────┬─────┘
                                                   │
                                                   ▼
                                             ┌───────────┐
                                             │ cancelled │
                                             └───────────┘
```

### Tool activity

```diagram
queued ──▶ running ──┬──▶ succeeded
                    ├──▶ failed
                    ├──▶ cancelled
                    └──▶ awaiting-approval ──▶ running
                                           └──▶ cancelled
```

Not every protocol supports every transition. Components can be reusable without pretending the adapter can drive unsupported states.

### Thread outcome

Keep execution completion separate from review:

- `working`
- `blocked`
- `failed`
- `completed`
- `ready-for-review` — an application derivation when meaningful changes exist
- `reviewed` — a human or external workflow decision

An agent stopping is not the same as work being reviewed or shipped.

## Initial catalog

### Foundations

Build only foundations required by the first AI slice:

- `Button`
- `IconButton`
- `TextField` / `ComposerField`
- `Disclosure`
- `Dialog`
- `Status`
- `Progress`
- `VisuallyHidden`

Use Base UI React primitives internally. Do not wrap a generic menu, combobox, grid, tooltip, or data-table before a real AI component needs it.

### AI components

| Component | Responsibility | Key states |
| --- | --- | --- |
| `Thread` | Labelled chronological conversation container | empty, populated, loading history |
| `Message` | One actor’s stable content boundary | user, assistant, system, interrupted |
| `Response` | Rich prose/code/citation output | streaming, complete, error |
| `Composer` | Draft, send, queue/steer, attach, stop | empty, valid, sending, disabled, error |
| `ActivitySummary` | One concise current-operation row | running, blocked, approval, error |
| `ActivityList` | Full chronological tool evidence | grouped, expanded, filtered |
| `ToolActivity` | One typed tool execution | queued through terminal states |
| `Outcome` | Completion and next action | complete, failed, cancelled, reviewable |
| `PermissionRequest` | Consequential tool permission choice | pending, submitting, accepted, rejected, expired |
| `Plan` | Ordered proposed or executing work | proposed, active, partial, complete |
| `Diff` | Accessible file changes | added, removed, modified, collapsed |
| `CodeBlock` | Code with language and copy behavior | wrapped, scrollable, copied |
| `CitationList` | Sources and provenance | inline, expanded, invalid link |
| `Artifact` | File/image/portal/result reference | generating, ready, failed |

The first vertical slice needs only `Thread`, `Message`, `Composer`, `ToolActivity`, `PermissionRequest`, and `Outcome`, plus disclosed evidence inside `ToolActivity`. The rest should follow real use.

## API rules

1. **Controlled by default for product state.** Public components receive state and callbacks. Timers, fake completion, model lists, and demo transitions live in examples.
2. **State is discriminated.** Do not combine booleans such as `loading`, `failed`, `done`, and `cancelled` into impossible combinations.
3. **Side effects are named.** `onApprove`, `onReject`, `onCancel`, and `onOpenArtifact` are clearer than a generic `onAction` when consequences differ.
4. **Data is structured.** A diff component receives files and hunks, not preformatted HTML. A table receives headers and cells, not model-specific row objects.
5. **Composition has boundaries.** Use compound components when consumers truly arrange anatomy; use simple props for fixed semantics.
6. **Native element props are forwarded deliberately.** Preserve valid names, refs, form behavior, and semantics without letting prop order overwrite StyleX output.
7. **Defaults are real behavior.** Do not expose props that only work in the docs preview.
8. **Text is overridable when product voice varies.** Accessibility-critical defaults may be provided, but visible effect labels should come from the caller’s domain.
9. **No hidden destructive defaults.** Timed or automatic approval is opt-in at the application policy layer, never a visual component default.
10. **Render-only entries remain server-compatible.** Stateful wrappers live in separate client entry points where practical.

## Bounded generative UI

The safe rendering path is:

```diagram
┌─────────────┐   typed tool call   ┌──────────────────┐
│ Model/agent │────────────────────▶│ Schema validator │
└─────────────┘                     └────────┬─────────┘
                                           │ valid data
                                           ▼
                                  ┌────────────────────┐
                                  │ Component registry │
                                  └────────┬───────────┘
                                           │ known component
                                           ▼
                                  ┌────────────────────┐
                                  │ Audited React DOM  │
                                  └────────────────────┘
```

Reject unknown component names, props, actions, URLs, and executable content. A renderer may support a protocol such as A2UI, AG-UI, or MCP Apps through adapters later; none should define the core component API while those protocols are evolving.

## Agent-readable component manifests

Every public component should have a colocated structured manifest or a source format from which one can be generated.

```ts
type ComponentManifest = {
  id: string
  summary: string
  useWhen: string[]
  avoidWhen: string[]
  anatomy: { slot: string; purpose: string }[]
  props: PropContract[]
  states: StateContract[]
  events: EventContract[]
  accessibility: {
    semantics: string
    keyboard: string[]
    focus: string[]
    announcements: string[]
  }
  tokens: string[]
  examples: string[]
  nonExamples: string[]
}
```

The exact storage format is an implementation decision. The required information is not.

### Why manifests matter

- A human can understand the intended boundary without reading every style.
- An agent can select a component by purpose rather than visual resemblance.
- Docs and registry metadata can be generated from the same source.
- Tests can assert that all declared states have fixtures.
- Breaking changes to props, events, accessible names, and state transitions become visible.

Manifests do not replace TypeScript, lab/playground examples, or accessible DOM tests. They connect those artifacts.

## Theme and styling exposure

Components should expose:

- semantic variants (`tone`, `emphasis`, `density`, `size`);
- global semantic theme variables;
- component variables only where a cross-component theme cannot express a stable need;
- documented slots where content composition is legitimate; and
- narrow StyleX style props for exceptional surface-level overrides.

Components should not expose:

- raw internal class names;
- descendant selectors as an API;
- every token as a prop;
- arbitrary object-based CSS callbacks;
- a `dark` boolean independent of theme context; or
- duplicated one-off CSS variable namespaces per component.

## Design dials

The smallest useful authoring system has four parts:

```diagram
typed declaration ─▶ metadata ─▶ external store ─▶ accessible editor
       │                                │                    │
       └──────── typed live values ◀────┘                    │
                                                            ▼
                                                     exported patch
```

### Initial controls

- number/range;
- boolean;
- enum/select;
- color or semantic-token choice; and
- nested groups.

### Store behavior

- stable panel ID;
- immutable snapshots through `useSyncExternalStore`;
- flat internal paths and typed nested output;
- set, reset, and optional versioned local persistence; and
- deterministic export.

### Explicit non-goals for the first version

- multi-framework adapters;
- global gesture shortcuts;
- custom select or color widgets;
- action scripting;
- spring/easing editors;
- timeline composition;
- production personalization; and
- automatically writing tuned values into source.

The exported patch should be reviewable and applied by a person or coding agent.

## Documentation and fixture requirements

Each component should ship with:

1. one minimal valid example;
2. representative real-data example;
3. all public states, including error and interruption;
4. long text, long code, and narrow-width fixtures where relevant;
5. light, dark, high-contrast/forced-colors, and reduced-motion coverage;
6. keyboard and focus behavior;
7. accessible name/role/state expectations;
8. token and style-slot documentation;
9. one misuse/non-example; and
10. registry item, source dependencies, and compiler requirements.

This is the primary “AI collaboration” surface. An agent should not have to infer component behavior from a polished screenshot.

## Distribution direction

AICSS and shadcn demonstrate the value of copied source, explicit source dependencies, and searchable catalogs. This project should own that mechanism so the registry schema can make StyleX configuration, accessibility contracts, machine-selection guidance, and safe updates first-class.

**Proposal:**

1. author canonical React/StyleX source as `foundation`, `primitive`, `component`, and `block` items;
2. give every item explicit package dependencies, source-item dependencies, files, version, compatibility, and machine contract;
3. build a searchable catalog plus immutable versioned source artifacts;
4. implement registry resolution, write planning, receipts, and three-way updates once in a transport-neutral core;
5. expose the same core through a CLI and structured MCP tools; and
6. add an npm component package only if a consumer needs dependency-style upgrades instead of source ownership.

Registry clients must validate path traversal, show a write plan, avoid overwriting or merging conflicts by default, bind apply operations to reviewed file hashes, and never trust server-provided target paths directly.
