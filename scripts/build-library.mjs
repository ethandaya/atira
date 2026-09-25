import { transformAsync, transformFileAsync } from '@babel/core'
import transformReactJsx from '@babel/plugin-transform-react-jsx'
import transformTypeScript from '@babel/plugin-transform-typescript'
import stylexPlugin from '@stylexjs/babel-plugin'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const names = ['foundations', 'primitives', 'components', 'blocks']
const packIndex = process.argv.indexOf('--pack')
const packDestination = packIndex === -1 ? undefined : process.argv[packIndex + 1]

if (packIndex !== -1 && !packDestination) {
  throw new Error('Usage: pnpm build:library [--pack /path/to/new-or-empty-directory]')
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const output = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await files(path))
    else output.push(path)
  }
  return output
}

function compiledExports(sourceExports) {
  return Object.fromEntries(Object.entries(sourceExports).map(([name, source]) => {
    const stem = source.replace(/^\.\/src\//, '').replace(/\.(?:tsx?|jsx?)$/, '')
    return [name, {
      types: `./dist/${stem}.d.ts`,
      import: `./dist/${stem}.js`,
      default: `./dist/${stem}.js`,
    }]
  }))
}

function releaseManifest(manifest, leaves) {
  const output = structuredClone(manifest)
  output.private = true
  output.files = ['dist']
  output.sideEffects = ['./dist/styles.css']
  output.exports = {
    ...compiledExports(manifest.exports),
    ...Object.fromEntries(leaves.map((leaf) => [`./${leaf}`, {
      types: `./dist/${leaf}.d.ts`,
      import: `./dist/${leaf}.js`,
      default: `./dist/${leaf}.js`,
    }])),
    './styles.css': './dist/styles.css',
    './package.json': './package.json',
  }
  delete output.devDependencies
  delete output.scripts
  for (const dependencies of [output.dependencies, output.peerDependencies]) {
    for (const [dependency, version] of Object.entries(dependencies ?? {})) {
      if (version === 'catalog:') dependencies[dependency] = catalog[dependency]
      if (version === 'workspace:*') dependencies[dependency] = '0.0.0'
    }
  }
  return output
}

const catalog = JSON.parse(execFileSync('pnpm', ['config', 'get', 'catalog', '--json'], {
  cwd: root,
  encoding: 'utf8',
}))

function nodeEsmSpecifiers() {
  const withExtension = (value) => value.startsWith('.') && !/\.(?:[cm]?js|json)$/.test(value)
    ? `${value}.js`
    : value
  return {
    visitor: {
      ImportDeclaration(path) { path.node.source.value = withExtension(path.node.source.value) },
      ExportNamedDeclaration(path) { if (path.node.source) path.node.source.value = withExtension(path.node.source.value) },
      ExportAllDeclaration(path) { path.node.source.value = withExtension(path.node.source.value) },
      CallExpression(path) {
        if (path.node.callee.type === 'Import' && path.node.arguments[0]?.type === 'StringLiteral') {
          path.node.arguments[0].value = withExtension(path.node.arguments[0].value)
        }
      },
    },
  }
}

async function rewriteDeclarationSpecifiers(outputRoot) {
  for (const path of await files(outputRoot)) {
    if (!path.endsWith('.d.ts')) continue
    const source = await readFile(path, 'utf8')
    const result = await transformAsync(source, {
      babelrc: false,
      configFile: false,
      filename: path,
      parserOpts: { plugins: ['typescript'] },
      plugins: [nodeEsmSpecifiers],
    })
    if (!result?.code) throw new Error(`Babel emitted no declaration for ${path}`)
    await writeFile(path, `${result.code}\n`)
  }
}

async function buildPackage(name, outputRoot) {
  const packageRoot = join(root, 'packages', name)
  const sourceRoot = join(packageRoot, 'src')
  const rules = []
  await mkdir(outputRoot, { recursive: true })

  for (const source of await files(sourceRoot)) {
    if (/\.test\.[^/]+$/.test(source)) continue
    const path = relative(sourceRoot, source)
    if (extname(source) === '.json') {
      const target = join(outputRoot, path)
      await mkdir(dirname(target), { recursive: true })
      await cp(source, target)
      continue
    }
    if (!/\.[cm]?[jt]sx?$/.test(source)) continue
    const result = await transformFileAsync(source, {
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      plugins: [
        [stylexPlugin, {
          dev: false,
          runtimeInjection: false,
          unstable_moduleResolution: { type: 'commonJS', rootDir: root },
          useCSSLayers: true,
        }],
        [transformTypeScript, { isTSX: source.endsWith('.tsx'), allExtensions: true }],
        [transformReactJsx, { runtime: 'automatic' }],
        nodeEsmSpecifiers,
      ],
    })
    if (!result?.code) throw new Error(`Babel emitted no code for ${source}`)
    rules.push(...(result.metadata.stylex ?? []))
    const target = join(outputRoot, path.replace(/\.[cm]?[jt]sx?$/, '.js'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, `${result.code}\n`)
  }

  await writeFile(join(outputRoot, 'styles.css'), `${stylexPlugin.processStylexRules(rules, { useLayers: true })}\n`)
  execFileSync('pnpm', ['exec', 'tsc', '-p', join(packageRoot, 'tsconfig.build.json'), '--outDir', outputRoot], { cwd: root, stdio: 'inherit' })
  await rewriteDeclarationSpecifiers(outputRoot)
}

const buildDirectory = await mkdtemp(join(root, '.library-build-'))
try {
  for (const name of names) await buildPackage(name, join(buildDirectory, name))
  for (const name of names) {
    const destination = join(root, 'packages', name, 'dist')
    await rm(destination, { recursive: true, force: true })
    await rename(join(buildDirectory, name), destination)
  }
} finally {
  await rm(buildDirectory, { recursive: true, force: true })
}

if (packDestination) {
  const destination = resolve(packDestination)
  await mkdir(destination)
  const staging = join(destination, '.staging')
  await mkdir(staging)
  try {
    for (const name of names) {
      const source = join(root, 'packages', name)
      const target = join(staging, name)
      await mkdir(target)
      await cp(join(source, 'dist'), join(target, 'dist'), { recursive: true })
      const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
      const leaves = new Set()
      if (manifest.exports['.']) {
        const entry = await transformFileAsync(join(source, 'dist', 'index.js'), {
          ast: true, code: false, babelrc: false, configFile: false,
        })
        for (const statement of entry.ast.program.body) {
          if (statement.type === 'ExportNamedDeclaration' && statement.source?.value.startsWith('./')) {
            const leaf = statement.source.value.slice(2, -3)
            if (leaf !== 'style-props') leaves.add(leaf)
          }
        }
      }
      await writeFile(join(target, 'package.json'), `${JSON.stringify(releaseManifest(manifest, [...leaves]), null, 2)}\n`)
      execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: target, stdio: 'inherit' })
    }
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

console.log(packDestination ? `Built and packed private packages in ${packDestination}` : 'Built private packages')
