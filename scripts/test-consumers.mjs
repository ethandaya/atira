import { spawn, spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixtures = join(root, 'scripts/fixtures')
const temporary = await mkdtemp(join(tmpdir(), 'atira-consumers-'))
const packs = join(temporary, 'packs')
const packageNames = ['foundations', 'primitives', 'components', 'blocks']

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
    )
}

async function json(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function workspace(path, tarballs) {
  await writeFile(
    join(path, 'pnpm-workspace.yaml'),
    `overrides:\n${packageNames.map((name, index) => `  '@atira/${name}': file:${tarballs[index]}`).join('\n')}\nallowBuilds:\n  sharp: true\n`,
  )
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) =>
    server.listen(0, '127.0.0.1', resolve).once('error', reject),
  )
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function ready(url, label) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`${label} did not start`)
}

async function stopServer(server) {
  if (server.exitCode !== null || server.signalCode !== null) return
  const exited = once(server, 'exit')
  server.kill()
  await exited
}

try {
  run(
    process.execPath,
    [join(root, 'scripts/build-library.mjs'), '--pack', packs],
    root,
  )
  const tarballs = packageNames.map((name) =>
    join(packs, `atira-${name}-0.0.0.tgz`),
  )

  const vite = join(temporary, 'vite')
  await cp(join(fixtures, 'vite'), vite, { recursive: true })
  await json(join(vite, 'package.json'), {
    private: true,
    type: 'module',
    scripts: { build: 'tsc --noEmit && vite build' },
    dependencies: {
      '@atira/foundations': `file:${tarballs[0]}`,
      '@atira/primitives': `file:${tarballs[1]}`,
      '@atira/components': `file:${tarballs[2]}`,
      '@atira/blocks': `file:${tarballs[3]}`,
      '@stylexjs/stylex': '0.19.0',
      '@stylexjs/unplugin': '0.19.0',
      '@vitejs/plugin-react': '6.1.1',
      '@types/react': '19.2.18',
      '@types/react-dom': '19.2.5',
      react: '19.2.8',
      'react-dom': '19.2.8',
      typescript: '5.9.3',
      vite: '8.2.2',
    },
    devDependencies: {},
  })
  await workspace(vite, tarballs)
  run('pnpm', ['install'], vite)
  run('pnpm', ['build'], vite)
  const lightGraph = JSON.parse(
    await readFile(join(vite, 'dist/light-module-graph.json'), 'utf8'),
  )
  const buttonModules = lightGraph.filter((id) =>
    /@atira[/+]primitives.*[/\\]button\.js(?:$|\?)/i.test(id),
  )
  if (buttonModules.length === 0)
    throw new Error(
      `Button leaf module graph contained no packed Button module: ${JSON.stringify(lightGraph)}`,
    )
  if (
    lightGraph.some((id) =>
      /streamdown|[/\\]@atira[/+](?:components|blocks)(?:[/\\]|@)|[/\\]providers?[/\\]|[/\\]zod(?:[/\\]|$)|[/\\]Zod(?:[/\\]|$)/i.test(
        id,
      ),
    )
  )
    throw new Error(
      'Button leaf module graph crossed a component/block/provider/Zod boundary',
    )

  const vitePort = await freePort()
  const preview = spawn(
    process.execPath,
    [
      join(vite, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(vitePort),
    ],
    { cwd: vite, stdio: 'ignore' },
  )
  let browser
  let viteThemeColors
  try {
    await ready(`http://127.0.0.1:${vitePort}`, 'Vite preview')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${vitePort}`)
    const button = page.getByRole('button', { name: 'Check integration' })
    const background = await button.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    if (background !== 'rgb(12, 34, 56)')
      throw new Error(`Host xstyle did not override library CSS: ${background}`)
    if (
      (await button.evaluate((element) => getComputedStyle(element).color)) !==
      'rgb(210, 220, 230)'
    )
      throw new Error('Dynamic StyleX variable was not applied')
    if (!(await button.getAttribute('class'))?.includes('consumer-class'))
      throw new Error('Consumer className was not preserved')
    if (
      (await button.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      )) !== '3px'
    )
      throw new Error('Consumer inline style was not preserved')
    await button.click()
    await page.getByRole('button', { name: 'Verified' }).waitFor()
    await page.getByRole('combobox', { name: 'Model' }).click()
    const popup = page.locator('[data-slot="select-picker-popup"]')
    await popup.waitFor()
    if (
      (await popup.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      )) === 'rgba(0, 0, 0, 0)'
    )
      throw new Error('Scoped select popup CSS was not applied')
    await page.getByRole('option', { name: 'Deep' }).click()
    await page.getByText('deep', { exact: true }).waitFor()
    viteThemeColors = await page
      .getByRole('button', { name: 'Theme sample' })
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return { backgroundColor: style.backgroundColor, color: style.color }
      })
  } finally {
    await browser?.close()
    await stopServer(preview)
  }

  const source = join(temporary, 'source-export')
  run(
    process.execPath,
    [join(root, 'scripts/export-library.mjs'), source],
    root,
  )
  const sourceHost = source
  await cp(join(fixtures, 'source'), sourceHost, { recursive: true })
  await json(join(sourceHost, 'package.json'), {
    name: 'source-consumer',
    private: true,
    type: 'module',
    scripts: { build: 'tsc --noEmit && vite build' },
    dependencies: {
      '@atira/foundations': 'workspace:*',
      '@atira/primitives': 'workspace:*',
      '@stylexjs/stylex': '0.19.0',
      '@stylexjs/unplugin': '0.19.0',
      '@vitejs/plugin-react': '6.1.1',
      '@types/react': '19.2.18',
      '@types/react-dom': '19.2.5',
      react: '19.2.8',
      'react-dom': '19.2.8',
      typescript: '5.9.3',
      vite: '8.2.2',
    },
  })
  run('pnpm', ['install'], source)
  run('pnpm', ['build'], sourceHost)
  const sourcePort = await freePort()
  const sourcePreview = spawn(
    process.execPath,
    [
      join(sourceHost, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(sourcePort),
    ],
    { cwd: sourceHost, stdio: 'ignore' },
  )
  let sourceBrowser
  try {
    await ready(`http://127.0.0.1:${sourcePort}`, 'source export preview')
    sourceBrowser = await chromium.launch({ headless: true })
    const page = await sourceBrowser.newPage()
    await page.goto(`http://127.0.0.1:${sourcePort}`)
    const button = page.getByRole('button', { name: 'Source check' })
    const colors = await button.evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }))
    if (
      colors.backgroundColor !== 'rgb(23, 45, 67)' ||
      colors.color !== 'rgb(210, 220, 230)'
    )
      throw new Error(
        `Source host StyleX/theme CSS was not compiled: ${JSON.stringify(colors)}`,
      )
    await button.click()
    await page.getByRole('button', { name: 'Source verified' }).waitFor()
  } finally {
    await sourceBrowser?.close()
    await stopServer(sourcePreview)
  }

  const next = join(temporary, 'next')
  await cp(join(fixtures, 'next'), next, { recursive: true })
  await json(join(next, 'package.json'), {
    private: true,
    scripts: { build: 'next build', start: 'next start' },
    dependencies: {
      '@atira/foundations': `file:${tarballs[0]}`,
      '@atira/primitives': `file:${tarballs[1]}`,
      '@stylexjs/stylex': '0.19.0',
      '@types/react': '19.2.18',
      '@types/react-dom': '19.2.5',
      next: '15.5.9',
      react: '19.2.8',
      'react-dom': '19.2.8',
      typescript: '5.9.3',
    },
  })
  await workspace(next, tarballs)
  run('pnpm', ['install'], next)
  run('pnpm', ['build'], next)
  const nextPort = await freePort()
  const nextServer = spawn(
    process.execPath,
    [
      join(next, 'node_modules/next/dist/bin/next'),
      'start',
      '-H',
      '127.0.0.1',
      '-p',
      String(nextPort),
    ],
    { cwd: next, stdio: 'ignore' },
  )
  let nextBrowser
  try {
    await ready(`http://127.0.0.1:${nextPort}`, 'built Next server')
    nextBrowser = await chromium.launch({ headless: true })
    const page = await nextBrowser.newPage()
    await page.goto(`http://127.0.0.1:${nextPort}`)
    const button = page.getByRole('button', { name: 'Theme sample' })
    const nextThemeColors = await button.evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }))
    if (
      nextThemeColors.backgroundColor === 'rgba(0, 0, 0, 0)' ||
      JSON.stringify(nextThemeColors) !== JSON.stringify(viteThemeColors)
    )
      throw new Error(
        `Next did not receive the packed dark theme CSS; Vite=${JSON.stringify(viteThemeColors)} Next=${JSON.stringify(nextThemeColors)}`,
      )
    await button.click()
    await page.getByRole('button', { name: 'Hydrated' }).waitFor()
  } finally {
    await nextBrowser?.close()
    await stopServer(nextServer)
  }
  console.log(
    'Verified packed Vite module boundaries/CSS/interactions, source-export StyleX consumption, and built Next hydration/dark-theme CSS',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
