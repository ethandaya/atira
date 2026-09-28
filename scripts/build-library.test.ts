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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

test('builds ESM, declarations, and CSS without replacing a prior build on failure', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'atira-build-'))
  const sourceRoot = join(temporary, 'source')
  try {
    await mkdir(join(sourceRoot, 'packages'), { recursive: true })
    await mkdir(join(sourceRoot, 'scripts'))
    await cp(
      join(root, 'scripts/build-library.ts'),
      join(sourceRoot, 'scripts/build-library.ts'),
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
      [
        '--experimental-strip-types',
        join(sourceRoot, 'scripts/build-library.ts'),
      ],
      { cwd: sourceRoot },
    )
    for (const name of ['foundations', 'primitives', 'components', 'blocks']) {
      const dist = join(sourceRoot, 'packages', name, 'dist')
      expect(
        (await readFile(join(dist, 'styles.css'), 'utf8')).length,
      ).toBeGreaterThan(100)
      expect(
        await readFile(
          join(dist, name === 'foundations' ? 'themes.js' : 'index.js'),
          'utf8',
        ),
      ).toMatch(/export/)
      expect(
        (
          await readFile(
            join(dist, name === 'foundations' ? 'themes.d.ts' : 'index.d.ts'),
            'utf8',
          )
        ).length,
      ).toBeGreaterThan(20)
    }
    expect(
      await readFile(
        join(sourceRoot, 'packages/foundations/dist/nested/data.json'),
        'utf8',
      ),
    ).toBe('{"fixture":true}\n')
    expect(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/button.js'),
        'utf8',
      ),
    ).not.toMatch(/stylex\.create/)
    expect(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/index.js'),
        'utf8',
      ),
    ).toMatch(/from ['"]\.\/button\.js['"]/)
    expect(
      await readFile(
        join(sourceRoot, 'packages/primitives/dist/index.d.ts'),
        'utf8',
      ),
    ).toMatch(/from ['"]\.\/button\.js['"]/)
    const moduleUrl = `${pathToFileURL(join(sourceRoot, 'packages/foundations/dist/themes.js')).href}?test=${Date.now()}`
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `await import(${JSON.stringify(moduleUrl)})`,
      ],
      { cwd: sourceRoot },
    )

    const names = ['foundations', 'primitives', 'components', 'blocks']
    for (const name of names)
      await writeFile(
        join(sourceRoot, 'packages', name, 'dist', 'previous-build'),
        name,
      )
    const broken = join(sourceRoot, 'packages/components/src/broken.ts')
    await writeFile(broken, 'export const broken = (\n')
    expect(() =>
      execFileSync(
        process.execPath,
        [
          '--experimental-strip-types',
          join(sourceRoot, 'scripts/build-library.ts'),
        ],
        { cwd: sourceRoot, stdio: 'pipe' },
      ),
    ).toThrow()
    for (const name of names)
      expect(
        await readFile(
          join(sourceRoot, 'packages', name, 'dist', 'previous-build'),
          'utf8',
        ),
      ).toBe(name)
    expect(
      !(await readdir(sourceRoot)).some((name) =>
        name.startsWith('.library-build-'),
      ),
    ).toBe(true)
    await rm(broken)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}, 20_000)
