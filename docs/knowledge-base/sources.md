# Annotated sources

Accessed August 28, 2026 unless noted. Primary and normative sources are preferred. Product pages describe intent and current behavior; they are not neutral evaluations.

## Styling and React

### StyleX

- [Introduction](https://stylexjs.com/docs/learn) — ahead-of-time atomic CSS and project overview.
- [Thinking in StyleX](https://stylexjs.com/docs/learn/thinking-in-stylex/) — official principles: co-location, deterministic resolution, small API, types, encapsulation, and composability.
- [Defining styles](https://stylexjs.com/docs/learn/styling-ui/defining-styles) — static-analysis and dynamic-style constraints.
- [Using styles](https://stylexjs.com/docs/learn/styling-ui/using-styles) — composition and application behavior.
- [`StyleXStyles<>`](https://stylexjs.com/docs/api/types/StyleXStyles) and [`StyleXStylesWithout<>`](https://stylexjs.com/docs/api/types/StyleXStylesWithout) — typed component styling contracts.
- [Defining variables](https://stylexjs.com/docs/learn/theming/defining-variables) — variable modules, typed custom properties, media queries, and derived values.
- [Creating themes](https://stylexjs.com/docs/learn/theming/creating-themes) — subtree theme application and merge order.
- [Variants recipe](https://stylexjs.com/docs/learn/recipes/variants) — typed variants through ordinary JavaScript lookup/composition.
- [Installation](https://stylexjs.com/docs/learn/installation/) — compiler, PostCSS, bundler, and production CSS requirements.
- [Official Vite integration](https://stylexjs.com/docs/learn/installation/vite/) and [`@stylexjs/unplugin`](https://github.com/facebook/stylex/tree/main/packages/@stylexjs/unplugin) — dependency discovery, plugin ordering, extraction, CSS output, and HMR.
- [`@stylexjs/shared-ui`](https://github.com/facebook/stylex/tree/main/packages/shared-ui) — official source-distributed React package with cross-package StyleX variables and style props.
- [StyleX CLI](https://stylexjs.com/docs/learn/installation/cli/) — precompiled JS/CSS distribution option.
- [`@stylexjs/atoms`](https://stylexjs.com/docs/api/javascript/atoms/) — compiler-recognized one-property style syntax; explicitly not a token, theme, variant, responsive, component, or behavior system.
- [StyleX 0.19.0](https://stylexjs.com/blog/v0.19.0) — current release snapshot and `@stylexjs/atoms`.
- [StyleX repository](https://github.com/facebook/stylex) — public implementation and release history.

### Linear

- [Styling Linear for the future with StyleX](https://linear.app/now/styling-linear-for-the-future-stylex) — August 26, 2026 first-party migration account, enforcement model, generated themes, and company-specific performance result.
- [`styled-components-to-stylex-codemod`](https://github.com/skovhus/styled-components-to-stylex-codemod) — public deterministic migration tooling referenced by Linear.

### React

- [React versions](https://react.dev/versions) — current stable version and release list.
- [React 19](https://react.dev/blog/2024/12/05/react-19) — ref-as-prop, actions, `use`, stylesheet handling, and stable application-level RSC.
- [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) — `<Activity>`, `useEffectEvent`, performance tracks, and server rendering additions.
- [Versioning policy](https://react.dev/community/versioning-policy) — Stable, Canary, and Experimental guarantees; RSC bundler API caveat.
- [`useId`](https://react.dev/reference/react/useId), [`createPortal`](https://react.dev/reference/react-dom/createPortal), and [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) — implementation details that affect component accessibility.

## Named design-engineering references

- [AICSS](https://www.aicss.dev/) — component taxonomy, previews, and distribution options.
- [AICSS public repository](https://github.com/kvnkld/aicss) — React/CSS Module package and source-copy CLI. Public source was inspected for APIs, theming, accessibility, tests, and registry behavior.
- [AICSS Approval Card](https://www.aicss.dev/components/approval-card) — source and behavior of question, command, and timed plan approval variants.
- [AICSS AI Agent Input](https://www.aicss.dev/components/ai-agent-input) — source for composer, `contentEditable`, model/skill menu, attachments, and prompt enhancement.
- [Interfaces](https://interfaces.dev/) — Jakub Krehel’s design-engineering magazine and interactive teaching model.
- [Details that make interfaces feel better](https://interfaces.dev/magazine/issues/details-that-make-interfaces-feel-better) — public issue on text, radii, motion, alignment, shadows, and image treatment.
- [AI for Designers and Engineers](https://aiforui.dev/) — Emil Kowalski’s public course framing, skill taxonomy, taste-encoding workflow, and Lapse description.
- [Interface Craft](https://www.interfacecraft.dev/) — Josh Puckett’s library framing and content model.
- [DialKit site](https://joshpuckett.me/dialkit) and [repository](https://github.com/joshpuckett/dialkit) — typed live controls, external store, persistence, presets, export, framework adapters, and timeline implementation.

Only public material was used. Paid/gated lessons were not treated as inspected evidence.

## AI component-library construction references

- [shadcn custom registries](https://ui.shadcn.com/docs/registry) and [getting started](https://ui.shadcn.com/docs/registry/getting-started) — architectural reference for source-owned distribution, static catalog/item artifacts, and registry builds; not a required format for this project.
- [shadcn `registry-item.json`](https://ui.shadcn.com/docs/registry/registry-item-json) — reference for separating files, npm dependencies, source-item dependencies, targets, docs, and metadata.
- [shadcn `components.json`](https://ui.shadcn.com/docs/components-json) — reference for consumer aliases and namespaced registries, including Tailwind-oriented coupling this project should not inherit.
- [shadcn MCP](https://ui.shadcn.com/docs/mcp) — registry discovery through coding-agent tools; the current implementation primarily returns CLI commands, while this project proposes shared structured plan/apply operations.
- [shadcn resolver](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/registry/resolver.ts), [dry-run planner](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/utils/dry-run.ts), [file updater](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/utils/updaters/update-files.ts), and [MCP implementation](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/mcp/index.ts) — concrete dependency, planning, overwrite, and MCP boundaries; notably no install receipt or three-way customized-source update.
- [shadcn Base UI default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) — current Base UI-first architecture and source-owned migration rationale.
- [Vercel AI Elements](https://github.com/vercel/ai-elements) — source-registry distribution, compound message/tool/reasoning components, browser tests, and current AI SDK type coupling.
- [assistant-ui](https://github.com/assistant-ui/assistant-ui) — normalized message parts, provider adapters, runtime capabilities, external stores, headless React primitives, and separately owned styled UI.
- [assistant-ui message model](https://github.com/assistant-ui/assistant-ui/blob/main/packages/core/src/types/message.ts) — discriminated text, reasoning, source, file, data, tool, and generative-UI parts.
- [assistant-ui message rendering](https://github.com/assistant-ui/assistant-ui/blob/main/packages/core/src/react/primitives/message/MessageParts.tsx) — slot and tool-name mapping without provider-specific rendering code.
- [AI Elements tool component](https://github.com/vercel/ai-elements/blob/main/packages/elements/src/tool.tsx) — useful compound anatomy and an example of provider state leaking into reusable props.
- [AI Elements reasoning tests](https://github.com/vercel/ai-elements/blob/main/packages/elements/__tests__/reasoning.test.tsx) — controlled behavior and streaming/history state tests in Chromium.

## Accessible behavior, packaging, and verification

- [Base UI](https://base-ui.com/react/overview/quick-start) and [composition](https://base-ui.com/react/handbook/composition) — unstyled React 19 primitives, render composition, state attributes, and controlled complex interactions.
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html) — accessible interaction and internationalized collection components; approved as a targeted exception rather than the default dependency.
- [Radix composition](https://www.radix-ui.com/primitives/docs/guides/composition) — mature `asChild` composition reference and compatibility option.
- [Vitest Browser Mode](https://vitest.dev/guide/browser/) and [component testing](https://vitest.dev/guide/browser/component-testing) — real-browser component rendering and interaction through Playwright or WebDriver providers.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) — axe integration and the explicit limitation that automated rules detect only some accessibility problems.
- [Node package exports](https://nodejs.org/api/packages.html) — public subpath encapsulation and conditional export ordering, including the `types` condition.
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) — OIDC publication and automatic provenance for supported public builds.

## Human–AI interaction and generative UI

- [Vercel AI SDK: Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) — typed tool-call-to-React-component mapping and input/output/error states.
- [Google People + AI Guidebook: Feedback + Control](https://pair.withgoogle.com/chapter/feedback-controls/) — feedback meaning, time to impact, automation/control balance, editability, reset, opt-out, and manual fallback.
- [Microsoft Guidelines for Human–AI Interaction](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/) — research-derived guidance across initial interaction, normal use, failure, and adaptation.
- [Microsoft publication](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) — research provenance and validation context.

### Emerging protocols — watch, do not anchor core APIs yet

- [A2UI specification](https://a2ui.org/specification/v1.0-a2ui) — declarative streaming component/data protocol with allowlisted catalogs and accessibility fields; v1.0 was a candidate at this snapshot.
- [AG-UI introduction](https://docs.ag-ui.com/introduction) and [repository](https://github.com/ag-ui-protocol/ag-ui) — open event protocol between agent backends and user-facing clients.
- [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/) and [extension repository](https://github.com/modelcontextprotocol/ext-apps) — interactive MCP-associated web surfaces.

These protocols do not replace HTML, ARIA, WCAG, schema validation, or audited React rendering.

## Accessibility standards and guidance

### Normative

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — W3C Recommendation and conformance requirements.
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) — roles, states, properties, and live-region semantics.
- [HTML Living Standard](https://html.spec.whatwg.org/multipage/) — native semantics, forms, and interaction behavior.
- [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname-1.1/) — current stable Recommendation at the snapshot.
- [HTML Accessibility API Mappings](https://www.w3.org/TR/html-aam-1.0/) — HTML-to-accessibility-platform mappings.

### Authoritative guidance

- [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/) and [Understanding WCAG](https://www.w3.org/WAI/WCAG22/Understanding/) — informative implementation guidance.
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) — patterns and expected keyboard models; examples are guidance, not automatic conformance.
- [Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) — focus/loading contract for dynamic article feeds.
- [Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — modal naming, focus entry, containment, Escape, and restoration.
- [Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — command palette and suggestion-list considerations.
- [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [`role="status"`](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22), and [`role="log"`](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23) — dynamic message announcements without focus movement.
- [`prefers-reduced-motion`](https://drafts.csswg.org/mediaqueries-5/#prefers-reduced-motion) — standardized user preference media feature.

## Amp official sources

- [Amp SDK overview](https://ampcode.com/manual/sdk) — supported automation use cases, execution, streaming, continuation, cancellation, and permissions.
- [TypeScript SDK reference](https://ampcode.com/docs/sdk/typescript) — current APIs and message types, including `execute` and thread helpers.
- [Streaming JSON](https://ampcode.com/manual/cli-streaming-json.md) — JSONL input/output schema, tools, results, images, multi-turn input, and steer.
- [CLI](https://ampcode.com/docs/cli) — supported command-line execution boundary.
- [Threads](https://ampcode.com/docs/markdown/threads) — thread identity, continuation, management, and export.
- [Tools](https://ampcode.com/docs/tools) and [permissions](https://ampcode.com/manual/permissions.md) — default tool behavior and plugin-based policy.
- [Plugin API](https://ampcode.com/docs/plugin-api) — in-host events and thread state; not an external cloud transport.
- [MCP](https://ampcode.com/docs/customize/mcp) — local/remote MCP configuration and approval/auth boundaries.
- [Portals](https://ampcode.com/docs/orbs/portals) — authenticated orb service URLs and access behavior.

## Agent runtime candidates

### fx

- [fx repository](https://github.com/vercel-labs/fx) — experimental Apache-2.0 coding agent and implementation source.
- [Embed fx](https://fx.sh/docs/lib) — native CLI, ACP, `createFxAgent()`, and terminal integration choices.
- [ACP server](https://fx.sh/docs/using-fx/acp) — JSON-RPC transport, supported session methods, streaming updates, permissions, and protocol limits.
- [Node SDK](https://fx.sh/docs/lib/node) — `libfx` backend selection, host callbacks, cancellation, and the embedded agent’s intentionally empty tool set.
- [WebAssembly SDK](https://fx.sh/docs/lib/webassembly) and [browser integration](https://fx.sh/docs/lib/host-integration) — JSPI, persistence, host fetch, constrained workspace execution, and browser capability limits.
- [fx permissions](https://fx.sh/docs/configure-fx/permissions) — ask/auto/yolo modes, persistent rules, and non-persistent session grants.

### Nanocodex

- [Nanocodex repository and README](https://github.com/gakonst/nanocodex) — Rust/JS embedding model, supported OpenAI coding models, turn lifecycle, sessions, and tools.
- [Stability and scope](https://github.com/gakonst/nanocodex/blob/master/web/docs/src/pages/stability.mdx) — supported APIs, explicit non-goals, experimental packages, sandbox responsibility, and CLI stability boundary.
- [Canonical event stream](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-oai-api/src/events/stream.rs) — ordered/versioned event envelope and event categories.
- [Turn control](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-agent/src/agent/turn.rs) — result/stream independence, steering, cancellation, and cleanup.
- [Headless React controller](https://github.com/gakonst/nanocodex/blob/master/js/react/README.md) — presentation-neutral state projection with no markup, CSS, scrolling, or Markdown ownership.
- [Durability](https://github.com/gakonst/nanocodex/blob/master/crates/nanocodex-durability/README.md) — append-only journal, effects, checkpoints, deduplication, and storage adapters.

## Comparable agent-product patterns

These sources informed interaction patterns, not Amp protocol feasibility:

- [Devin Session Tools](https://docs.devin.ai/work-with-devin/devin-session-tools) — unified progress with clickable detailed evidence and takeover surfaces.
- [OpenAI Codex cloud](https://developers.openai.com/codex/cloud) — durable background tasks and review handoff.
- [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent) and [Agent Review](https://cursor.com/docs/agent/agent-review) — in-progress versus ready-for-review and explicit review phase.
- [Claude Code permissions](https://code.claude.com/docs/en/permissions) — visible persistent autonomy posture and scoped policy.

No sufficiently detailed first-party xAI material was found for Grok’s end-user tool/approval/task interface, so Grok was not used as evidence for a specific interaction pattern.

## Evidence cautions

- Linear’s performance numbers are specific to its application and test setup.
- AICSS was very new at the research snapshot; current source does not establish long-term maturity.
- Design-course marketing pages express author intent but do not independently prove outcomes.
- ARIA APG examples are informative and still require browser/assistive-technology testing.
- “LLM accessibility” recommendations are project heuristics, not standards.
- Amp changes quickly. Recheck SDK and stream schemas before implementing protocol-sensitive features, especially approvals, history, and orb control.
