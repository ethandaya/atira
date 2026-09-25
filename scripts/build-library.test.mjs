import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

test('builds ESM, declarations, and CSS without replacing a prior build on failure', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'atira-build-'))
  const sourceRoot = join(temporary, 'source')
  try {
    await mkdir(join(sourceRoot, 'packages'), { recursive: true })
    await mkdir(join(sourceRoot, 'scripts'))
    await cp(
      join(root, 'scripts/build-library.mjs'),
      join(sourceRoot, 'scripts/build-library.mjs'),
    )
    for (const file of [
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
    ]) {
      await cp(join(root, file), join(sourceRoot, file))
    }
    for (const name of ['foundations', 'primitives', 'components', 'blocks']) {
      await cp(
        join(root, 'packages', name),
        join(sourceRoot, 'packages', name),
        { recursive: true },
      )
    }
    await symlink(
      join(root, 'node_modules'),
      join(sourceRoot, 'node_modules'),
      'dir',
    )
    const nestedJson = join(
      sourceRoot,
      'packages/foundations/src/nested/data.json',
    )
    await mkdir(dirname(nestedJson), { recursive: true })
    await writeFile(nestedJson, '{"fixture":true}\n')

    execFileSync(
      process.execPath,
      [join(sourceRoot, 'scripts/build-library.mjs')],
      { cwd: sourceRoot },
    )
    for (const name of ['foundations', 'primitives', 'components', 'blocks']) {
      const dist = join(sourceRoot, 'packages', name, 'dist')
      assert.ok((await readFile(join(dist, 'styles.css'), 'utf8')).length > 100)
      assert.match(
        await readFile(
          join(dist, name === 'foundations' ? 'themes.js' : 'index.js'),
          'utf8',
        ),
        /export/,
      )
      assert.ok(
        (
          await readFile(
            join(dist, name === 'foundations' ? 'themes.d.ts' : 'index.d.ts'),
            'utf8',
          )
        ).length > 20,
      )
    }
    assert.equal(
      await readFile(
        join(sourceRoot, 'packages/foundations/dist/nested/data.json'),
        'utf8',
      ),
      '{"fixture":true}\n',
    )
    assert.doesNotMatch(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/button.js'),
        'utf8',
      ),
      /stylex\.create/,
    )
    assert.match(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/index.js'),
        'utf8',
      ),
      /from ['"]\.\/button\.js['"]/,
    )
    assert.match(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/index.d.ts'),
        'utf8',
      ),
      /from ['"]\.\/button\.js['"]/,
    )
    await import(
      `${new URL(`file://${join(sourceRoot, 'packages/foundations/dist/themes.js')}`)}?test=${Date.now()}`
    )

    const names = ['foundations', 'primitives', 'components', 'blocks']
    for (const name of names)
      await writeFile(
        join(sourceRoot, 'packages', name, 'dist', 'previous-build'),
        name,
      )
    const broken = join(sourceRoot, 'packages/components/src/broken.ts')
    await writeFile(broken, 'export const broken = (\n')
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [join(sourceRoot, 'scripts/build-library.mjs')],
        { cwd: sourceRoot, stdio: 'pipe' },
      ),
    )
    for (const name of names)
      assert.equal(
        await readFile(
          join(sourceRoot, 'packages', name, 'dist', 'previous-build'),
          'utf8',
        ),
        name,
      )
    assert.ok(
      !(await readdir(sourceRoot)).some((name) =>
        name.startsWith('.library-build-'),
      ),
    )
    await rm(broken)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
