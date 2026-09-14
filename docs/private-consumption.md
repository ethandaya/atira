# Use Pretty Amped privately

No registry, publication, or repository visibility change is required. This is
a **source distribution for a pnpm React workspace**, not precompiled JavaScript
and CSS. The consuming app must compile StyleX. The recipe below uses Vite;
other bundlers need their corresponding StyleX integration.

## Export and vendor

In the Pretty Amped checkout, with its declared pnpm version installed:

```sh
node scripts/export-library.mjs /absolute/path/to/nanosentry/vendor/pretty-amped
```

The parent directory must exist; the destination must not exist. Exporting does
not install dependencies, publish anything, or include the demo, credentials,
Lapse, runtime adapters, or tests. Catalog versions are read from pnpm's configuration;
internal dependencies remain workspace links. All packages remain `private`.
The command requires Node and pnpm, but no installed workspace dependencies.
With dependencies installed, `pnpm export:library <destination>` is equivalent.
On a clean checkout use the Node command above to avoid pnpm's automatic install
before running package scripts (which would include the demo's private dependencies).

Add this entry to **NanoSentry's root** `pnpm-workspace.yaml`, retaining its
existing package entries:

```yaml
packages:
  - vendor/pretty-amped/packages/*
```

Add the packages to the React application's dependencies (use its actual path
instead of `apps/web`):

```sh
pnpm --filter ./apps/web add '@pretty-amped/blocks@workspace:*' '@pretty-amped/components@workspace:*' '@pretty-amped/primitives@workspace:*' '@pretty-amped/foundations@workspace:*' @stylexjs/stylex@0.19.0
pnpm --filter ./apps/web add -D @stylexjs/unplugin@0.19.0
pnpm add -Dw @types/react@19.2.18 @types/react-dom@19.2.5
```

Install the React types at the workspace root so TypeScript can resolve them
from the vendored sibling packages, not only from the app. Keep the app's usual
Vite client types (`vite/client`) enabled for CSS imports.

The current source targets React and React DOM 19.2.8. Keep one compatible React
instance in the host. Commit the vendored source and NanoSentry's updated lockfile
to your private repository when ready; CI then needs no access to this repository.
For updates, export to a new directory and review the source diff before replacing
the previous version. Keep host adaptations outside the vendored source when possible.

## Compile styles in the host

Merge this into the app's Vite config. `workspaceRoot` must point to NanoSentry's
root; this example assumes the config lives in `apps/web`.

```ts
import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    stylex.vite({
      dev: mode === 'development',
      runtimeInjection: false,
      unstable_moduleResolution: { type: 'commonJS', rootDir: workspaceRoot },
      useCSSLayers: true,
    }),
    react(),
  ],
}))
```

Keep workspace symlink resolution enabled (Vite's default); do not prebundle the
library as an opaque dependency. Both the host and library must use the same
StyleX compilation pipeline so token identities and generated styles agree.

Import the host's nonempty global CSS file from its entry point (for example,
`import './global.css'`). With this plugin version, a production build without
an existing CSS asset can omit the generated styles. Check that the production
HTML links a CSS asset containing the library's styles.

```tsx
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '@pretty-amped/foundations/themes'
import { Button } from '@pretty-amped/primitives'

export function LibraryCheck() {
  return (
    <div {...stylex.props(lightTheme)}>
      <Button onClick={() => alert('Connected')}>Check integration</Button>
    </div>
  )
}
```

Apply the theme at the host boundary containing library components. The library
does not install a global reset or fonts; those remain host choices. Start with
this button in both development and a production preview before integrating
`ChatSession`. Chat state, provider credentials, transport, and persistence remain
NanoSentry's responsibility; exporting the UI does not export the demo backend.
