import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/chatgpt', (route) =>
    route.fulfill({ json: { state: 'authenticated' } }),
  )
})

for (const width of [390, 1280]) {
  test(`the docs shell exposes overview, playground, and components at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Build agent interfaces.' }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: 'Components', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Nanocodex', exact: true }),
    ).toHaveAttribute('href', 'https://github.com/gakonst/nanocodex')
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: 'playground', exact: true }),
    ).toHaveAttribute('href', '/playground')
    await expect(
      page.getByRole('link', {
        name: 'Linear’s migration story',
        exact: true,
      }),
    ).toHaveAttribute(
      'href',
      'https://linear.app/now/styling-linear-for-the-future-stylex',
    )
    await expect(
      page.getByRole('link', {
        name: '1,000-PR recap',
        exact: true,
      }),
    ).toHaveAttribute('href', 'https://x.com/linear/status/2092965309992861994')
    await expect(
      page.getByRole('link', { name: 'Polar’s migration', exact: true }),
    ).toHaveAttribute(
      'href',
      'https://x.com/emilwidlund/status/2066804861325217948',
    )
    await expect(
      page.getByRole('link', { name: /Conversation primitives/ }),
    ).toHaveAttribute('href', '/components#gallery-conversation')
    const docs = page.getByRole('navigation', { name: 'Documentation' })
    await expect(docs.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(docs.getByRole('link', { name: 'Playground' })).toBeVisible()
    await expect(docs.getByRole('link', { name: 'Components' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(
      0,
    )
    await page.evaluate(() => {
      Object.assign(window, { __docsNavigation: 'preserved' })
    })
    await docs.getByRole('link', { name: 'Playground' }).click()
    await expect(page).toHaveURL(/\/playground$/)
    await expect(page.getByRole('main')).toBeFocused()
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __docsNavigation?: string }).__docsNavigation,
      ),
    ).toBe('preserved')
    await expect(docs.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(
      docs.getByRole('link', { name: 'Playground' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(docs.getByRole('link', { name: 'Components' })).toBeVisible()
    if (width >= 800) {
      const search = page.getByRole('searchbox', { name: /Search components/ })
      await search.fill('Reasoning')
      await expect(docs.getByRole('link', { name: 'Reasoning' })).toHaveCount(1)
      await expect(
        docs.getByRole('link', { name: 'Button', exact: true }),
      ).toHaveCount(0)
      await search.fill('')
    } else {
      await expect(
        page.getByRole('searchbox', { name: /Search components/ }),
      ).toBeHidden()
    }
    await expect(
      page.getByRole('region', { name: 'Live playground', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'New conversation', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Conversation history', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Conversation history', exact: true })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'No saved conversations yet' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: 'Nanocodex' })).toHaveAttribute(
      'href',
      'https://github.com/gakonst/nanocodex',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true)
    await docs.getByRole('link', { name: 'Components' }).click()
    await expect(page).toHaveURL(/\/components$/)
    await expect(
      page.getByRole('region', { name: 'Component gallery', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Loading examples…')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/\/playground$/)
    await page.goForward()
    await expect(page).toHaveURL(/\/components$/)
    const example = page.getByRole('article', { name: 'Button', exact: true })
    await expect(example.getByText('API', { exact: true })).toBeVisible()
    const preview = example.locator('[data-slot="component-preview"]')
    await expect(preview).toHaveCSS('box-shadow', /0px 2px 4px 0px$/)
    const responseText =
      'Components own accessible presentation and named actions; adapters own runtime behavior.'
    const actions = page.getByRole('article', { name: 'Actions', exact: true })
    await expect(actions.getByText(responseText, { exact: true })).toBeVisible()
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(value: string) {
            Object.assign(window, { __copiedResponse: value })
            return Promise.resolve()
          },
        },
      })
    })
    await actions
      .getByRole('button', { name: 'Copy response', exact: true })
      .click()
    await expect(actions.getByRole('status')).toHaveText('Response copied.')
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __copiedResponse?: string }).__copiedResponse,
      ),
    ).toBe(responseText)
    await example.getByRole('button', { name: 'Danger', exact: true }).click()
    await expect(example.getByRole('status')).toHaveText(
      'Danger action selected',
    )
    const iconButtons = page.getByRole('article', {
      name: 'IconButton',
      exact: true,
    })
    await expect(
      iconButtons.getByRole('button', { name: 'Remove item', exact: true }),
    ).toBeDisabled()
    await iconButtons
      .getByRole('button', { name: 'Add item', exact: true })
      .click()
    await expect(iconButtons.getByRole('status')).toHaveText('1 item')
    await iconButtons
      .getByRole('button', { name: 'Remove item', exact: true })
      .click()
    await expect(iconButtons.getByRole('status')).toHaveText('0 items')
    const artifact = page.getByRole('article', {
      name: 'Artifact',
      exact: true,
    })
    await artifact
      .getByRole('button', { name: 'Open artifact', exact: true })
      .click()
    await expect(
      artifact.getByRole('region', {
        name: 'component-gallery.svg preview',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      artifact.getByRole('button', { name: 'Hide artifact', exact: true }),
    ).toBeVisible()
    const hideArtifact = artifact.getByRole('button', {
      name: 'Hide artifact',
      exact: true,
    })
    await hideArtifact.focus()
    await hideArtifact.press('Enter')
    await expect(
      artifact.getByRole('region', {
        name: 'component-gallery.svg preview',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      artifact.getByRole('button', { name: 'Open artifact', exact: true }),
    ).toBeFocused()
    const mainBounds = await page.getByRole('main').boundingBox()
    expect(mainBounds!.x).toBe(width >= 800 ? 240 : 0)
    if (width >= 800) {
      const darkButton = page.getByRole('button', {
        name: 'Dark theme',
        exact: true,
      })
      const themedShell = page.locator('[data-theme]').first()
      const before = await themedShell.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      )
      await darkButton.click()
      await expect(themedShell).toHaveAttribute('data-theme', 'dark')
      await expect(preview).toHaveCSS('box-shadow', /^[^,]+ 0px 0px 0px 1px$/)
      expect(
        await themedShell.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ).not.toBe(before)
      const lightButton = page.getByRole('button', {
        name: 'Light theme',
        exact: true,
      })
      await lightButton.focus()
      await lightButton.press('Enter')
      await expect(darkButton).toBeFocused()
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include('aside')
          .include('main')
          .disableRules(['landmark-unique'])
          .analyze()
      ).violations,
    ).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.goto('/components#gallery-output')
    await expect(page).toHaveURL(/#gallery-output$/)
    await expect(page.locator('#gallery-output')).toBeInViewport()
  })
}

test('preserves keyboard focus across skip, route, and component navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/components')
  await expect(page.getByRole('main')).toBeVisible()

  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true })
  await expect(skip).toBeFocused()
  await skip.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await page.keyboard.press('Tab')
  expect(
    await page
      .getByRole('main')
      .evaluate((main) => main.contains(document.activeElement)),
  ).toBe(true)

  await page.evaluate(() => {
    Object.assign(window, { __activeRouteState: 'preserved' })
  })
  await page
    .getByRole('navigation', { name: 'Documentation' })
    .getByRole('link', { name: 'Components', exact: true })
    .click()
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __activeRouteState?: string }).__activeRouteState,
    ),
  ).toBe('preserved')

  const buttonLink = page
    .getByRole('navigation', { name: 'Documentation' })
    .getByRole('link', { name: 'Button', exact: true })
  await buttonLink.focus()
  await buttonLink.press('Enter')
  await expect(page).toHaveURL(/#component-button$/)
  await expect(page.locator('#component-button')).toBeFocused()

  const conversationLink = page
    .getByRole('navigation', { name: 'Documentation' })
    .getByRole('link', { name: 'Conversation', exact: true })
  await conversationLink.focus()
  await conversationLink.press('Enter')
  await expect(page).toHaveURL(/#gallery-conversation$/)
  await expect(
    page.getByRole('heading', { name: 'Conversation', exact: true }),
  ).toBeFocused()

  await page.goto('/components#%')
  await expect(
    page.getByRole('heading', { name: 'Components', exact: true }),
  ).toBeVisible()

  await page.goto('/components#component-permissionrequest')
  await expect(page.locator('#component-permissionrequest')).toBeFocused()

  await page.goto('/components#component-chatcomposer')
  await expect(page.locator('#component-chatcomposer')).toBeFocused()
})

test('gallery examples preserve focus when actions replace their controls', async ({
  page,
}) => {
  await page.goto('/components')

  const permission = page.getByRole('article', {
    name: 'PermissionPrompt',
    exact: true,
  })
  const reject = permission.getByRole('button', { name: 'Reject', exact: true })
  await reject.focus()
  await reject.press('Enter')
  await expect(
    permission.locator('[data-example-focus-target="permission-result"]'),
  ).toBeFocused()

  const question = page.getByRole('article', {
    name: 'QuestionRequest',
    exact: true,
  })
  await question.getByRole('radio', { name: /Calm/ }).click()
  await question.getByRole('button', { name: 'Next', exact: true }).click()
  const submit = question.getByRole('button', {
    name: 'Submit answer',
    exact: true,
  })
  await submit.focus()
  await submit.press('Enter')
  await expect(
    question.locator('[data-example-focus-target="question-result"]'),
  ).toBeFocused()

  const docks = page.getByRole('article', {
    name: 'TodoDock and RevertDock',
    exact: true,
  })
  const edit = docks.getByRole('button', { name: 'Edit prompt', exact: true })
  await edit.focus()
  await edit.press('Enter')
  await expect(
    docks.getByRole('textbox', { name: 'Message', exact: true }),
  ).toBeFocused()

  await page.reload()
  const restoredDocks = page.getByRole('article', {
    name: 'TodoDock and RevertDock',
    exact: true,
  })
  const dismiss = restoredDocks.getByRole('button', {
    name: 'Dismiss',
    exact: true,
  })
  await dismiss.focus()
  await dismiss.press('Enter')
  await expect(restoredDocks.getByRole('status')).toBeFocused()

  const queue = page.getByRole('article', { name: 'QueueList', exact: true })
  const editQueued = queue
    .getByRole('button', { name: 'Edit', exact: true })
    .first()
  await editQueued.focus()
  await editQueued.press('Enter')
  await expect(
    queue.getByRole('textbox', { name: 'Message', exact: true }),
  ).toBeFocused()

  const retry = queue.getByRole('button', { name: 'Retry', exact: true })
  await retry.focus()
  await retry.press('Enter')
  const queueStatus = queue.locator(
    '[data-example-focus-target="queue-status"]',
  )
  await expect(queueStatus).toBeFocused()
  await expect(queueStatus).toHaveText('Queued prompt queued for retry.')

  const retriedItem = queue.getByRole('listitem').filter({
    hasText: 'Retry the visual check.',
  })
  const remove = retriedItem.getByRole('button', {
    name: 'Remove',
    exact: true,
  })
  await remove.focus()
  await remove.press('Enter')
  await expect(queueStatus).toBeFocused()
  await expect(queueStatus).toHaveText('Queued prompt removed.')
})

test('keeps a multiline playground composer usable in a short mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await page.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
        available: true,
        model: 'test',
        runtime: 'Test runtime',
      },
    }),
  )
  await page.route('**/api/auth/chatgpt', (route) =>
    route.fulfill({ json: { state: 'authenticated' } }),
  )
  await page.goto('/playground')
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('First line\nSecond line\nThird line\nFourth line')

  const composer = page.locator('[data-slot="chat-composer"]')
  const send = page.getByRole('button', { name: 'Send', exact: true })
  await expect(send).toBeEnabled()
  const [composerBounds, sendBounds] = await Promise.all([
    composer.boundingBox(),
    send.boundingBox(),
  ])
  expect(composerBounds).not.toBeNull()
  expect(sendBounds).not.toBeNull()
  expect(composerBounds!.y).toBeGreaterThanOrEqual(0)
  expect(composerBounds!.y + composerBounds!.height).toBeLessThanOrEqual(667)
  expect(sendBounds!.y + sendBounds!.height).toBeLessThanOrEqual(667)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true)
})

test('component detail routes return to the overview', async ({ page }) => {
  await page.goto('/components/message')
  await expect(
    page.getByRole('heading', { name: 'Message', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Message — Atira')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('link', { name: 'Atira', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('heading', { name: 'Build agent interfaces.' }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Overview — Atira')
})

test('question outcomes resolve and reset, and displayed source remains stable', async ({
  page,
}) => {
  await page.goto('/components/requests')
  const denyPermission = page.getByRole('button', { name: 'Deny', exact: true })
  await denyPermission.focus()
  await denyPermission.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Allow this external action?' }),
  ).toBeFocused()

  await page.getByRole('radio', { name: /Calm/ }).first().click()
  const submitAnswer = page.getByRole('button', { name: 'Submit answer' })
  await submitAnswer.focus()
  await submitAnswer.press('Enter')
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'resolved',
  )
  await expect(
    page.getByRole('heading', { name: 'Answer submitted.' }),
  ).toBeFocused()
  await expect(page.getByRole('button', { name: 'Submit answer' })).toHaveCount(
    0,
  )
  const reset = page.getByRole('button', { name: 'Reset requests' })
  await reset.focus()
  await reset.press('Enter')
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'pending',
  )
  await expect(page.getByRole('button', { name: 'Deny' })).toBeFocused()
  const dismissQuestion = page.getByRole('button', { name: 'Dismiss' })
  await dismissQuestion.focus()
  await dismissQuestion.press('Enter')
  await expect(page.locator('[data-slot="question-request"]')).toHaveAttribute(
    'data-state',
    'resolved',
  )
  await expect(
    page.getByRole('heading', { name: 'Question dismissed.' }),
  ).toBeFocused()

  await page.goto('/components/composer')
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

test('the component catalog never initializes the runtime', async ({
  page,
}) => {
  const runtimeRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/runtime'))
      runtimeRequests.push(request.url())
  })
  await page.goto('/components')
  await expect(
    page.getByRole('heading', { name: 'Foundations and primitives' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Use the library in your app' }),
  ).toHaveCount(0)
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
    await page.goto(`/components/${id}`)
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
