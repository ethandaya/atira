import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const viewport = '[data-slot="timeline-viewport"]'

test('presents an accessible ChatGPT device sign-in flow', async ({ page }) => {
  await page.route('**/api/runtime', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { available: true, model: 'test-model', runtime: 'Anthropic' },
    })
  })
  await page.route('**/api/auth/chatgpt**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({
      contentType: 'application/json',
      json: path.endsWith('/start')
        ? {
            expiresAt: Date.now() + 900_000,
            pollAfterMs: 60_000,
            state: 'pending',
            userCode: 'ABCD-EFGH',
            verificationUrl: 'https://auth.openai.com/codex/device',
          }
        : { state: 'signed_out' },
    })
  })

  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Sign in', exact: true })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Sign in with ChatGPT' }).click()
  await expect(page.getByText('ABCD-EFGH')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue to OpenAI' })).toHaveAttribute(
    'href',
    'https://auth.openai.com/codex/device',
  )
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Waiting for authorization',
  )

  const results = await new AxeBuilder({ page })
    .include('[data-slot="dialog-content"]')
    .analyze()
  expect(results.violations).toEqual([])

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Finish sign in' })).toBeFocused()
})

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
  await expect(page.getByRole('button', { name: 'Queue' })).toHaveCount(0)

  await message.fill('Review this after the active response')
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible()
  await page.getByRole('button', { name: 'Queue' }).click()
  const queue = page.locator('[data-slot="queue-list"]')
  await expect(queue).toContainText('Review this after the active response')
  await queue.getByRole('button', { name: 'Edit' }).click()
  await expect(message).toHaveValue('Review this after the active response')
  await expect(queue).toHaveCount(0)

  await message.fill('')
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

test('keeps thinking and tool lifecycle rows geometrically stable', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  const composer = page.locator('[data-slot="chat-composer"]')
  const message = page.getByRole('textbox', { name: 'Message' })

  await message.fill('Exercise every lifecycle state')
  await page.getByRole('button', { name: 'Send' }).click()

  const turn = page.locator('[data-slot="turn"]').last()
  const status = turn.locator('[data-slot="turn-status"]')
  await expect(status).toBeVisible()
  await settleLayout(page)
  const statusBounds = await elementBounds(status)

  const reasoning = turn.locator('[data-slot="reasoning"]')
  await expect(reasoning).toHaveAttribute('data-state', 'thinking')
  await settleLayout(page)
  const reasoningBounds = await elementBounds(reasoning)
  expect(Math.abs(reasoningBounds.height - statusBounds.height)).toBeLessThanOrEqual(1)

  const tool = turn.locator('[data-slot="tool-activity"]')
  await expect(tool).toHaveAttribute('data-state', 'running')
  await settleLayout(page)
  const runningBounds = await elementBounds(tool)
  const composerTop = (await elementBounds(composer)).top

  await expect(tool).toHaveAttribute('data-state', 'succeeded')
  await settleLayout(page)
  const completedBounds = await elementBounds(tool)
  expect(Math.abs(completedBounds.top - runningBounds.top)).toBeLessThanOrEqual(1)
  expect(Math.abs(completedBounds.height - runningBounds.height)).toBeLessThanOrEqual(1)
  expect(Math.abs((await elementBounds(composer)).top - composerTop)).toBeLessThanOrEqual(1)
})

test('removes nonessential lifecycle motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?fixture=workflow')

  await page.getByRole('textbox', { name: 'Message' }).fill('Use reduced motion')
  await page.getByRole('button', { name: 'Send' }).click()

  const turn = page.locator('[data-slot="turn"]').last()
  await expect(turn.locator('[data-slot="reasoning"]')).toHaveAttribute(
    'data-state',
    'thinking',
  )
  await expect(turn.locator('[data-slot="turn-assistant-message"]')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(turn.locator('[data-slot="shimmer"]')).toHaveCSS('animation-name', 'none')

  const tool = turn.locator('[data-slot="tool-activity"]')
  await expect(tool).toHaveAttribute('data-state', 'succeeded')
  await expect(tool.locator('[data-slot="tool-state-icon"]')).toHaveCSS(
    'animation-name',
    'none',
  )
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
  const toolbar = page.locator('[data-slot="chat-composer-toolbar"]')
  const toolbarChildren = await toolbar.locator(':scope > *').evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect()
      return { bottom: bounds.bottom, top: bounds.top }
    }),
  )
  const firstCenter = (toolbarChildren[0]!.top + toolbarChildren[0]!.bottom) / 2
  const secondCenter = (toolbarChildren[1]!.top + toolbarChildren[1]!.bottom) / 2
  expect(Math.abs(firstCenter - secondCenter)).toBeLessThanOrEqual(1)

  const model = page.getByRole('combobox', { name: 'Model' })
  await expect(model).toContainText('Fixture 1')
  const leading = page.locator('[data-slot="chat-composer-context-actions"]')
  const [leadingBounds, modelBounds] = await Promise.all([
    elementBounds(leading),
    elementBounds(model),
  ])
  expect(modelBounds.left).toBeGreaterThanOrEqual(leadingBounds.left)
  expect(modelBounds.left + modelBounds.width).toBeLessThanOrEqual(
    leadingBounds.left + leadingBounds.width,
  )
  await expect(page.getByRole('combobox', { name: 'Commands' })).toBeHidden()
  await expect(page.getByRole('combobox', { name: 'References' })).toBeHidden()

  const composerActions = page.getByRole('button', { name: 'Composer actions' })
  await composerActions.click()
  await expect(page.getByRole('menuitem', { name: 'Commands' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'References' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Attach files' })).toBeVisible()
  await expect(page.getByText('Plan', { exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Commands' }).click()
  await expect(page.locator('[data-slot="filter-menu-popup"] input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused()

  await composerActions.click()
  await page.getByRole('menuitem', { name: 'Use shell mode' }).click()
  await expect(page.getByRole('textbox', { name: 'Shell command' })).toBeVisible()
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

async function elementBounds(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect()
    return {
      height: rectangle.height,
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
    }
  })
}

async function settleLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
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
