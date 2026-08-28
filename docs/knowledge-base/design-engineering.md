# Design-engineering research

## The named references

### Linear: Styling Linear for the future with StyleX

URL: https://linear.app/now/styling-linear-for-the-future-stylex

**Observed:** Linear migrated its React applications from styled-components to StyleX through more than 1,000 PRs. Its non-negotiables were build-time style generation, deliberately difficult styling at a distance, explicit component styling contracts, deterministic merging, React fit, active maintenance, co-location, a small API, and pragmatic escape hatches.

Linear’s process is as important as its chosen library:

- define variables, constants, and primitives before broad migration;
- begin with leaf components;
- give agents narrow scope, examples, deterministic transforms, validation scripts, and checklists;
- enforce component styling propagation, precedence, tokens, theme safety, and interaction consistency in tooling; and
- retain scoped CSS Modules for genuinely global or third-party-DOM problems.

**Use here:** establish the styling contract and checks before generating a broad catalog. Do not assume choosing StyleX creates discipline by itself.

### AICSS

URLs: https://www.aicss.dev/ and https://github.com/kvnkld/aicss

**Observed:** AICSS Beta V1.2 catalogs components for thinking/reasoning, tool/action states, text output, structured output, and rich interaction. It offers npm subpath imports, shadcn registry URLs, and a copy-source CLI for React, Vue, and Svelte. Its public React package uses CSS Modules, not StyleX.

The catalog is a useful early taxonomy:

- thinking state and revealed reasoning;
- tool calls such as file diffs and image generation;
- streaming prose, code, and citations;
- plans/tasks and tables; and
- composers and approval cards.

The public source also exposes important pitfalls:

- several components embed demo data, timers, and state transitions rather than accepting controlled product data;
- every component is marked `'use client'`, including static wrappers;
- theming is repeated through component-prefixed global variables instead of one semantic token contract;
- the data table uses `div` elements rather than table semantics;
- the composer owns substantial `contentEditable`, selection, `innerHTML`, model, skill, and attachment logic behind a very narrow public API;
- the approval card auto-approves a plan after 30 seconds by default; and
- CI currently type-checks but exposes no public interaction, visual, or accessibility tests.

**Use here:** borrow the domain taxonomy, per-component imports, small dependency goal, and package-versus-copy-source distinction. Do not inherit demo logic, timed consequential actions, raw TypeScript publication, global theme duplication, or undocumented registry contracts.

### Interfaces

URL: https://interfaces.dev/

**Observed:** Jakub Krehel describes interface quality as the accumulation of many small choices. The platform teaches through interactive demonstrations, source, and agent skills. Public issues cover text wrapping, concentric radii, contextual icon animation, interruptible motion, subtle exits, optical alignment, typography, shadows, image outlines, OKLCH, and gradients.

Its most useful product lesson is the teaching medium: expose the decision and let a reader manipulate it. A static prose rule is less transferable than a comparison, a control, the resulting values, and source.

**Use here:** every visual policy should eventually have a representative before/after or state matrix. Important continuous decisions should be inspectable through a bounded playground.

### AI for Designers and Engineers (AI for UI)

URL: https://aiforui.dev/

**Observed:** Emil Kowalski’s course positions AI as a tool that amplifies taste. The public curriculum focuses on encoding taste in rules and skills, prototyping, knowing what to delegate, reviewing output, and refining it. Its Lapse tool records and scrubs animation so a human can give an agent exact timing/state evidence.

The page explicitly warns that design engineering is often deciding what not to do. That is a useful counterweight to model-generated gradients, cards, icons, labels, and motion.

**Use here:** build review and feedback into the system. A component is not “finished” because a generated screenshot looks plausible. Store state fixtures, exact values, expected semantics, and interaction evidence.

### Interface Craft

URLs: https://www.interfacecraft.dev/ and https://joshpuckett.me/dialkit

**Observed:** Josh Puckett’s library combines principles, walkthroughs, AI collaboration, methods, and custom tools. Its framing is patient refinement and uncommon care rather than fast functional output.

DialKit is the most directly reusable artifact. A typed nested configuration defines defaults, inferred control metadata, and returned values. A framework-neutral external store holds flattened paths, snapshots, persistence, and presets; framework adapters expose reactive values; one registry-driven root renders controls. Copy/export produces JSON plus instructions for committing tuned values back into source.

DialKit also demonstrates scope risk: it includes multiple framework adapters, custom controls, shortcuts, persistence, presets, spring/easing editors, and a complete animation timeline. Its public implementation has accessibility gaps in custom folders, selects, preset rows, and color interactions.

**Use here:** copy the schema → metadata → external store → typed values shape. Start with native form controls and a tiny control taxonomy. Defer timelines and framework adapters.

## Adjacent primary guidance

### Vercel AI SDK: generative UI

URL: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces

The model receives typed tools; a tool call moves through input, output, and error states; application code renders a corresponding React component. This is a strong default for bounded generation because the model selects behavior while the product owns implementation.

