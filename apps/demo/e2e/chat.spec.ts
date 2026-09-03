import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const viewport = '[data-slot="timeline-viewport"]'

test('preserves detached scroll and history anchors', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(18)

  await page.locator(viewport).evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'detached',
  )

  const beforeAppend = await page.locator(viewport).evaluate((element) => element.scrollTop)
  await dispatch(page, 'pretty-amped:append-turn')
  await expect(page.getByRole('button', { name: '1 new · Jump to latest' })).toBeVisible()
  await expect.poll(() => page.locator(viewport).evaluate((element) => element.scrollTop)).toBe(
    beforeAppend,
  )

  const anchor = await firstVisibleTurn(page)
  await page.getByRole('button', { name: 'Load earlier messages' }).evaluate((button) =>
    button.click(),
  )
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(31)
  const restored = await turnTop(page, anchor.id)
  expect(Math.abs(restored - anchor.top)).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: /Jump to latest/ }).click()
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'following',
  )
})

test('submits, queues, stops, edits, and restores a reverted prompt', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })

  await message.fill('Start a deterministic response')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible()

  await message.fill('Review this after the active response')
  await page.getByRole('button', { name: 'Queue' }).click()
  const queue = page.locator('[data-slot="queue-list"]')
  await expect(queue).toContainText('Review this after the active response')
  await queue.getByRole('button', { name: 'Edit' }).click()
  await expect(message).toHaveValue('Review this after the active response')
  await expect(queue).toHaveCount(0)

  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('[data-slot="turn"]').last()).toHaveAttribute(
    'data-state',
    'interrupted',
  )
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  await page.getByRole('button', { name: 'Revert prompt fixture-turn:17' }).click()
  await expect(page.locator('[data-slot="revert-dock"]')).toBeVisible()
  await page.getByRole('button', { name: 'Edit prompt' }).click()
  await expect(message).toHaveValue('Fixture prompt 18')
})

test('restores composer focus, draft, and selection around requests', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })
  await message.fill('Draft remains intact')
  await message.press('Home')
  await expect.poll(() => selectionStart(message)).toBe(0)
  for (let offset = 0; offset < 6; offset += 1) {
    await message.press('ArrowRight')
    await expect.poll(() => selectionStart(message)).toBe(offset + 1)
  }

  await dispatch(page, 'pretty-amped:request-permission')
  const permission = page.locator('[data-slot="permission-prompt"]')
  await expect(permission).toHaveAttribute('data-origin-session-id', 'fixture-child')
  await expect(page.getByRole('heading', { name: 'Allow preview publishing?' })).toBeFocused()
  await page.getByRole('button', { name: 'Allow once' }).click()
  await expect(message).toBeFocused()
  await expect(message).toHaveValue('Draft remains intact')
  await expect.poll(() => selectionStart(message)).toBe(6)

  await dispatch(page, 'pretty-amped:request-question')
  await page.getByRole('radio', { name: 'Compact' }).click()
  await page.getByRole('textbox', { name: 'Review notes' }).fill('Keep the exact IDs.')
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.locator('[data-slot="question-request"]')).toHaveCount(0)
  await expect(message).toHaveValue('Draft remains intact')
})

test('bounds the stress fixture and keeps the composer responsive', async ({ page }) => {
  await page.goto('/?fixture=stress')
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-virtualized',
    'true',
  )
  await expect.poll(() => page.locator('[data-slot="turn"]').count()).toBeLessThanOrEqual(30)

  const markdown = page.locator('[data-source-length]').last()
  expect(Number(await markdown.getAttribute('data-source-length'))).toBeGreaterThanOrEqual(
    200_000,
  )
  expect(await page.locator('body *').count()).toBeLessThan(1_000)

  const message = page.getByRole('textbox', { name: 'Message' })
  const startedAt = Date.now()
  await dispatch(page, 'pretty-amped:burst-deltas', 1_000)
  await message.fill('Responsive after a delta burst')
  await expect(message).toHaveValue('Responsive after a delta burst')
  expect(Date.now() - startedAt).toBeLessThan(1_000)
})

for (const scenario of [
  { name: 'dark reduced-motion', url: '/?fixture=workflow&theme=dark' },
  { name: 'RTL', url: '/?fixture=workflow&dir=rtl' },
] as const) {
  test(`has no serious accessibility violations in ${scenario.name}`, async ({ page }) => {
    await page.emulateMedia({
      colorScheme: scenario.name.startsWith('dark') ? 'dark' : 'light',
      forcedColors: scenario.name === 'RTL' ? 'active' : 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(scenario.url)
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations.filter((violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([])
  })
}

test('reflows without page overflow at mobile width', async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 320 })
  await page.goto('/?fixture=workflow')
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
})

async function dispatch(page: Page, name: string, detail?: number) {
  await page.evaluate(
    ({ detail, name }) =>
      window.dispatchEvent(
        detail === undefined
          ? new Event(name)
          : new CustomEvent(name, { detail }),
      ),
    { detail, name },
  )
}

async function firstVisibleTurn(page: Page) {
  return page.locator(viewport).evaluate((element) => {
    const viewportTop = element.getBoundingClientRect().top
    const turn = Array.from(element.querySelectorAll<HTMLElement>('[data-turn-id]')).find(
      (item) => item.getBoundingClientRect().bottom > viewportTop,
    )
    if (!turn?.dataset.turnId) throw new Error('No visible turn')
    return { id: turn.dataset.turnId, top: turn.getBoundingClientRect().top }
  })
}

async function turnTop(page: Page, id: string) {
  return page.locator(`[data-turn-id="${id}"]`).evaluate((element) =>
    element.getBoundingClientRect().top,
  )
}

async function selectionStart(locator: ReturnType<Page['getByRole']>) {
  return locator.evaluate((element) => (element as HTMLTextAreaElement).selectionStart)
}
