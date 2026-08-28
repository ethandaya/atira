# Human and machine accessibility

## Status of the guidance

- **Normative:** WCAG 2.2, WAI-ARIA, and HTML requirements that affect conformance.
- **Authoritative guidance:** WAI-ARIA Authoring Practices and official React documentation.
- **Project policy:** stricter defaults derived from those sources for AI/agent interaction.
- **Heuristic:** machine/LLM legibility practices. There is no recognized “LLM accessibility” standard.

## Human accessibility baseline

**Requirement:** target WCAG 2.2 Level AA for every rendered state and responsive variation. Components alone cannot claim page conformance, but the library must not prevent it.

Key AA requirements for this system include:

| Area | Requirement |
| --- | --- |
| Semantics | Relationships and reading order are programmatically determinable (1.3.1, 1.3.2) |
| Keyboard | All functionality works from a keyboard with no trap (2.1.1, 2.1.2) |
| Character shortcuts | Disable, remap, or scope unmodified character shortcuts to focused components (2.1.4) |
| Focus | Logical order, visible focus, and no fully obscured focused controls (2.4.3, 2.4.7, 2.4.11) |
| Text contrast | 4.5:1, or 3:1 for large text (1.4.3) |
| UI contrast | Required control boundaries, states, and graphics reach 3:1 (1.4.11) |
| Zoom/reflow | Text at 200%; layout at 320 CSS px equivalent without unnecessary two-dimensional scrolling (1.4.4, 1.4.10) |
| Text spacing | User spacing overrides do not lose content or function (1.4.12) |
| Target size | 24 × 24 CSS px minimum or a documented exception (2.5.8) |
| Pointer | Single-pointer alternatives for multipoint/path gestures and dragging (2.5.1, 2.5.7) |
| Labels | Accessible names contain visible labels; labels describe purpose (2.5.3, 2.4.6) |
| Forms | Labels, error identification, suggestions, and review/reversal for consequential submission (3.3.1–3.3.4) |
| Dynamic status | Status messages are exposed without moving focus (4.1.3) |
| Components | Name, role, value/state, and changes are programmatically exposed (4.1.2) |

Source: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

**Project policy:** use 44 × 44 CSS px hit areas where layout permits, and a focus indicator visually equivalent to a 2 px perimeter with at least 3:1 state-change contrast. These align with enhanced WCAG criteria even though the project baseline is AA.

## Base UI React primitives first

Author interactive primitives with Base UI React components and non-interactive structure with React. Verify that the rendered output preserves the correct button, link, form-control, heading, list, table, dialog, progress, and meter semantics.

Those rendered semantics preserve browser behavior that ARIA does not create: keyboard activation, form submission, disabled behavior, autofill, high-contrast rendering, and accessibility mappings.

Rules:

- links navigate; buttons act;
- no clickable `div` or `span` controls;
- placeholder text is not the only label;
- `title` is not the primary accessible name or touch instruction;
- DOM order matches visual and reading order;
- positive `tabindex` is prohibited;
- custom widgets must implement the complete keyboard/focus model, not only a role; and
- generated content may not supply arbitrary ARIA attributes to audited components.

