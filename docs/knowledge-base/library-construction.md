# Library construction plan

Research snapshot: **August 28, 2026**

This document turns the initial design research into a buildable library architecture. It is intentionally narrower than a complete agent framework. The first goal is to prove excellent component contracts, styling, accessibility, documentation, and adapter boundaries before adding a large runtime or catalog.

## Decision summary

1. Build an **owned StyleX-first component system** with four source layers: foundations, accessible primitives, AI components, and composed blocks.
2. Use Base UI as the React primitive substrate. Own thin StyleX-first wrappers, contracts, and machine metadata around its parts; higher-level components import those wrappers rather than Base UI directly.
3. Treat human accessibility and machine legibility as first-class but distinct contracts. “LLM accessibility” adds explicit selection, anatomy, state, action, effect, and example metadata; it does not mean adding hidden ARIA for models.
4. Keep component contracts protocol-neutral—not fx, Nanocodex, Amp, AI SDK, or provider UI types.
5. Build a small first-party source registry and transport-neutral registry engine. Expose that same engine through a CLI and MCP server rather than adopting shadcn’s schemas or delegating MCP writes to shell commands.
6. Make copied source safely updatable: immutable item artifacts and an install receipt must support a three-way comparison between previous upstream, local source, and new upstream.
7. Make AI components controlled: they render explicit snapshots and emit named human actions. They do not infer agent state from prose or own fake timers.
8. Keep stream parsing, process control, credentials, persistence, and provider conversion in adapters or applications.
9. Use a purpose-built Vite lab rather than Storybook initially. The lab owns fixtures, state matrices, responsive review, dials, and adapter demonstrations.
10. Treat manifests, examples, non-examples, browser tests, installation fixtures, and update fixtures as part of each item—not ancillary documentation.
11. Use native `fx acp` as the first live coding-agent adapter and Nanocodex as a second adapter/lifecycle reference.

## What is being built

The reusable product includes both the source layers and the delivery tooling:

```diagram
┌──────────────────────────────────────────────────────────────┐
│ Authoritative source                                         │
│ foundations → primitives → AI components → blocks            │
│ React · StyleX · contracts · fixtures · manifests · tests    │
└───────────────────────────┬──────────────────────────────────┘
                            │ registry build
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Search catalog + immutable versioned item artifacts          │
│ files · package deps · item deps · compatibility · contracts  │
└───────────────────────────┬──────────────────────────────────┘
                            │ shared registry engine
                ┌───────────┴───────────┐
                ▼                       ▼
         ┌─────────────┐         ┌─────────────┐
         │ CLI         │         │ MCP server  │
         │ human shell │         │ agent tools │
         └──────┬──────┘         └──────┬──────┘
                └───────────┬────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Consumer-owned source + installation receipt                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ application supplies state
              ┌─────────────┴──────────────┐
              ▼                            ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│ Component lab            │  │ Thin reference client         │
│ fixtures · dials · docs  │  │ fx ACP first                  │
└──────────────────────────┘  └───────────────────────────────┘
```

The components are not an agent runtime. A runtime may emerge later if two real adapters reveal repeatable stream accumulation, queueing, persistence, and branch behavior. Building that abstraction before the fx slice would reproduce much of assistant-ui without evidence that this project needs the same scope.

This source-owned model is compatible with StyleX because the registry copies analyzable source into the consumer’s project. The installation plan must also establish and verify a compatible StyleX compiler/extraction setup.

## Lessons from current AI component libraries

### shadcn/ui registry model

shadcn is an architectural reference, not a dependency. Its durable pattern combines owned primitive source, composed components and blocks, authored item metadata, build-generated static artifacts, explicit package/source dependency graphs, destination aliases, and a CLI that plans and copies source into the consumer’s repository.

As of July 2026, shadcn defaults new projects to Base UI while keeping Radix supported. That validates React + Base UI wrappers as a mainstream source-owned architecture, independent of Tailwind as the styling choice.

