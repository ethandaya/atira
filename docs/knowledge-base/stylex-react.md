# StyleX and React foundation

Snapshot: StyleX **0.19.0** and React **19.2.7** are the current documented releases as of August 28, 2026.

## Why StyleX fits this project

StyleX’s official principles are co-location, deterministic resolution, low-cost abstractions, a small API, typed styles, encapsulation, readability over terseness, composability, and minimal global configuration. Those are general engineering properties, not AI features. They become especially valuable in an agent-authored codebase because they reduce the number of plausible ways to express or override the same intent.

Linear’s migration provides useful production evidence. After more than 1,000 PRs, Linear reports clearer component boundaries and no runtime rule injection during navigation. Its isolated profiling attributed roughly 20–35% less main-thread CPU work on view-heavy pages to removing style generation and injection, translating to about 30% faster performance on a mid-tier machine in its tests. This is a company-specific result, not a universal benchmark.

The more durable lesson is architectural:

- `styled(Button)` and broad `className`/`style` surfaces allowed components to be reopened from outside;
- CSS specificity and source order made composition fragile;
- agents performed better when the valid styling path was narrow, checked, and illustrated; and
- visual validation remained necessary even after deterministic transforms.

Sources: [StyleX principles](https://stylexjs.com/docs/learn/thinking-in-stylex/), [Linear migration](https://linear.app/now/styling-linear-for-the-future-stylex).

## What StyleX guarantees—and what it does not

| Observed StyleX behavior | Project implication |
| --- | --- |
| `stylex.create()` compiles analyzable style objects to atomic CSS | Owned styles should remain statically analyzable; arbitrary style-generating callbacks are outside the contract |
| `stylex.props()` merges style references with deterministic application order | Variant and consumer-style precedence can be deliberate and testable |
| Local `create`/`props` calls can compile away; cross-file style props retain a small merge runtime | “No runtime CSS generation” is accurate; “zero runtime” is not universally accurate |
| Styles and style props are typed | Components can allow only named CSS properties or exclude structural properties |
| `defineVars()` generates typed, unique custom-property references | Tokens can cross packages without raw CSS-variable strings |
| `createTheme()` scopes overrides to an element subtree | Theme composition can follow component boundaries rather than global selectors |
| Selector and value syntax is compiler-constrained | Global selectors, third-party DOM, and highly dynamic CSS still need an explicit fallback |
| The production path requires a compiler plus CSS collection | Compiler/extraction compatibility is part of the library’s package ABI |

StyleX does not provide:

- a design system or good token names;
- accessible component behavior;
- visual regression detection;
- safe arbitrary generated UI;
- a complete theme generator;
- automatic package compatibility across every bundler; or
- correctness when local conventions apply `stylex.props`, JSX spreads, shorthands, or caller overrides in the wrong order.

## Authoring rules

**Proposal:** start with the following rules and turn them into lint/type checks as code appears.

1. Keep styles in the component file unless the file is a StyleX variable module.
2. Name styles by role or state (`root`, `label`, `selected`), not appearance (`blue`, `rounded12`).
3. Use semantic component props for supported variation; do not use style props as a variant system.
4. Apply base styles first, variants and state next, documented caller styles last.
5. If a local property must remain authoritative, put it in a protected slot or apply that protected style last and document why.
6. Do not expose unrestricted `className` and `style` on owned components by default.
7. Do not spread arbitrary props after `stylex.props()` where they could replace generated `className` or dynamic `style`.
8. Avoid shorthand/longhand mixtures in conditional styles until their merge behavior is explicit and tested.
9. Use StyleX variables rather than raw `var(--name)` for public tokens.
10. Keep CSS Modules as an explicit, scoped exception for global selectors or third-party DOM—not a parallel default system.

## Styling contracts

StyleX exposes `StyleXStyles<T>` and `StyleXStylesWithout<T>`. The first can constrain accepted properties and values; the second can prohibit ownership-sensitive properties.

**Proposal:** use three levels of customization:

1. **Semantic props** for intended product variation:

   ```ts
   type ButtonProps = {
     size?: 'compact' | 'regular'
     tone?: 'neutral' | 'accent' | 'danger'
     emphasis?: 'quiet' | 'solid'
   }
   ```

2. **Named slots** for composition where anatomy genuinely varies:

   ```ts
   type ToolActivityProps = {
     icon?: React.ReactNode
     summary: React.ReactNode
     details?: React.ReactNode
   }
   ```

3. **Constrained StyleX styles** for exceptional local composition:

   ```ts
   type SurfaceStyle = StyleXStyles<{
     backgroundColor?: string
     borderColor?: string
     color?: string
   }>
   ```

Avoid `sx` as a universal escape hatch. StyleX makes a typed escape hatch possible; it does not make one desirable on every component.

### Ownership rule

- The parent owns layout between siblings.
- The component owns layout among its internal parts.
- A consumer may change presentation through public variants, theme variables, documented slots, and explicitly accepted style properties.
- Structural changes require composition or a lower-level primitive, not reaching into descendants.

## Token and theme model

The StyleX theme APIs are modeled after React Context: `defineVars()` defines defaults, and `createTheme()` provides overrides for a subtree. Variable modules currently require `unstable_moduleResolution`, named direct exports, a `.stylex.*` filename, and no unrelated exports.

**Proposal:** organize tokens by semantic responsibility rather than one giant object:

```diagram
┌────────────────────────────────────────────────┐
│ Foundations                                    │
│ OKLCH ramps · spacing steps · type metrics     │
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ Semantic roles                                 │
│ canvas · surface · text · border · focus       │
│ accent · danger · selection · code · diff      │
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ Component contracts                            │
│ composer surface · tool success · approval     │
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ Scoped themes                                  │
│ light · dark · high contrast · nested surfaces │
└────────────────────────────────────────────────┘
```

Component code should normally consume semantic roles, not raw tonal steps. Foundations exist to generate and audit roles; they should not encourage arbitrary palette use inside components.

### Theme inputs versus generated roles

Linear generates more than 100 theme variables from a small set of LCH inputs and can re-derive nested theme surfaces. It implements a custom provider that uses StyleX’s generated custom-property names but injects runtime theme rules because its model does not map cleanly to built-in static themes.

That is evidence that sophisticated generation is possible, not evidence that it belongs in this project’s first version.

**Proposal:**

1. Begin with reviewed static light, dark, and high-contrast themes using `defineVars()` and `createTheme()`.
2. Build the derivation function as a pure authoring tool that outputs committed theme values.
3. Let dials preview base, accent, contrast, density, radius, and type decisions.
4. Export the tuned values to source.
5. Add runtime arbitrary theme generation only if a real consumer requires user-created themes.

This keeps StyleX extraction and theme behavior simple while preserving the “dial in” workflow.

## Dials with static extraction

Finite dial values should choose precompiled StyleX variants. Continuous values should feed a narrow CSS custom-property or supported StyleX dynamic-value boundary.

```ts
const preview = useDesignDials('Composer', {
  density: { type: 'select', options: ['compact', 'regular'] },
  radius: [12, 0, 24, 1],
})

const props = stylex.props(
  styles.root,
  densityStyles[preview.density],
  styles.previewRadius(preview.radius),
)
```

Do not create runtime utility styles from every dial value. The point is to tune a bounded system, then commit the result.

## Production build and distribution boundary

Official StyleX installation requires the runtime and a compiler/extraction pipeline. The PostCSS integration explicitly says its include set should cover npm dependencies that use StyleX. This makes package distribution a design decision, not an afterthought.

There are three valid publication models:

### Consumer compiles library source

**Advantages:** maximal tree shaking, StyleX-native composition, simple library build.

**Costs:** consumers must transpile the package and include it in StyleX extraction; compiler-version differences can break installation.

### Library publishes compiled JS and extracted CSS

**Advantages:** less compiler work for consumers and clearer artifacts.

**Costs:** CSS ordering/layers and deduplication across host/library builds need a tested contract; style-prop composition may retain runtime metadata.

### Registry copies source into the consumer

**Advantages:** the consumer owns ordinary local React/StyleX code, the destination compiler performs one extraction pass, cross-file token identity stays local, and coding agents can inspect and modify the implementation directly.

**Costs:** installation must configure a compatible StyleX compiler; the project must own registry, receipt, and update tooling; and source updates require reviewed merges rather than package replacement.

StyleX’s own repository exercises source distribution through `@stylexjs/shared-ui`, including cross-package variables and consumer-provided StyleX styles. The current Vite plugin can discover installed dependencies that declare a StyleX peer. That makes source publication an evidence-backed starting point, not a guarantee that every consumer toolchain works automatically.

**Proposal:**

1. make an owned, StyleX-native source registry the primary distribution boundary, borrowing the catalog/dependency/install pattern rather than shadcn’s schema;
2. copy React components, `.stylex.ts` variables, themes, and neutral contracts into the consumer;
3. install React, Base UI, StyleX, and compiler packages as registry-declared npm dependencies;
4. prove first-party CLI/MCP install, receipt, diff, three-way update, Vite extraction, themes, types, and then Next.js/RSC behavior in clean fixtures; and
5. offer an npm or compiled JS/CSS package only when a demonstrated consumer requires it.

Source distribution deliberately makes the consumer compiler part of the installation contract. Do not claim one-command support for a toolchain until its clean registry fixture passes.

Sources: [StyleX installation](https://stylexjs.com/docs/learn/installation/), [StyleX shared UI package](https://github.com/facebook/stylex/blob/main/packages/shared-ui/package.json), [official Vite integration](https://stylexjs.com/docs/learn/installation/vite/), [shadcn custom registries](https://ui.shadcn.com/docs/registry), [shadcn MCP](https://ui.shadcn.com/docs/mcp), [AICSS package source](https://github.com/kvnkld/aicss/tree/main/packages/react).

## React baseline

React’s current docs target 19.2. Relevant stable features include:

- ref as a normal prop for function components;
- callback-ref cleanup;
- function-valued form actions, `useActionState`, `useOptimistic`, and `useFormStatus`;
- `use` for Context and compatible promises;
- stylesheet precedence and Suspense integration;
- Server Components and Server Functions for application use; and
- React 19.2’s `<Activity>`, `useEffectEvent`, performance tracks, and prerender/resume APIs.

Framework/bundler APIs underlying React Server Components do not carry normal semver stability. Canary is supported when pinned and is useful as a CI warning lane, not as an unpinned production dependency.

**Proposal for the research-stage project:**

- target React 19.2 rather than carrying React 18 compatibility code;
- declare and pin compatible React, Base UI, and StyleX runtime/compiler ranges in item dependencies and installation fixtures;
- keep render-only components server-compatible;
- add `'use client'` only to entry points that actually require events, state, effects, or browser APIs;
- do not put `'use client'` on a root barrel;
- test oldest supported stable, current stable, and a scheduled pinned Canary once consumers exist.

Sources: [React versions](https://react.dev/versions), [React 19](https://react.dev/blog/2024/12/05/react-19), [React 19.2](https://react.dev/blog/2025/10/01/react-19-2), [React versioning policy](https://react.dev/community/versioning-policy).

## Known risks

1. StyleX is still pre-1.0; compiler/configuration details may move.
2. The stable theming API still depends on an option named `unstable_moduleResolution`.
3. Imported-package compilation differs across build integrations.
4. StyleX’s TypeScript contracts cannot reject every truly unknown property key.
5. Host and library assumptions about CSS layers and StyleX resolution mode can conflict.
6. Excessive dynamic values can recreate a difficult-to-reason-about runtime styling system.
7. Static constraints do not catch responsive, theme, interaction, or visual mistakes.
8. Supporting both React 18 and 19 would complicate refs, Context syntax, actions, and package testing; do not accept that cost without a consumer need.

## Validation required before implementation expands

- One extracted-CSS production build with no runtime style injection.
- SSR and hydration with stable class names and theme variables.
- Cross-file style-prop precedence tests.
- Light, dark, high-contrast, nested theme, and portal theme examples.
- Package fixture importing individual subpaths.
- Verification that render-only exports do not pull client boundaries into RSC graphs.
- Visual state matrices for hover, active, focus, disabled, selected, loading, error, reduced motion, and forced colors.
