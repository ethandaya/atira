# Consume Atira locally

Atira supports local consumption from packed artifacts or a source export.
Neither workflow publishes to a registry or assigns release metadata.

## Recommended: packed compiled artifacts

Build four ESM tarballs containing declarations and extracted StyleX CSS:

```sh
node scripts/build-library.mjs --pack /absolute/path/to/new/package-directory
# or, for the default ./package-artifacts directory:
pnpm pack:library
```

The destination must not exist. The command precompiles TypeScript, JSX, StyleX
calls, themes, and CSS. Each package manifest exposes only compiled JavaScript,
declarations, `styles.css`, and `package.json`; it marks CSS as a side effect.
The tarballs preserve the foundations, primitives, components, and blocks
boundaries. They do not contain demo code, providers, credentials, tests, source,
or build tooling.

Install all tarballs required by the chosen package. Because internal packages
remain private and do not exist in a registry, pin local overrides in pnpm 11:

```yaml
# pnpm-workspace.yaml in the consuming repository
overrides:
  '@atira/foundations': file:./vendor/atira-foundations-0.0.0.tgz
  '@atira/primitives': file:./vendor/atira-primitives-0.0.0.tgz
  '@atira/components': file:./vendor/atira-components-0.0.0.tgz
  '@atira/blocks': file:./vendor/atira-blocks-0.0.0.tgz
```

Then add the tarballs and the host-owned peers:

```sh
pnpm add ./vendor/atira-foundations-0.0.0.tgz \
  ./vendor/atira-primitives-0.0.0.tgz \
  react@19.2.8 react-dom@19.2.8 @stylexjs/stylex@0.19.0
```

Import CSS once for every Atira package used by the application. CSS is
explicit rather than injected from JavaScript, so server imports remain valid:

```tsx
import '@atira/foundations/styles.css'
import '@atira/primitives/styles.css'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '@atira/foundations/themes'
import { Button } from '@atira/primitives'

export function LibraryCheck() {
  return (
    <div {...stylex.props(lightTheme)}>
      <Button>Check integration</Button>
    </div>
  )
}
```

No StyleX Babel, Vite, or Next plugin is needed for these artifacts. StyleX's
small runtime remains a peer because hosts use `stylex.props` to apply a compiled
theme. The bundled themes are precompiled. A consumer that calls `createTheme`
itself is authoring new StyleX and therefore still needs a StyleX compiler.

The regression harness verifies a Vite React 19 production build and real
browser interaction, plus a running built Next 15 server/client application:

```sh
pnpm test:consumers
```

It type-checks the fixtures; verifies compiled CSS, dark themes, scoped popup
CSS, component and block leaf imports, inline/class overrides, and React
interaction; and records the light Button entry's nonempty Rollup module graph
to prove it does not cross into components, blocks, providers, Streamdown, or
Zod. The packed Vite fixture enables the real StyleX plugin for host-authored
`xstyle` and dynamic-variable precedence; the installed library itself remains
precompiled. Next is started after its production build and checked in a browser
for hydration. Its computed dark-theme button colors must equal the equivalent
Vite component's colors, rather than merely carrying a theme attribute.

## Source export for StyleX-aware workspaces

The existing source workflow remains available when the host intentionally owns
StyleX compilation:

```sh
node scripts/export-library.mjs /absolute/path/to/app/vendor/atira
```

The parent must exist and destination must not. Add
`vendor/atira/packages/*` to the host's `pnpm-workspace.yaml`, install the
workspace packages, and configure the host's StyleX integration to compile the
vendored files. The consumer harness creates this export in isolation, installs
workspace dependencies, builds it with the real StyleX Vite plugin, and checks
bundled theme compilation, host-authored `xstyle` CSS, and component interaction in a browser. This
route is appropriate for consumer-authored `createTheme` overrides. It is not
required for ordinary use of compiled themes and components.

## Customization boundaries

DOM-backed leaf components accept native attributes, refs, `className`, `style`,
and `xstyle`. StyleX overrides resolve after defaults and variants; inline
styles resolve last. Unlayered host CSS can override the extracted CSS layers.
Stateful convenience compositions keep their explicit controlled contracts.

Menus and selects inherit their local theme by default. When their trigger sits
inside clipping, transformed, or hidden content, pass `portalContainer` pointing
to an unclipped themed ancestor. `ChatComposer` does this for its toolbar menus.
Passing a container outside the theme scope also leaves that theme scope.

`Message` exposes content, metadata, and action slots. `Reasoning` and
`ToolActivity` expose controlled disclosure state and custom labels/content, but
retain their status/disclosure anatomy. `DialogParts` and `SelectPickerParts`
are explicitly **unstyled Base UI parts**, not styled replacements for the
convenience wrappers. Arbitrary anatomy is not a supported promise of every
Atira component.

## Update and compatibility workflow

1. Use the repository's declared Node and pnpm versions and run
   `pnpm install --frozen-lockfile`.
2. Run `pnpm test`, `pnpm build:library`, and `pnpm test:consumers`.
3. Pack into a new directory. Compare tarball inventory/manifests and consumer
   screenshots or behavior before replacing vendored files.
4. Update all four overrides together when consuming blocks or components.
5. Keep one React/React DOM 19 instance in the host and satisfy exact peer ranges.
6. Store or commit tarballs only where intended. Publication, versioning, and
   registry metadata remain separate decisions.

The consumer harness was run successfully on Node 26.10.0 with React/React DOM
19.2.8, StyleX 0.19.0, Vite 8.2.2, and Next 15.5.9. The repository declares
Node `>=22.13.0`, but this consumer matrix does not claim a successful Node 22
run. Compiled output uses Node-compatible ESM specifier extensions and stable
leaf subpath exports. Other bundlers may consume the standard ESM/CSS exports,
but are not asserted by the harness. The library does not ship a reset or fonts.

This documents local artifact consumption, not npm publication. The package
version remains `0.0.0`, all four manifests remain private, and provenance is the
reviewed repository revision plus the locally produced tarball inventory. No
registry, signing/attestation policy, support window, or publication metadata is
defined here. The
compiled workflow does not promise zero-configuration support for a consumer's
custom `createTheme`; authoring new StyleX requires a compatible compiler setup.
