import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./export-library.mjs', import.meta.url))

test('exports source without catalog references and refuses overwrites', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'atira-test-'))
  const output = join(temporary, 'export with spaces')
  try {
    const run = spawnSync(process.execPath, [script, output], {
      cwd: temporary,
      encoding: 'utf8',
    })
    assert.equal(run.status, 0, run.stderr)
    assert.deepEqual((await readdir(output)).sort(), [
      'README.md',
      'package.json',
      'packages',
      'pnpm-workspace.yaml',
    ])
    assert.deepEqual((await readdir(join(output, 'packages'))).sort(), [
      'blocks',
      'components',
      'foundations',
      'primitives',
    ])
    for (const name of ['blocks', 'components', 'foundations', 'primitives']) {
      const target = join(output, 'packages', name)
      const manifest = JSON.parse(
        await readFile(join(target, 'package.json'), 'utf8'),
      )
      assert.equal(manifest.private, true)
      assert.equal(manifest.devDependencies, undefined)
      assert.equal(manifest.peerDependencies['@stylexjs/stylex'], '0.19.0')
      assert.ok(!JSON.stringify(manifest).includes('catalog:'))
      for (const [dependency, version] of Object.entries(
        manifest.dependencies ?? {},
      )) {
        if (dependency.startsWith('@atira/'))
          assert.equal(version, 'workspace:*')
      }
      const source = fileURLToPath(
        new URL(`../packages/${name}/src/`, import.meta.url),
      )
      const expected = (await readdir(source, { recursive: true }))
        .filter((path) => !/\.test\.[^/]+$/.test(path))
        .sort()
      assert.deepEqual(
        (await readdir(join(target, 'src'), { recursive: true })).sort(),
        expected,
      )
      for (const entry of Object.values(manifest.exports)) {
        assert.deepEqual(
          await readFile(join(target, entry)),
          await readFile(join(source, entry.replace('./src/', ''))),
        )
      }
    }
    const before = await readFile(join(output, 'package.json'))
    const again = spawnSync(process.execPath, [script, output], {
      encoding: 'utf8',
    })
    assert.notEqual(again.status, 0)
    assert.match(again.stderr, /EEXIST/)
    assert.deepEqual(await readFile(join(output, 'package.json')), before)
    const missing = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    assert.notEqual(missing.status, 0)
    assert.match(missing.stderr, /Usage:/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
