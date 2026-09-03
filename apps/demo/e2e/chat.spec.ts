import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const viewport = '[data-slot="timeline-viewport"]'

test('preserves detached scroll and history anchors', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(18)
  await expectComposerInViewport(page)

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

test('uses commands, references, and every attachment input path', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })

  await page.getByRole('combobox', { name: 'Commands' }).click()
  const commandInput = page.locator('[data-slot="filter-menu-popup"] input')
  await commandInput.fill('audit')
  await commandInput.press('Enter')
  await expect(message).toHaveValue('/audit ')

  await page.getByRole('combobox', { name: 'References' }).click()
  const referenceInput = page.locator('[data-slot="filter-menu-popup"] input')
  await referenceInput.fill('demo')
  await referenceInput.press('Enter')
  await expect(page.locator('[data-reference-type="file"]')).toContainText(
    '@apps/demo/src/app.tsx',
  )

  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('picker'),
    mimeType: 'text/plain',
    name: 'picker.txt',
  })
  await addClipboardFile(message, 'pasted.txt', 'pasted')
  await addDroppedFile(page, 'dropped.txt', 'dropped')
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('retry'),
    mimeType: 'text/plain',
    name: 'retry.blocked',
  })

  const attachments = page.locator('[data-slot="attachment-tray"] li')
  await expect(attachments).toHaveCount(4)
  await expect(attachments).toContainText([
    'picker.txt',
    'pasted.txt',
    'dropped.txt',
    'retry.blocked',
  ])
  const failed = attachments.filter({ hasText: 'retry.blocked' })
  await expect(failed).toHaveAttribute('data-state', 'failed')
  await failed.getByRole('button', { name: 'Retry' }).click()
  await expect(failed).toHaveAttribute('data-state', 'ready')
  await attachments.filter({ hasText: 'picker.txt' }).getByRole('button', { name: 'Remove' }).click()
  await expect(attachments).toHaveCount(3)
})

test('selects every built-in tool renderer and the generic fallback', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  const renderers = page.locator('[data-slot="tool-renderer"]')
  await expect(renderers).toHaveCount(7)
  expect(
    await renderers.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-renderer')),
    ),
  ).toEqual([
    'context',
    'shell',
    'file-change',
    'task',
    'web',
    'skill',
    'generic',
  ])
  await expect(page.locator('[data-renderer="generic"]')).toHaveAttribute(
    'data-tool-kind',
    'generic',
  )
})

test('bounds the stress fixture and keeps the composer responsive', async ({ page }, testInfo) => {
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
  const notificationCount = await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __prettyAmpedFixtureMetrics: FixtureMetrics
      }
    ).__prettyAmpedFixtureMetrics
    metrics.commitDurations.length = 0
    metrics.longTasks = []
    metrics.longTaskObserver = new PerformanceObserver((list) => {
      metrics.longTasks?.push(...list.getEntries().map((entry) => entry.duration))
    })
    metrics.longTaskObserver.observe({ type: 'longtask' })
    return metrics.getNotificationCount()
  })
  const startedAt = Date.now()
  await dispatch(page, 'pretty-amped:burst-deltas', 1_000)
  await expect.poll(() => fixtureNotificationCount(page)).toBe(notificationCount + 1)
  await message.fill('Responsive after a delta burst')
  await expect(message).toHaveValue('Responsive after a delta burst')
  expect(Date.now() - startedAt).toBeLessThan(1_000)
  await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __prettyAmpedFixtureMetrics: FixtureMetrics
      }
    ).__prettyAmpedFixtureMetrics
    metrics.commitDurations.length = 0
  })
  for (let sample = 0; sample < 20; sample += 1) {
    const before = await fixtureNotificationCount(page)
    await dispatch(page, 'pretty-amped:burst-deltas', 1)
    await expect.poll(() => fixtureNotificationCount(page)).toBe(before + 1)
  }
  const performance = await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __prettyAmpedFixtureMetrics: FixtureMetrics
      }
    ).__prettyAmpedFixtureMetrics
    metrics.longTaskObserver?.disconnect()
    return {
      commitDurations: metrics.commitDurations,
      longTasks: metrics.longTasks ?? [],
    }
  })
  const report = {
    browser: await page.evaluate(() => navigator.userAgent),
    cpuThrottle: '1×',
    fixture: 'stress-v1',
    longTaskMaximum: Math.max(0, ...performance.longTasks),
    reactCommitP95: percentile(performance.commitDurations, 0.95),
    sampleCount: performance.commitDurations.length,
  }
  await testInfo.attach('stress-performance.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  })
  expect(report.sampleCount).toBeGreaterThanOrEqual(20)
  expect(report.reactCommitP95).toBeLessThan(16)
  expect(report.longTaskMaximum).toBeLessThan(50)
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
  await expectComposerInViewport(page)
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

async function addClipboardFile(
  locator: ReturnType<Page['getByRole']>,
  name: string,
  contents: string,
) {
  await locator.evaluate(
    (element, { contents, name }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([contents], name, { type: 'text/plain' }))
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          clipboardData: transfer,
        }),
      )
    },
    { contents, name },
  )
}

async function addDroppedFile(page: Page, name: string, contents: string) {
  await page.locator('[data-slot="chat-composer"]').evaluate(
    (element, { contents, name }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([contents], name, { type: 'text/plain' }))
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          dataTransfer: transfer,
        }),
      )
    },
    { contents, name },
  )
}

type FixtureMetrics = {
  commitDurations: number[]
  getNotificationCount: () => number
  longTasks?: number[]
  longTaskObserver?: PerformanceObserver
}

async function fixtureNotificationCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __prettyAmpedFixtureMetrics: FixtureMetrics
        }
      ).__prettyAmpedFixtureMetrics.getNotificationCount(),
  )
}

function percentile(values: readonly number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0
}

async function expectComposerInViewport(page: Page) {
  const bounds = await page.locator('[data-slot="chat-composer"]').evaluate((element) => {
    const rectangle = element.getBoundingClientRect()
    return { bottom: rectangle.bottom, top: rectangle.top, viewportHeight: innerHeight }
  })
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight)
}
