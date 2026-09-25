import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const destination = process.argv[2]
if (!destination) {
  throw new Error(
    'Usage: pnpm export:library /path/to/new/pretty-amped-directory',
  )
}

// Never overwrite an existing export or a consumer's changes.
const output = resolve(destination)
const catalog = JSON.parse(
  execFileSync('pnpm', ['config', 'get', 'catalog', '--json'], {
    cwd: root,
    encoding: 'utf8',
  }),
)
await mkdir(output)
await exportSource().catch(async (error) => {
  await rm(output, { recursive: true, force: true })
  throw error
})
console.log(`Private library source exported to ${output}`)

async function exportSource() {
  const names = ['foundations', 'primitives', 'components', 'blocks']
  for (const name of names) {
    const manifest = JSON.parse(
      await readFile(join(root, 'packages', name, 'package.json'), 'utf8'),
    )
    for (const dependencies of [
      manifest.dependencies,
      manifest.peerDependencies,
    ]) {
      for (const [dependency, version] of Object.entries(dependencies ?? {})) {
        if (version === 'catalog:') {
          if (!catalog[dependency])
            throw new Error(`Missing catalog version for ${dependency}`)
          dependencies[dependency] = catalog[dependency]
        }
      }
    }
    delete manifest.devDependencies
    delete manifest.scripts
    manifest.private = true
    const target = join(output, 'packages', name)
    await mkdir(target, { recursive: true })
    await cp(join(root, 'packages', name, 'src'), join(target, 'src'), {
      recursive: true,
      filter: (path) => !/\.test\.[^/]+$/.test(path),
    })
    await writeFile(
      join(target, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
  }
  const { packageManager, engines } = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  )
  await writeFile(
    join(output, 'package.json'),
    `${JSON.stringify(
      {
        name: 'pretty-amped-private-source',
        private: true,
        packageManager,
        engines,
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(output, 'pnpm-workspace.yaml'),
    'packages:\n  - packages/*\n',
  )
  await cp(join(root, 'docs/private-consumption.md'), join(output, 'README.md'))
}