### Google People + AI Guidebook

URL: https://pair.withgoogle.com/chapter/feedback-controls/

The feedback and control guidance emphasizes:

- explain what feedback is collected and how it affects the system;
- align explicit feedback options with changes the model can actually make;
- communicate the scope and time-to-impact of feedback;
- balance automation with control; and
- allow users to adapt, edit, opt out, reset, or use a manual fallback.

For an agent client, “manual fallback” includes opening the official Amp thread, reviewing files in an editor, stopping work, or continuing through the official client.

### Microsoft human–AI guidelines

URL: https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/

The published framework groups interaction guidance around initial use, normal operation, failure, and adaptation over time. Its enduring contribution is temporal: an AI interface needs different behavior before the system acts, while it acts, when it is wrong, and as it learns.

## Converged method

The sources broadly converge on this loop:

```diagram
┌──────────────┐   define intent   ┌────────────────┐
│ Human taste  │──────────────────▶│ Rules/examples │
└──────────────┘                   └───────┬────────┘
       ▲                                  │ constrain
       │ judge                            ▼
┌──────┴───────┐   inspect evidence  ┌──────────────┐
│ Review       │◀────────────────────│ Agent output │
└──────┬───────┘                     └──────┬───────┘
       │ exact feedback                     │ render
       ▼                                    ▼
┌──────────────┐   tune in context   ┌──────────────┐
│ Values/patch │◀────────────────────│ Playground   │
└──────────────┘                     └──────────────┘
```

The component library should support this loop directly. Documentation is not ancillary marketing; manifests, fixtures, controls, and review checks are part of the product.

## What “ultraminimal” and “stunning” should mean

These words are easy to turn into decoration. The research supports a more operational definition.

### Ultraminimal

- one primary action per state;
- low-chrome structure with strong alignment and spacing;
- information grouped by consequence, not by every event;
- progressive disclosure for raw logs and tool inputs;
- no decorative badges, eyebrows, section labels, or icons without a job;
- no duplicate status across transcript, header, card, and toast; and
- no animation used merely to prove that the interface is active.

### Stunning

- coherent typography and optical alignment;
- surfaces that remain legible without card-inside-card framing;
- exact hover, press, focus, loading, interruption, exit, and reduced-motion behavior;
- stable layout during streaming and loading;
- clear hierarchy at both desktop and narrow mobile widths;
- details that reward use without competing with the work; and
- a sense of control over a powerful system.

**Hypothesis:** for a daily coding client, trust, speed, and calm will feel more beautiful over time than novelty, mascot animation, glass effects, or constant motion.

## Design principles derived from the research

1. **Every visible element must earn its space.** Decoration is not the default remedy for weak hierarchy.
2. **Use whitespace to separate phases; use surfaces only when containment has meaning.**
3. **Keep the transcript readable as prose.** Tool activity should not repeatedly break reading measure.
4. **Group low-consequence successful operations; isolate errors, approvals, and outcomes.**
5. **Make animation interruptible and state-preserving.** Stop, steer, resize, or navigate without waiting for a transition.
6. **Prefer subtle exits to theatrical entrances.** The user’s intent, not component chrome, should arrive first.
7. **Use familiar controls for consequential decisions.** Novel visuals are not a substitute for clear labels and effects.
8. **Show model/system uncertainty where it changes a decision.** Do not decorate every answer with generic uncertainty copy.
9. **Keep generated output editable and inspectable.** People resist automation most where preferences and stakes are hard to communicate.
10. **Use real data and edge states in design review.** Empty, long, interrupted, failed, narrow, zoomed, and reduced-motion states are first-class.

## Anti-patterns to prevent in code and review

- card grids as the default page structure;
- nested bordered containers for every tool event;
- a permanent left rail, right rail, top bar, and status bar before their information value is proven;
- animated “thinking” states that expose no useful progress;
- auto-approving a command or plan because a timer elapsed;
- fake send, upload, download, model, or tool controls in a production component;
- hardcoded product catalogs or demo text in library components;
- unrestricted `className`, arbitrary generated JSX, or runtime CSS callbacks as customization systems;
- hiding logs without preserving an inspector/evidence path;
- using chat prose for a choice that should be a button, radio group, editor, or diff;
- requiring a user to understand an agent’s chain of thought rather than showing actions and outcomes; and
- treating a polished default screenshot as sufficient component validation.

## Research limitations

- Much of Interfaces, AI for UI, and Interface Craft is paid. This synthesis uses their public positioning, public examples, and related open-source artifacts; it does not claim access to gated lessons.
- AICSS was only days old at the snapshot date. Its current source is useful for taxonomy and critique but cannot establish long-term API or maintenance quality.
- Company performance reports and product demos are contextual evidence, not controlled cross-product comparisons.
- “Tech Twitter convergence” was not treated as proof. The case for StyleX here rests on its documented behavior and the project’s constraints.