Sources: [HTML Living Standard](https://html.spec.whatwg.org/multipage/), [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), [ARIA APG](https://www.w3.org/WAI/ARIA/apg/).

## Names and descriptions

- Prefer visible text or a native `label`.
- Use `aria-labelledby` when visible content names the control.
- Use `aria-label` mainly for controls with no visible text, such as icon-only buttons.
- Use `aria-describedby` for supplemental instructions and errors, not as a replacement for a name.
- Keep names stable; expose changing state through status text or descriptions.
- Ensure the visible label appears in the accessible name, preferably first, for speech input.
- Test the computed accessible name rather than the mere presence of an attribute.

Source: [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname-1.1/). AccName 1.2 was still a Working Draft at this snapshot and should not be treated as the stable Recommendation.

## Conversation semantics

**Proposal:** use a labelled section containing a chronological list or `role="log"` for a durable transcript. Each message should have a stable identity and programmatic actor label. Use `article` only when each message is independently meaningful enough to warrant it.

Use `role="feed"` only for a virtualized or incrementally loaded article collection that implements the feed interoperability contract. The APG feed pattern requires article positions, set size, focus-preserving loading/removal, `aria-busy`, and documented navigation. Infinite scrolling alone is not a reason to adopt it.

Sources: [WAI-ARIA `log`](https://www.w3.org/TR/wai-aria-1.2/#log), [APG feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/).

## Streaming and live announcements

Token-by-token announcements are hostile to screen-reader use. They interrupt speech, repeat fragments, and make the transcript difficult to navigate.

**Project policy:**

1. Keep the composer focused when generation starts unless the user explicitly navigates away.
2. Expose one coarse state: “Starting,” “Generating response,” “Running tests,” “Waiting for approval,” “Cancelled,” “Failed,” or “Response complete.”
3. Use a stable polite status region for concise transitions.
4. Mark a multi-operation result region `aria-busy="true"` when appropriate and always reset it.
5. Append streamed visual content to durable semantic DOM.
6. Announce completed semantic chunks or completion, not each token.
7. Reserve `alert`/assertive announcements for urgent failures or dangerous state changes.
8. Do not put `aria-live` on the entire transcript.
9. When streamed content is replaced or corrected, expose the coherent final result and announce a concise update.
10. Provide stop/cancel; long-running or continuously updating surfaces also need pause/frequency control where WCAG 2.2.2 applies.

Sources: [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [`role="status"` technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22), [`role="log"` technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23).

## Scroll and focus

- Never move focus to each new message or tool call.
- Auto-follow only while the user is already at the end of the transcript.
- Once the user scrolls upward, preserve that position and expose “Jump to latest.”
- When prepend-loading history, preserve the viewed message and visual offset.
- Dialogs and sheets move focus intentionally, contain it while modal, make the background inert, close on Escape when dismissible, and restore focus to the invoker.
- Sticky headers and composers must not obscure focused transcript controls, including under mobile virtual keyboards.
- Virtualization must preserve focused and assistive-technology-relevant items; do not remove the active item from the DOM.

## Composer and forms

- Use a labelled `textarea` until rich inline tokens prove that a complex editor is necessary.
- Enter/Shift+Enter behavior must be explicit, platform-appropriate, and documented. Users need a non-shortcut send button.
- Preserve drafts through errors, reconnects, reauthentication, route changes, and responsive layout changes.
- Do not disable paste or password managers.
- Associate validation errors and hints programmatically.
- Set `aria-invalid` only after the value is invalid under the chosen validation timing.
- A disabled send button cannot be the only progress signal.
- Prevent duplicate submission while retaining status and cancellation.
- Attachments need name, type, progress, failure, retry, and remove behavior; images need meaningful alternatives where their content matters.

## Tool calls, plans, and approvals

Tool state cannot rely on color or icon alone. Include concise text such as “Running,” “Succeeded,” “Failed,” or “Cancelled.”

For consequential actions:

- state the action, target, effect, and reversibility;
- distinguish approval of one action from creation of a future rule;
- keep reject/cancel visually and programmatically available;
- retain input and context while an approval is pending;
- show submission progress and resulting state;
- provide review, correction, confirmation, or undo where required; and
- never auto-approve a destructive or external action solely because a timer elapsed.

If a timed action exists for a low-risk domain, it must be opt-in, clearly announced, pauseable/cancellable, and compliant with timing requirements. The component library should not own the policy.

## Keyboard command surfaces

- Every command has an ordinary reachable control.
- A shortcut is never the only path.
- Global printable-character shortcuts are off by default.
- Do not intercept browser, operating-system, or assistive-technology commands.
- Ignore global shortcuts during text editing and IME composition unless the focused editor defines them.
- Show shortcuts in the UI and provide searchable help once the set becomes nontrivial.
- Escape closes the topmost dismissible layer and restores focus.
- A command palette is normally a labelled dialog with a combobox/listbox model, not a generic menu containing arbitrary forms.

## Touch, zoom, and motion

- Default touch targets to 44 × 44 CSS px through layout or invisible hit-area padding.
- Never make hover, long press, drag, swipe, or precision movement the only route.
- Hover content must also work with focus and be dismissible, hoverable, and persistent as required.
- Test at 200% text size, 400% browser zoom, and 320 CSS px equivalent width.
- Support portrait and landscape unless orientation is essential.
- Respect `prefers-reduced-motion: reduce`.
- Remove large translation, zoom, parallax, continuous thinking animation, and spatial reordering when motion is reduced.
- Preserve state feedback through instantaneous change, restrained opacity, or text.
- Animations must be interruptible; UI state cannot depend on `animationend` firing.

## React implementation policies

- Use `useId` for label/description/error relationships, never for list keys.
- Keep server/client trees stable so ID references survive hydration.
- Use distinct, matching `identifierPrefix` values for multiple roots.
- Forward refs and valid semantic props deliberately.
- Do not add wrappers that break list, table, heading, or form relationships.
- Portals preserve React ancestry, not visual focus behavior; implement modal focus explicitly.
- Suspense fallbacks must remain semantically valid and avoid repeated live announcements.
- Focus changes happen in events/effects, never during render.
- Treat hydration errors as accessibility failures because replacement DOM can reset focus and break ID references.

Sources: [`useId`](https://react.dev/reference/react/useId), [`createPortal`](https://react.dev/reference/react-dom/createPortal), [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot).

## Machine/LLM legibility

There is no WCAG criterion, ARIA role, HTML conformance class, or React API for “LLM accessibility.” Semantic HTML is designed for browsers and accessibility APIs. It may also help machine extraction, but that benefit should be tested rather than promised.

**Engineering heuristics:**

1. Render meaningful server-visible HTML rather than canvas-only or opaque client surfaces.
2. Preserve explicit headings, lists, tables, labels, links, statuses, and DOM order.
3. Separate durable machine IDs from localized display labels.
4. Define component state with discriminated unions and events with typed payloads.
5. Publish JSON Schema/OpenAPI where data crosses a process or protocol boundary.
6. Document purpose, non-purpose, anatomy, state machine, keyboard model, side effects, and examples.
7. Use stable URLs and versioned documentation.
8. Prefer complete parsable examples over screenshots of code.
9. Give agent tools unique names, explicit argument schemas, side effects, idempotency, and representative errors.
10. Provide a machine-readable component catalog as an additive interface, never as a replacement for accessible rendered HTML.
11. Give each installable item a versioned manifest covering selection, anatomy, states, actions, effects, dependencies, compatibility, examples, and non-examples.
12. Expose registry search, item inspection, and structured install/update plans through MCP so an agent does not need to infer shell commands or file targets.
13. Keep stable `data-slot` and `data-state` markers where inspection genuinely benefits, without treating them as a replacement for native semantics.

Claims to avoid:

- “ARIA makes the UI understandable to LLMs.”
- “Screen-reader accessible means agent-safe.”
- “The model can infer the missing label.”
- “A schema makes visible instructions unnecessary.”
- “Generated content is exempt from conformance.”

## Test strategy

### Automated on every change

- type and schema validation;
- valid element/role and state mappings;
- computed accessible names;
- ID-reference integrity and hydration;
- keyboard behavior and focus restoration;
- reduced-motion behavior;
- stream and tool state transitions;
- rejection of unknown generated components/actions; and
- automated accessibility rules as a floor, not a conformance verdict.

### Browser matrix for affected components

- keyboard-only Tab/Shift+Tab and arrow-key behavior;
- 200% text, 400% zoom, and 320 CSS px equivalent width;
- touch targets and non-drag alternatives;
- reduced motion and forced colors;
- sticky header/composer focus visibility;
- streaming start, tool use, stop, failure, retry, and completion;
- scroll-follow opt-out and “Jump to latest”; and
- responsive desktop and mobile states.

### Representative assistive technology before stable releases

- NVDA with Firefox or Chrome on Windows;
- VoiceOver with Safari on macOS and iOS;
- TalkBack with Chrome on Android;
- JAWS with Chrome/Edge where enterprise support requires it; and
- speech control and magnification for critical workflows.

### Adversarial generated-content fixtures

Include skipped headings, unlabeled controls, duplicate IDs, malformed Markdown/HTML, hostile ARIA, nested interactive elements, endless streams, tables without headers, canvas-only output, mixed language, huge labels, dangerous tool effects, and invalid URLs.

## Release-blocking failures

- keyboard-inoperable actions or traps;
- missing computed names;
- focus loss during streaming or layer dismissal;
- token-by-token assertive announcements;
- placeholder-only fields;
- color-only status;
- hidden focus behind app chrome;
- drag/hover-only functionality;
- inaccessible generated structures accepted by the renderer;
- automatic consequential approval by default; or
- a claim of readiness when the affected critical path has not been exercised in a browser.
