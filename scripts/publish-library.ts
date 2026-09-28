import { execFileSync } from 'node:child_process'
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const names = ['foundations', 'primitives', 'components', 'blocks']
const publishArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== '--')
const dryRun = publishArguments.includes('--dry-run')
const changesetsOutput = process.env.CHANGESETS_OUTPUT
const catalog = JSON.parse(
  execFileSync('pnpm', ['config', 'get', 'catalog', '--json'], {
    cwd: root,
    encoding: 'utf8',
  }),
) as Record<string, string>

type ConditionalExport = {
  default: string
  import: string
  types: string
}

type SourceManifest = {
  bugs?: { url: string }
  dependencies?: Record<string, string>
  description?: string
  devDependencies?: Record<string, string>
  exports: Record<string, string>
  files?: string[]
  homepage?: string
  keywords?: string[]
  license?: string
  name: string
  peerDependencies?: Record<string, string>
  private: boolean
  publishConfig?: {
    access: string
    provenance: boolean
    registry: string
  }
  repository?: { directory?: string; type: string; url: string }
  scripts?: Record<string, string>
  sideEffects?: boolean | string[]
  version: string
}

type ReleaseManifest = Omit<
  SourceManifest,
  | 'devDependencies'
  | 'exports'
  | 'files'
  | 'publishConfig'
  | 'scripts'
  | 'sideEffects'
> & {
  exports: Record<string, ConditionalExport | string>
  files: string[]
  publishConfig: {
    access: string
    provenance: boolean
    registry: string
  }
  sideEffects: string[]
}

function compiledExports(
  sourceExports: Record<string, string>,
): Record<string, ConditionalExport> {
  return Object.fromEntries(
    Object.entries(sourceExports).map(([name, source]) => {
      const stem = source
        .replace(/^\.\/src\//, '')
        .replace(/\.(?:tsx?|jsx?)$/, '')
      return [
        name,
        {
          types: `./dist/${stem}.d.ts`,
          import: `./dist/${stem}.js`,
          default: `./dist/${stem}.js`,
        },
      ] satisfies [string, ConditionalExport]
    }),
  )
}

function releaseManifest(
  manifest: SourceManifest,
  leaves: string[],
): ReleaseManifest {
  const {
    devDependencies: _devDependencies,
    exports: sourceExports,
    files: _files,
    publishConfig: _publishConfig,
    scripts: _scripts,
    sideEffects: _sideEffects,
    ...source
  } = structuredClone(manifest)
  const output: ReleaseManifest = {
    ...source,
    private: false,
    files: ['dist', 'README.md'],
    sideEffects: ['./dist/styles.css'],
    publishConfig: {
      access: 'public',
      provenance: true,
      registry: 'https://registry.npmjs.org/',
    },
    exports: {
      ...compiledExports(sourceExports),
      ...Object.fromEntries(
        leaves.map(
          (leaf) =>
            [
              `./${leaf}`,
              {
                types: `./dist/${leaf}.d.ts`,
                import: `./dist/${leaf}.js`,
                default: `./dist/${leaf}.js`,
              },
            ] satisfies [string, ConditionalExport],
        ),
      ),
      './styles.css': './dist/styles.css',
      './package.json': './package.json',
    },
  }
  for (const [dependency, version] of Object.entries(
    output.dependencies ?? {},
  )) {
    if (version === 'catalog:') {
      const catalogVersion = catalog[dependency]
      if (!catalogVersion)
        throw new Error(`Catalog has no version for ${dependency}`)
      output.dependencies![dependency] = catalogVersion
    }
    if (version === 'workspace:*') {
      output.dependencies![dependency] = manifest.version
    }
  }
  for (const [dependency, version] of Object.entries(
    output.peerDependencies ?? {},
  )) {
    if (version === 'catalog:') {
      const catalogVersion = catalog[dependency]
      if (!catalogVersion)
        throw new Error(`Catalog has no version for ${dependency}`)
      output.peerDependencies![dependency] = `^${catalogVersion}`
    }
    if (version === 'workspace:*') {
      output.peerDependencies![dependency] = manifest.version
    }
  }
  return output
}

async function packageLeaves(source: string, manifest: SourceManifest) {
  if (!manifest.exports['.']) return []
  const index = await readFile(join(source, 'dist', 'index.js'), 'utf8')
  return [
    ...new Set(
      [...index.matchAll(/from ['"]\.\/([^'"]+)\.js['"]/g)]
        .map((match) => match[1])
        .filter((leaf): leaf is string => leaf !== undefined)
        .filter((leaf) => leaf !== 'style-props'),
    ),
  ]
}

async function verifyPackages(staging: string) {
  const tarballs = join(staging, 'tarballs')
  const consumer = join(staging, 'consumer')
  await mkdir(tarballs)
  await mkdir(consumer)

  const packageFiles: string[] = []
  for (const name of names) {
    const output = JSON.parse(
      execFileSync(
        'npm',
        ['pack', join(staging, name), '--json', '--pack-destination', tarballs],
        { cwd: root, encoding: 'utf8' },
      ),
    ) as { filename: string }[]
    const filename = output[0]?.filename
    if (!filename) throw new Error(`npm pack produced no tarball for ${name}`)
    packageFiles.push(join(tarballs, filename))
  }

  await writeFile(
    join(consumer, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
  )
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      ...packageFiles,
    ],
    { cwd: consumer, stdio: 'inherit' },
  )
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      [
        "await import('@atiraui/foundations/chat')",
        "await import('@atiraui/foundations/chat-invariants')",
        "await import('@atiraui/foundations/themes')",
        "await import('@atiraui/foundations/tokens.stylex')",
        "await import('@atiraui/primitives')",
        "await import('@atiraui/components')",
        "await import('@atiraui/blocks')",
        "import.meta.resolve('@atiraui/foundations/styles.css')",
        "import.meta.resolve('@atiraui/primitives/styles.css')",
        "import.meta.resolve('@atiraui/components/styles.css')",
        "import.meta.resolve('@atiraui/blocks/styles.css')",
      ].join(';'),
    ],
    { cwd: consumer, stdio: 'inherit' },
  )
  console.log('Verified packed library packages in a clean consumer')
}