**Adopt as patterns:** owned primitive/component/block layers, catalog plus per-item artifacts, explicit package and source dependencies, recursive resolution, destination aliases, dry-run/diff planning, traversal protection, and source ownership.

**Do not adopt:** shadcn’s schemas, `components.json`, Tailwind mutation machinery, base/style/icon/font combinatorics, framework scaffolding, parallel primitive implementations, or large official-site build pipeline.

One important behavior should be improved rather than copied: shadcn records no previous installed revision, so customized files can be diffed, skipped, or overwritten but not safely three-way merged. Its MCP server also focuses on discovery and returns CLI commands for installation rather than exposing the complete write planner directly. This project should make receipts, update plans, and structured MCP operations first-class.

Sources: [custom registries](https://ui.shadcn.com/docs/registry), [registry setup](https://ui.shadcn.com/docs/registry/getting-started), [dependency resolver](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/registry/resolver.ts), [write/update behavior](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/utils/updaters/update-files.ts), [MCP implementation](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/mcp/index.ts), and [Base UI default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default).

### AICSS

AICSS demonstrates a useful domain catalog, independent subpath imports, a no-Tailwind React option, and the appeal of source-copy distribution. Its current components often own demo content, simulation timers, model lists, attachment behavior, and consequential auto-transitions.

**Adopt:** catalog clarity, direct imports, small visual treatments, package-versus-registry distinction.

**Avoid:** examples presented as product abstractions, complete-string reveal called streaming, fake service behavior, and internal timers controlling approvals or completion.

Sources: [AICSS repository](https://github.com/kvnkld/aicss), [`@aicss/react` package](https://github.com/kvnkld/aicss/blob/main/packages/react/package.json), [streaming text](https://github.com/kvnkld/aicss/blob/main/packages/react/src/streaming-text/StreamingText.tsx), [approval card](https://github.com/kvnkld/aicss/blob/main/packages/react/src/approval-card/ApprovalCard.tsx).

### Vercel AI Elements

AI Elements demonstrates understandable compound anatomy, broad browser tests, source ownership through a registry, and carefully implemented local behavior such as attachment cleanup. Its reusable UI types frequently import AI SDK types directly, and its base dependency set includes heavy renderers and media packages.

**Adopt:** small compound visual APIs, controlled/uncontrolled local disclosure, browser-level interaction tests, optional source-owned recipes.

**Avoid:** provider types in visual props, heavy renderers in the base package, internal registration hooks in public APIs, and behavior policy hidden inside presentation.

Sources: [AI Elements repository](https://github.com/vercel/ai-elements), [message](https://github.com/vercel/ai-elements/blob/main/packages/elements/src/message.tsx), [tool](https://github.com/vercel/ai-elements/blob/main/packages/elements/src/tool.tsx), [reasoning](https://github.com/vercel/ai-elements/blob/main/packages/elements/src/reasoning.tsx), [package dependencies](https://github.com/vercel/ai-elements/blob/main/packages/elements/package.json).

### assistant-ui

assistant-ui has the strongest architectural precedent: provider adapters sit outside a normalized message model; a runtime owns state and capabilities; headless React primitives expose composition; the styled layer is separate. Its maturity also shows the cost of that scope: many packages, a broad root facade, deprecated paths, and protocol-specific fields accumulating in generic types.

**Adopt:** normalization before rendering, discriminated message parts, capability-driven controls, external controlled stores, tool-name render registries, and adapter contract tests.

**Avoid initially:** a complete runtime, one enormous convenience barrel, every provider feature in the canonical model, and one package per speculative concern.

Sources: [assistant-ui repository](https://github.com/assistant-ui/assistant-ui), [core message model](https://github.com/assistant-ui/assistant-ui/blob/main/packages/core/src/types/message.ts), [message-part rendering](https://github.com/assistant-ui/assistant-ui/blob/main/packages/core/src/react/primitives/message/MessageParts.tsx), [external-store adapter](https://github.com/assistant-ui/assistant-ui/blob/main/packages/core/src/runtimes/external-store/external-store-adapter.ts).

## Registry and repository shape

Use a pnpm workspace without Turbo or another task orchestrator initially:

```text
repo/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── library/
│   ├── foundations/          # contracts, StyleX variables, themes
│   ├── primitives/           # owned StyleX-first accessible APIs
│   ├── components/           # AI components using only primitives
│   └── blocks/               # composed workflows and client recipes
├── packages/
│   ├── registry-core/        # schema, fetch, resolve, plan, apply, update
│   └── cli/                  # CLI commands and MCP stdio entry point
├── apps/
│   ├── lab/                  # docs, fixtures, dials, visual review
│   └── client/               # add after fixture-driven UI works
├── tests/
│   └── consumers/            # clean first-party install Vite/Next fixtures
└── dist/registry/            # generated catalog/items; never hand-edit
```

Each installable item owns an adjacent manifest, implementation, fixtures, and browser test. The build includes only declared distributable files; fixtures and tests remain authoring inputs.

### Foundation items

Responsibilities:

- StyleX compiler/runtime requirements and project compatibility checks;
- semantic variable groups and static themes;
- protocol-neutral discriminated types and capabilities;
- StyleX configuration guidance or framework-specific setup items; and
- no provider, process, storage, credential, or network logic.

Do not put an event bus, global store, fetch client, session database, or provider adapter in the foundation layer. Add a reducer only when fixtures demonstrate the same transition logic is needed outside one app.

### Primitive, component, and block items

Responsibilities:

- owned StyleX-first React wrappers over Base UI primitives;
- StyleX styles, variants, stable state/slot attributes, and typed style contracts;
- AI components importing owned primitives rather than behavior libraries directly;
- blocks composing components without introducing protocol or application state;
- explicit source-item dependencies following the foundation → primitive → component → block direction;
- package dependencies only for underlying libraries unique to an item; and
- metadata, fixtures, and browser tests linked to the same source.

Heavy content renderers are separate registry items. Markdown, Shiki, Mermaid, charts, media, diff engines, and canvas rendering should not enter every installed component’s dependency graph.

### Why use an owned source registry instead of an npm component package

- Source ownership is aligned with AI-assisted editing: agents inspect and change normal local React/StyleX files.
- StyleX source is compiled in the consumer’s own pipeline, avoiding a second precompiled CSS ordering contract.
- Source-item dependencies can install shared contracts, tokens, themes, and primitives with one operation.
- A purpose-built schema can make StyleX setup, machine contracts, compatibility, immutable revisions, and update provenance first-class.
- CLI and MCP users receive the same structured search, explanation, write-plan, and update behavior.

The cost is explicit: this project owns the registry engine and update semantics, and the destination must have compatible StyleX build configuration. That work is central to the requested product rather than incidental scaffolding.

### Registry-engine boundary

Implement registry behavior once in `registry-core`, without Commander, MCP, terminal prompts, or framework UI. Both transports call the same operations:

- `searchItems` and `getItem`;
- `resolveItemGraph` with cycle detection and topological ordering;
- `planInstall` and `planUpdate`;
- `applyPlan` with expected-hash checks;
- `diffInstalled`; and
- `doctorProject`.

The CLI exposes human-oriented `search`, `view`, `add`, `update`, `diff`, and `doctor` commands. The MCP server exposes structured read tools plus separate plan/apply mutation tools. An MCP apply call must reference an unexpired plan ID bound to the project root and expected file hashes; the server must not accept model-invented arbitrary target paths or shell commands.

Support one destination toolchain first—Vite React. Do not overwrite an existing `vite.config.ts` or `next.config.*` blindly. If a required compiler edit cannot be transformed safely, report it as an explicit manual change in the plan until a tested project adapter exists.

### `apps/lab`

The lab is the primary development environment and public documentation source. It should:

- render every public state from deterministic fixtures;
- switch theme, width, text scale, direction, forced colors, and reduced motion;
- replay normalized event sequences at controllable speed;
- expose bounded design dials;
- show computed semantics and registry metadata;
- generate documentation and machine-readable indexes; and
- run without credentials or a live model.

Do not begin with Storybook. A focused Vite app is easier to integrate with the official StyleX plugin, can model entire thread workflows, and can itself use the component system. Revisit Storybook only if its addon ecosystem solves a demonstrated need the lab does not.

### Adapters and the reference client

Start the fx adapter inside the reference app. Extract it into a shared module only after another consumer or second adapter needs the same boundary. That keeps process supervision and an experimental protocol from defining the library topology prematurely.

An eventual adapter owns:

- JSON-RPC or SDK transport;
- protocol capability negotiation;
- event correlation and stream accumulation;
- raw evidence retention;
- session persistence and recovery;
- cancellation, steering, and approval transport;
- credentials and execution isolation; and
- conversion into neutral snapshots and actions.

## Contract design

### Components render snapshots, not protocol events

Transport streams are append-oriented and recovery-sensitive. React components need coherent immutable state. Keep these boundaries distinct:

```diagram
wire event ─▶ validate ─▶ normalize ─▶ reduce ─▶ immutable snapshot ─▶ render
    │                                                       │
    └────────────── retain as evidence metadata ────────────┘
```

A `ToolActivity` should not parse ACP `tool_call_update`, Nanocodex `tool.result`, or AI SDK `ToolUIPart`. It should receive one valid tool state.

### Prefer state-specific unions

Avoid optional-field objects that permit contradictory combinations:

```ts
type ToolActivityState =
  | {
      status: 'queued'
      id: string
      label: string
    }
  | {
      status: 'running'
      id: string
      label: string
      startedAt?: number
      progress?: ToolProgress
    }
  | {
      status: 'awaiting-approval'
      id: string
      label: string
      request: PermissionRequest
    }
  | {
      status: 'succeeded'
      id: string
      label: string
      outcome?: ToolOutcome
    }
  | {
      status: 'failed' | 'cancelled'
      id: string
      label: string
      message?: string
    }
```

The exact fields should be proven by fx fixtures before becoming public. The important rule is that a state declares what data is valid in that state.

### Keep capabilities explicit

Controls should represent supported behavior, not infer it from vendor names or callback presence:

```ts
type AgentCapabilities = {
  cancellation: boolean
  steering: boolean
  queueing: boolean
  approvals: boolean
  attachments: readonly ('text' | 'image' | 'file')[]
  sessionHistory: 'none' | 'load' | 'resume'
}
```

The application turns capabilities into visible actions. The component library must not show a steer, upload, or approval control that merely pretends to work.

### Preserve protocol extensions without exposing them to DOM

The adapter may retain namespaced raw metadata for diagnostics and future features:

```ts
type Extensions = Readonly<Record<string, unknown>>
```

That data is evidence, not a general rendering API. Never spread extension objects into JSX, ARIA, URLs, styles, or callbacks.

## Component API construction

### Ownership rules

- The application owns agent/session state and consequential side effects.
- The component owns semantics, internal anatomy, visual state, focus behavior, and local presentation-only state.
- The parent owns layout between sibling components.
- A compound root owns shared state only when its parts genuinely coordinate.
- A renderer owns conversion from structured content to audited React nodes.

### Choose the smallest API shape

Use a simple component when anatomy is fixed:

```tsx
<Message role="assistant" status="complete">
  <MessageContent>{content}</MessageContent>
</Message>
```

Use compound components when parts share state or legitimately vary:

```tsx
<ToolActivity state={activity}>
  <ToolActivitySummary />
  <ToolActivityDetails>{details}</ToolActivityDetails>
</ToolActivity>
```

Do not create compounds solely to make an API look like Radix or shadcn. Do not replace ordinary JSX composition with large configuration objects.

### State ownership

- Agent, tool, approval, composer submission, and outcome state are controlled.
- Local disclosure may support `open`/`defaultOpen`/`onOpenChange`.
- A controlled component never also advances itself on a timer.
- Demos simulate state outside the component.
- Effects are named by consequence: `onApprove`, `onReject`, `onCancel`, `onRetry`, and `onOpenArtifact` rather than generic `onAction` when behavior differs.

### DOM and prop policy

- Mirror native names such as `disabled`, `readOnly`, `required`, `value`, and `onChange`.
- Forward refs and relevant HTML, `aria-*`, and `data-*` attributes.
- Default wrapped buttons to `type="button"`.
- Never allow prop spread order to replace StyleX output accidentally.
- Do not expose `asChild` universally. Use a polymorphic/render boundary only where changing the semantic element is valid and testable.
- A link-styled button remains an anchor when it navigates; a button remains a button when it acts.
- Stable public `data-state` or `data-status` attributes may support inspection and tests, but must be documented if consumers can rely on them.

### Styling customization

Customization order:

1. semantic props such as `tone`, `emphasis`, `density`, and `size`;
2. composition through children and documented slots;
3. semantic theme variables;
4. narrowly typed StyleX style props on the few components that need local surface customization; and
5. an explicit interop wrapper when third-party `className` or inline style is unavoidable.

Do not expose unrestricted `className`, CSS callbacks, arbitrary token props, or a universal `sx` escape hatch on owned semantic components. Low-level interop components can have a different documented contract.

### Component source unit

Keep all artifacts for a component adjacent:

```text
registry/ui/tool-activity/
├── tool-activity.tsx          # implementation and colocated StyleX styles
├── tool-activity.fixtures.tsx # real and adversarial examples
└── tool-activity.test.tsx     # browser interaction/semantics

registry/ui/registry.json      # files, dependencies, docs, AI metadata
```

Do not extract one-use type, style, or helper files merely for uniformity. The component directory and its registry entry are the ownership unit; the implementation should stay as small as its behavior allows.

## Styling and themes

### StyleX authoring contract

- Keep `stylex.create()` beside the component.
- Keep variable groups in dedicated `.stylex.ts` modules with direct named exports.
- Apply base, variant, state, and documented caller styles in intentional order.
- Use semantic variables inside components, not raw tonal ramps.
- Avoid dynamic values unless the value comes from real data or a dev-only dial.
- Use precompiled variants for finite options.
- Keep CSS Modules or plain CSS as a scoped exception for global and third-party DOM only.

### What the StyleX base system is

StyleX is the CSS/compiler substrate, not a ready-made design system. The source registry must provide the semantic layer:

- `defineVars()` variable groups for public foundations and semantic roles;
- `createTheme()` for light, dark, high-contrast, density, and nested overrides;
- named `stylex.create()` styles for component anatomy, states, responsive rules, and variants;
- owned stable state/slot attributes and cross-slot relationships, adapted from any internal behavior dependency; and
- typed component style contracts where source-owned consumers need controlled overrides.

`@stylexjs/atoms` is useful for isolated one-property layout glue. It explicitly provides no design tokens, themes, variants, responsive prop model, selectors, components, or accessibility behavior. Using atoms as the primary authoring language would recreate utility-string styling with less semantic intent. Use it sparingly; do not build the component API around it.

This means we build our own **design-system and primitive API layer**, but not our own styling compiler or complex interaction algorithms by default.

### Initial token layers

```diagram
foundations                 semantic roles              components
spacing · type · ramps ───▶ canvas · text · border ───▶ rare stable aliases
motion · radius             focus · accent · danger     composer · approval
```

Components normally consume semantic roles. Component-specific tokens should appear only when multiple components or themes need to coordinate a stable concept that ordinary semantic roles cannot express.

Start with reviewed static light, dark, and high-contrast themes. Theme derivation and dials may generate proposed source values, but production rendering should not depend on an arbitrary runtime palette engine.

Do not ship a global reset, mandatory font download, or page-level body styles from the library. The lab can demonstrate the recommended environment; consumers retain document ownership.

## Base UI + StyleX primitive policy

Base UI is the default React primitive system. The library owns the wrapper APIs, StyleX styles, stable state markers, accessibility contracts, and machine contracts while Base UI owns interaction behavior and browser semantics:

| Owned primitive | Base UI substrate |
| --- | --- |
| Button / IconButton | Base UI Button |
| TextField / ComposerField | Base UI Field and Input; multiline control through `Field.Control`’s React `render` composition |
| Disclosure | Base UI Collapsible |
| Select | Base UI Select |
| Dialog, tooltip, menu, combobox | Corresponding Base UI package |

Base UI does not conflict with StyleX-first ownership: it is a React library with no visual styling, composes through a `render` prop, forwards behavior props, and exposes state for StyleX. Only primitive wrappers may import it. Semantic public props should not expose Base UI-specific types unless the behavior genuinely requires them; higher-level components import only owned wrappers. Enforce that direction with package/export boundaries and lint rules.

Do not maintain parallel Base UI, Radix, and React Aria implementations. If Base UI cannot satisfy a required behavior, document that concrete gap before adding or building an exception. Pin Base UI versions and exercise keyboard, pointer, focus, dismissal, portal, SSR, and hydration behavior before upgrades.

Source: [Base UI composition](https://base-ui.com/react/handbook/composition).

## Machine-readable collaboration surface

Each item has an explicitly versioned first-party manifest. This is the project’s “LLM accessibility” layer: a coding agent can discover when to use an item, understand its valid state/action surface, inspect examples, and install it without reverse-engineering a screenshot or prose page.

```ts
type RegistryItem = {
  schemaVersion: 1
  id: string
  version: string
  kind: 'foundation' | 'primitive' | 'component' | 'block'
  files: readonly RegistryFile[]
  itemDependencies: readonly string[]
  packageDependencies: readonly PackageDependency[]
  compatibility: CompatibilityContract
  machine: {
    useWhen: readonly string[]
    avoidWhen: readonly string[]
    anatomy: readonly ComponentSlot[]
    states: readonly ComponentState[]
    actions: readonly ComponentAction[]
    accessibility: AccessibilityContract
    tokens: readonly string[]
    examples: readonly string[]
    nonExamples: readonly string[]
  }
}
```

The manifest is authored beside the item, validated before the registry build, and generates:

- human component reference pages;
- the searchable catalog and versioned item metadata;
- concise `llms.txt` and detailed Markdown documentation;
- state-matrix completeness checks; and
- stable links to examples and non-examples.

The registry MCP server exposes these contracts directly and can filter by purpose, state, action, dependency, or compatibility. Installed TypeScript APIs, stable `data-slot`/`data-state` markers, and the receipt make local source equally inspectable.

Do not copy authoring-only metadata into runtime modules. It belongs in item manifests and generated documentation. Do not add ARIA descriptions or live-region output for the benefit of models; ARIA remains for human assistive technology.

Registry metadata does not duplicate the complete TypeScript prop declaration and does not replace tests. It documents purpose, valid state, effect, semantics, and selection guidance—the information types alone cannot express. Add a drift check for metadata state names and public discriminants rather than attempting a large custom documentation compiler initially.

## Design dials and authoring loop

Dials belong in the lab first, never in the installed component graph. Extract them only if another authoring environment later needs the same controls.

The first dial system needs only:

- typed number, boolean, enum, token/color, and group declarations;
- an external immutable store;
- Base UI React form controls;
- stable fixture and panel IDs;
- reset and optional versioned local persistence; and
- deterministic JSON/source-patch export.

Finite values select precompiled StyleX variants. Continuous preview values cross a narrow dynamic/custom-property boundary. A person or agent reviews and commits the exported value; the dial store does not become production theme state.

## Build and distribution

### Initial registry format

Build an intentionally small first-party format:

- a compact searchable catalog without embedded source;
- immutable per-version item artifacts containing manifests and source files;
- logical file targets such as `foundation`, `primitive`, `component`, and `block`, mapped by consumer configuration;
- distinct `packageDependencies` and `itemDependencies`;
- compatibility requirements for React, Base UI, StyleX, compiler, and project adapter; and
- a content digest over each generated artifact.

The registry build validates schemas and references, detects dependency cycles, topologically orders dependencies, embeds declared source, strips source from the search catalog, and writes generated artifacts under `dist/registry`. Published item versions are immutable; corrections require a new version.

The authoring repository and lab may use source aliases, but generated artifacts must stand alone. The consumer installer maps logical imports and targets according to one explicit project configuration rather than relying on globally meaningful magic paths.

### Installation receipts and safe updates

Every successful apply writes a receipt containing:

- item ID, installed version, registry origin, and immutable artifact digest;
- resolved dependency versions;
- source file to local target mappings;
- transformed baseline hashes; and
- a fingerprint of the project mapping/compiler configuration used for installation.

An update fetches both the locked artifact and the requested new artifact, verifies their digests, reproduces the installed baseline, and plans each file as follows:

1. unchanged locally → replace with new upstream;
2. changed only locally → carry the local edit through a three-way merge;
3. changed locally and upstream without overlap → merge and show the result;
4. overlapping changes or changed project mapping → leave the file untouched and report a conflict.

The plan includes dependency and config effects, unified diffs, conflicts, and expected current hashes. Applying is atomic where possible and aborts if any expected hash changed after review. The receipt advances only after writes and verification succeed. If the previous immutable artifact is unavailable, the tool may show a two-way diff but must not claim a safe automatic update.

Textual three-way merge is sufficient for the first version. Add AST-aware TypeScript merging or codemods only after real conflicts show that text merging is inadequate.

### StyleX installation contract

Copied components require a compatible StyleX extraction pipeline. The StyleX foundation item and project adapter should:

- declare compatible React, Base UI, StyleX, and compiler dependencies;
- copy `.stylex.ts` token modules without changing their identity;
- copy any safe shared configuration file that does not overwrite application-owned config;
- report exact Vite/Next plugin edits through the installation plan; and
- fail validation when the installed component remains uncompiled.

`@stylexjs/atoms` may be installed with the matching StyleX version for one-off local declarations. Component styles should remain named `stylex.create()` groups because atoms do not provide variants, themes, responsive recipes, selectors, or semantic intent.

### Consumer compatibility fixtures

Test real registry installation into clean consumers:

1. Build the registry and validate every generated item.
2. Run the first-party CLI and MCP plan against a clean Vite React fixture and assert equivalent structured changes.
3. Install tokens, theme, one primitive, and one AI component through source-item dependencies.
4. Typecheck and production-build the copied source.
5. Assert StyleX extraction, token/theme identity, and no runtime rule injection.
6. Re-run installation and verify identical files skip.
7. Update untouched and locally customized files; verify clean three-way merges and conflict preservation.
8. Change a file between plan and apply; verify expected-hash rejection.
9. Reject path traversal, dependency cycles, digest mismatches, unresolved targets, and unsafe package arguments.
10. Add a Next.js fixture only after the Vite path works; verify RSC/client boundaries there.

StyleX’s official Vite plugin must run before the React plugin. Registry success means copied files compile in the destination—not merely that the authoring lab builds.

## Testing and quality gates

### Per change

- TypeScript strict mode and public type tests.
- first-party item schema, machine contract, dependency graph, digest, and reference validation.
- registry-core plan/apply/update tests shared by CLI and MCP transport contract tests.
- Pure transition tests for any core reducer.
- Vitest Browser Mode with the Playwright provider for component interaction.
- Computed role/name/state, keyboard, focus, IME, and reduced-motion tests.
- Automated axe checks as a floor, never a conformance claim.
- Production StyleX extraction for both the lab and a clean installed fixture.

Vitest recommends browser mode for component tests because it exercises real DOM, CSS, focus, and browser APIs. Simulated DOM tests may remain for pure logic but should not be the evidence for interaction behavior.

Sources: [Vitest Browser Mode](https://vitest.dev/guide/browser/), [Vitest component testing](https://vitest.dev/guide/browser/component-testing), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

### Per affected visual component

- deterministic state-matrix screenshots in light and dark themes;
- narrow mobile and representative desktop widths;
- 200% text, 400% zoom/reflow, long content, and localization stress;
- forced colors and reduced motion;
- hover, active, focus-visible, disabled, pending, error, and interruption states; and
- inspection of the actual screenshot, not snapshot generation alone.

### Before a stable release

- representative NVDA, VoiceOver, and mobile screen-reader checks;
- clean Vite and Next.js CLI/MCP installations and builds;
- API, registry metadata, and copied-file breaking-change review;
- generated registry artifact inspection;
- receipt and three-way update behavior against a customized consumer; and
- integrity and deployment verification when registry hosting begins.

## First vertical slice

Build the smallest set that exercises the full contract:

### Foundation items

- message role and status;
- response/run status;
- tool activity states;
- permission request and resolution;
- agent capabilities; and
- fixture event/snapshot types;
- React/StyleX dependencies and Vite setup requirements; and
- copied semantic tokens and themes.

### Tokens and themes

- typography, spacing, radius, motion, and focus foundations;
- canvas, surface, text, border, accent, danger, selection, code, and diff roles;
- reviewed light, dark, and high-contrast themes; and
- one nested-surface theme example.

### Accessible primitives

- Base UI-backed `Button` with an owned StyleX style and machine contract;
- `IconButton` only when the action has a necessary icon-only use;
- `ComposerField` composed through Base UI Field’s React API;
- Base UI Collapsible-backed `Disclosure`;
- `Status`; and
- `VisuallyHidden`.

### AI components

- `Thread`;
- `Message` and plain-text `Response`;
- `ToolActivity` and disclosed evidence;
- `PermissionRequest`;
- `Composer` with send and cancel states; and
- `Outcome`.

Do not add Markdown, syntax highlighting, model selection, attachments, dialogs, menus, diff parsing, or artifact previews to this slice. Use explicit slots where those capabilities can attach later.

### Fixture sequences

1. text response: starting → streaming → completed;
2. tool success with bounded evidence;
3. tool failure with retry action;
4. permission request → allow once → running → success;
5. permission rejection;
6. cancellation while streaming;
7. recovery/reconnect notice;
8. long transcript, long command, narrow viewport, and malformed content.

### Exit criteria

The slice is complete only when:

- every fixture is usable with keyboard and touch;
- live announcements are coarse rather than token-by-token;
- all state is controlled outside the components;
- light, dark, high-contrast, reduced-motion, mobile, and desktop states are reviewed;
- the lab and a clean first-party-installed Vite fixture extract StyleX correctly;
- CLI and MCP produce equivalent install/update plans;
- an untouched update applies, a customized update merges, and a conflicting update preserves the local file;
- item manifests generate valid docs/catalog output; and
- an fx ACP adapter can map captured events into the contracts without changing component props.

## Sequencing

```diagram
1. item schema + registry core + clean install fixture
              │
              ▼
2. contracts + tokens + themes
              │
              ▼
3. StyleX-first primitives + deterministic lab
              │
              ▼
4. CLI/MCP install receipt + safe update
              │
              ▼
5. AI vertical slice + browser state matrix
              │
              ▼
6. fx ACP adapter + thin client
              │
              ▼
7. dials + generated manifests/docs
              │
              ▼
8. registry beta; add components only from real use
```

The adapter comes after deterministic fixtures and delivery tooling so transport debugging does not become visual-system or installer debugging. The public beta comes after clean CLI/MCP install and customized-update tests so the registry and StyleX compiler contracts are proven rather than documented as guesses.

## Decisions intentionally deferred

- final package and npm scope names;
- a full headless runtime or external store API;
- Tauri, Electron, or hosted sandbox topology for the client;
- React 18 compatibility;
- an npm component package or compiled JS/CSS distribution;
- rich Markdown/code/diff renderer choices;
- arbitrary runtime themes;
- animation timelines and spring editors;
- provider-specific component packages; and
- broad primitives that the vertical slice does not need.

These decisions should be pulled forward only by a concrete consumer or a failed vertical-slice assumption.
