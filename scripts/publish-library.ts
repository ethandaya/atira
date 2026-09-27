import { execFileSync } from 'node:child_process'
import {
  appendFile,
  cp,
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
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  exports: Record<string, string>
  files?: string[]
  name: string
  peerDependencies?: Record<string, string>
  private: boolean
  publishConfig?: { access: string; registry: string }
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
  publishConfig: { access: string; registry: string }
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
    files: ['dist'],
    sideEffects: ['./dist/styles.css'],
    publishConfig: {
      access: 'public',
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
  for (const dependencies of [output.dependencies, output.peerDependencies]) {
    if (!dependencies) continue
    for (const [dependency, version] of Object.entries(dependencies)) {
      if (version === 'catalog:') {
        const catalogVersion = catalog[dependency]
        if (!catalogVersion)
          throw new Error(`Catalog has no version for ${dependency}`)
        dependencies[dependency] = catalogVersion
      }
      if (version === 'workspace:*') dependencies[dependency] = manifest.version
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
    await writeFile(
      join(target, 'package.json'),
      `${JSON.stringify(
        releaseManifest(manifest, await packageLeaves(source, manifest)),
        null,
        2,
      )}\n`,
    )
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