function isPublished(manifest: ReleaseManifest) {
  try {
    return (
      execFileSync(
        'npm',
        ['view', `${manifest.name}@${manifest.version}`, 'version'],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ).trim() === manifest.version
    )
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : ''
    if (stderr.includes('E404')) return false
    throw error
  }
}

execFileSync(
  process.execPath,
  ['--experimental-strip-types', join(root, 'scripts/build-library.ts')],
  {
    cwd: root,
    stdio: 'inherit',
  },
)

const staging = await mkdtemp(join(tmpdir(), 'atira-publish-'))
try {
  for (const name of names) {
    const source = join(root, 'packages', name)
    const manifest = JSON.parse(
      await readFile(join(source, 'package.json'), 'utf8'),
    ) as SourceManifest
    const target = join(staging, name)
    await cp(join(source, 'dist'), join(target, 'dist'), { recursive: true })
    await cp(join(root, 'README.md'), join(target, 'README.md'))
    await writeFile(
      join(target, 'package.json'),
      `${JSON.stringify(
        releaseManifest(manifest, await packageLeaves(source, manifest)),
        null,
        2,
      )}\n`,
    )
  }

  await verifyPackages(staging)

  for (const name of names) {
    const target = join(staging, name)
    const manifest = JSON.parse(
      await readFile(join(target, 'package.json'), 'utf8'),
    ) as ReleaseManifest
    if (!dryRun && isPublished(manifest)) {
      console.log(
        `Skipping ${manifest.name}@${manifest.version}; already published`,
      )
      continue
    }
    execFileSync(
      'npm',
      ['publish', '--access', 'public', ...publishArguments],
      {
        cwd: target,
        stdio: 'inherit',
      },
    )
    if (changesetsOutput && !dryRun) {
      await appendFile(
        changesetsOutput,
        `${JSON.stringify({
          packageName: manifest.name,
          tag: `${manifest.name}@${manifest.version}`,
          type: 'git-tag',
        })}\n`,
      )
    }
  }
} finally {
  await rm(staging, { recursive: true, force: true })
}
