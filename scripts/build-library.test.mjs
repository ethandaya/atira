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

test('builds private ESM, declarations, CSS, and installable tarballs', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'pretty-amped-build-'))
  const sourceRoot = join(temporary, 'source')
  const packs = join(temporary, 'packs')
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
      [join(sourceRoot, 'scripts/build-library.mjs'), '--pack', packs],
      { cwd: sourceRoot },
    )
    const tarballs = (await readdir(packs)).filter((path) =>
      path.endsWith('.tgz'),
    )
    assert.equal(tarballs.length, 4)
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

      const unpacked = join(temporary, 'unpacked', name)
      await mkdir(unpacked, { recursive: true })
      execFileSync('tar', [
        '-xzf',
        join(packs, `pretty-amped-${name}-0.0.0.tgz`),
        '-C',
        unpacked,
      ])
      const packageRoot = join(unpacked, 'package')
      const manifest = JSON.parse(
        await readFile(join(packageRoot, 'package.json'), 'utf8'),
      )
      assert.equal(manifest.private, true)
      assert.deepEqual(manifest.files, ['dist'])
      assert.ok(
        !Object.keys(manifest.exports).some(
          (key) =>
            key.includes('src') ||
            key.includes('test') ||
            key.includes('style-props'),
        ),
      )
      for (const target of Object.values(manifest.exports).flatMap((value) =>
        typeof value === 'string' ? [value] : Object.values(value),
      )) {
        await readFile(join(packageRoot, target))
      }
      const packedFiles = execFileSync(
        'tar',
        ['-tzf', join(packs, `pretty-amped-${name}-0.0.0.tgz`)],
        { encoding: 'utf8' },
      )
      assert.doesNotMatch(
        packedFiles,
        /(?:^|\/)(?:src|test-results)(?:\/|$)|\.test\.[^/]+$/m,
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

    const exportScript = join(sourceRoot, 'scripts/export-library.mjs')
    await cp(join(root, 'scripts/export-library.mjs'), exportScript)
    const exported = join(temporary, 'exported')
    assert.throws(() =>
      execFileSync(process.execPath, [exportScript, exported], {
        cwd: sourceRoot,
        stdio: 'pipe',
      }),
    )
    await assert.rejects(readFile(join(exported, 'package.json')), {
      code: 'ENOENT',
    })
    assert.ok(!(await readdir(temporary)).includes('exported'))
    await mkdir(join(sourceRoot, 'docs'))
    await cp(
      join(root, 'docs/private-consumption.md'),
      join(sourceRoot, 'docs/private-consumption.md'),
    )
    execFileSync(process.execPath, [exportScript, exported], {
      cwd: sourceRoot,
      stdio: 'pipe',
    })
    assert.ok((await readFile(join(exported, 'README.md'), 'utf8')).length > 0)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
