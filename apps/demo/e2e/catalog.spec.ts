import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

for (const width of [390, 1280]) {
  test(`the default catalog shows all examples without a sidebar at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(
      page.getByRole('heading', {
        name: 'Build agent interfaces with React and StyleX.',
      }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('region', { name: 'Component gallery', exact: true }),
    ).toBeVisible()
    const example = page.getByRole('article', { name: 'Button', exact: true })
    await expect(example).toHaveCSS('box-shadow', /0px 2px 4px 0px$/)
    await page.mouse.move(width / 2, 400)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300)
    expect(
      (await page
        .getByRole('navigation', { name: 'Component categories' })
        .boundingBox())!.y,
    ).toBe(0)
    await page.mouse.wheel(0, -1_000)
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    await expect(
      page.getByRole('navigation', { name: 'Components', exact: true }),
    ).toHaveCount(0)
    expect((await page.getByRole('main').boundingBox())!.x).toBe(0)
    await expect(
      page.getByRole('combobox', { name: 'Navigate catalog' }),
    ).toHaveCount(0)
    await expect(page.locator('[data-catalog-card]')).toHaveCount(0)
    const darkButton = page.getByRole('button', {
      name: 'Dark theme',
      exact: true,
    })
    const before = await page
      .locator('[data-theme]')
      .evaluate((element) => getComputedStyle(element).backgroundColor)
    await darkButton.click()
    await expect(page.locator('[data-theme]')).toHaveAttribute(
      'data-theme',
      'dark',
    )
    await expect(example).toHaveCSS('box-shadow', /^[^,]+ 0px 0px 0px 1px$/)
    expect(
      await page
        .locator('[data-theme]')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).not.toBe(before)
    expect(
      (
        await new AxeBuilder({ page })
          .include('header')
          .include('section[aria-labelledby="library-heading"]')
          .analyze()
      ).violations,
    ).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const lightButton = page.getByRole('button', {
      name: 'Light theme',
      exact: true,
    })
    await lightButton.focus()
    await lightButton.press('Enter')
    await expect(darkButton).toBeFocused()
    await page
      .getByRole('link', { name: 'Structured output', exact: true })
      .click()
    await expect(page).toHaveURL(/#gallery-output$/)
    await expect(page.locator('#gallery-output')).toBeInViewport()
    await page
      .getByRole('link', { name: 'Live playground', exact: true })
      .click()
    await expect(page).toHaveURL(/view=playground/)
    await expect(
      page.getByRole('region', {
        name: 'Playground conversation',
        exact: true,
      }),
    ).toBeVisible()
  })
}

test('legacy All and component detail URLs still work', async ({ page }) => {
  await page.goto('/?all=true')
  await expect(
    page.getByRole('region', { name: 'Component gallery', exact: true }),
  ).toBeVisible()
  await page.goto('/?component=message')
  await expect(
    page.getByRole('heading', { name: 'Message', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Message — Atira')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('link', { name: 'Atira', exact: true }).click()
  await expect(page).not.toHaveURL(/all=true|component=/)
  await expect(
    page.getByRole('region', { name: 'Component gallery', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Components — Atira')
})

test('question outcomes resolve and reset, and displayed source remains stable', async ({
  page,
}) => {
  await page.goto('/?component=requests')
  await page.getByRole('radio', { name: /Calm/ }).first().click()
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'resolved',
  )
  await expect(
    page.getByRole('heading', { name: 'Answer submitted.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit answer' })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Reset requests' }).click()
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'pending',
  )
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'resolved',
  )
  await expect(
    page.getByRole('heading', { name: 'Question dismissed.' }),
  ).toBeVisible()

  await page.goto('/?component=composer')
  const source = await page
    .locator('section[aria-labelledby="code-heading"] code')
    .innerText()
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('A selected value')
  await expect(
    page.locator('section[aria-labelledby="code-heading"] code'),
  ).toHaveText(source)
  await expect(
    page.locator('section[aria-labelledby="code-heading"] code'),
  ).toContainText("useState('Review the component boundary.')")
})

test('installation stays available and the catalog never initializes the runtime', async ({
  page,
}) => {
  const runtimeRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/runtime'))
      runtimeRequests.push(request.url())
  })
  await page.goto('/?view=components')
  await page
    .getByRole('button', { name: 'Use the library in your app' })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Code in Export from this checkout',
      exact: true,
    }),
  ).toBeVisible()
  expect(runtimeRequests).toEqual([])
})

test('displayed examples typecheck against the public API', async ({
  page,
}) => {
  const sources = new Map<string, string>()
  for (const id of [
    'message',
    'reasoning',
    'tool-activity',
    'requests',
    'composer',
    'code-block',
  ]) {
    await page.goto(`/?component=${id}`)
    sources.set(
      resolve(`apps/demo/src/catalog-example-${id}.tsx`),
      await page
        .locator('section[aria-labelledby="code-heading"] code')
        .innerText(),
    )
  }
  const directory = await mkdtemp(join(tmpdir(), 'atira-examples-'))
  try {
    await symlink(
      resolve('apps/demo/node_modules'),
      join(directory, 'node_modules'),
      'dir',
    )
    for (const [path, source] of sources)
      await writeFile(join(directory, basename(path)), source)
    const config = join(directory, 'tsconfig.json')
    await writeFile(
      config,
      JSON.stringify({
        extends: resolve('tsconfig.base.json'),
        include: ['*.tsx'],
      }),
    )
    execFileSync('pnpm', ['exec', 'tsc', '-p', config], {
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
