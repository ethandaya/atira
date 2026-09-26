import { expect, test } from '@playwright/test'

import {
  elementBounds,
  expectComposerInViewport,
  routeRuntime,
  settleLayout,
  textMetrics,
} from './chat-test-helpers'

const viewport = '[data-slot="timeline-viewport"]'

test('fades only overflowing tool labels and follows reading direction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?fixture=workflow')
  const prompt =
    'Audit streaming response accessibility and keyboard navigation'
  await page.getByRole('textbox', { name: 'Message' }).fill(prompt)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const turn = page.locator('[data-slot="turn"]').last()
  await expect(turn).toHaveAttribute('data-state', 'complete')
  const label = turn.locator('[data-slot="tool-activity-summary"]')
  await expect(label).toHaveAttribute('data-overflowing', 'true')
  await expect(label).toHaveCSS('mask-image', /to right/)
  await expect(
    turn.getByRole('button', { name: new RegExp(prompt) }),
  ).toBeVisible()
  await expect(
    page
      .locator('[data-slot="tool-activity-summary"]')
      .filter({ hasText: 'Custom tool' }),
  ).toHaveCSS('mask-image', 'none')

  await page.setViewportSize({ width: 1100, height: 800 })
  await expect(label).not.toHaveAttribute('data-overflowing', 'true')
  await expect(label).toHaveCSS('mask-image', 'none')
  await page.setViewportSize({ width: 390, height: 844 })
  await label.evaluate((element) => {
    element.closest('[dir]')!.setAttribute('dir', 'rtl')
  })
  await expect(label).toHaveCSS('mask-image', /to left/)
})

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`updates accessible lifecycle text immediately during state fades (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/?fixture=workflow')
    await page
      .getByRole('textbox', { name: 'Message' })
      .fill('Exercise text transitions')
    const samples = await page
      .getByRole('button', { name: 'Send', exact: true })
      .evaluate(async (button) => {
        button.click()
        const values: {
          text: string
          opacity: number
          currentLabels: number
          stale: boolean
        }[] = []
        const start = performance.now()
        while (performance.now() - start < 3500) {
          await new Promise(requestAnimationFrame)
          const turn = Array.from(
            document.querySelectorAll('[data-slot="turn"]'),
          ).at(-1)
          for (const label of turn?.querySelectorAll<HTMLElement>(
            '[data-slot="reasoning-summary"], [data-slot="tool-activity-summary"]',
          ) ?? []) {
            const current = label.querySelectorAll<HTMLElement>(
              '[data-text-state]:not([aria-hidden="true"])',
            )
            const text = (current[0] ?? label).textContent ?? ''
            values.push({
              text,
              opacity: Number(getComputedStyle(current[0] ?? label).opacity),
              currentLabels: current.length,
              stale:
                label
                  .closest('[data-slot="reasoning"]')
                  ?.getAttribute('data-state') === 'complete' &&
                text === 'Thinking',
            })
          }
        }
        return values
      })
    expect(samples.length).toBeGreaterThan(0)
    expect(
      samples.every((sample) => sample.currentLabels <= 1 && !sample.stale),
    ).toBe(true)
    if (reducedMotion === 'reduce')
      expect(samples.every((sample) => sample.opacity === 1)).toBe(true)
    else expect(samples.some((sample) => sample.opacity < 1)).toBe(true)
    expect(samples.some((sample) => sample.text.includes('Thought for'))).toBe(
      true,
    )
    expect(samples.some((sample) => sample.text.includes('Search'))).toBe(true)
  })
}

test('keeps thinking and tool lifecycle rows geometrically stable', async ({
  page,
}) => {
  await routeRuntime(page, {
    available: true,
    model: 'test',
    runtime: 'Test',
  })
  await page.addInitScript(() => {
    const original = window.fetch
    window.fetch = async (input, options) => {
      if (input !== '/api/chat') return original(input, options)
      return new Response(
        new ReadableStream({
          start(controller) {
            window.addEventListener('lifecycle-event', (event) => {
              controller.enqueue(
                new TextEncoder().encode(
                  `${JSON.stringify((event as CustomEvent).detail)}\n`,
                ),
              )
            })
          },
        }),
        { headers: { 'Content-Type': 'application/x-ndjson' } },
      )
    }
  })
  const emit = (detail: object) =>
    page.evaluate((value) => {
      window.dispatchEvent(
        new CustomEvent('lifecycle-event', { detail: value }),
      )
    }, detail)
  await page.goto('/playground')
  const composer = page.locator('[data-slot="chat-composer"]')
  const message = page.getByRole('textbox', { name: 'Message' })

  await message.fill('Exercise every lifecycle state')
  await page.getByRole('button', { name: 'Send' }).click()

  const turn = page.locator('[data-slot="turn"]').last()
  const status = turn.locator('[data-slot="turn-status"]')
  await expect(status.locator('[data-slot="spinner"]')).toBeVisible()
  await settleLayout(page)
  const statusBounds = await elementBounds(status)
  const statusTypography = await textMetrics(status)

  await emit({ type: 'reasoning-delta', text: 'Checking the interaction.' })
  const reasoning = turn.locator('[data-slot="reasoning"]')
  await expect(reasoning).toHaveAttribute('data-state', 'thinking')
  await expect(reasoning.locator('[data-slot="spinner"]')).toBeVisible()
  await expect
    .poll(() =>
      textMetrics(reasoning.locator('[data-slot="reasoning-summary"]')),
    )
    .toEqual(statusTypography)
  await settleLayout(page)
  const activityBounds = await elementBounds(
    turn.locator('[data-slot="activity-sequence"]'),
  )
  expect(
    Math.abs(activityBounds.height - statusBounds.height),
  ).toBeLessThanOrEqual(1)

  await emit({
    type: 'tool-started',
    id: 'check',
    tool: 'inspect_component_catalog',
    input: 'interaction',
    summary: 'Checking components',
  })
  const tool = turn.locator('[data-slot="tool-activity"]')
  await expect(tool).toHaveAttribute('data-state', 'running')
  await expect(tool.locator('[data-slot="spinner"]')).toBeVisible()
  await expect(
    reasoning.locator('[data-slot="reasoning-state-icon"]'),
  ).toBeVisible()
  expect(
    await textMetrics(reasoning.locator('[data-slot="reasoning-summary"]')),
  ).toEqual(statusTypography)
  // Compare resting geometry, not an intermediate entrance/layout frame.
  await expect
    .poll(() =>
      tool.evaluate((element) => {
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (
            parent.hasAttribute('data-activity-presence') &&
            getComputedStyle(parent).transform !== 'none'
          )
            return false
          if (parent.getAttribute('data-slot') === 'turn') break
        }
        return true
      }),
    )
    .toBe(true)
  await settleLayout(page)
  const runningBounds = await elementBounds(tool)
  const viewport = page.locator('[data-slot="timeline-viewport"]')
  const runningScroll = await viewport.evaluate((element) => element.scrollTop)
  const composerTop = (await elementBounds(composer)).top

  await emit({
    type: 'tool-completed',
    id: 'check',
    tool: 'inspect_component_catalog',
    status: 'succeeded',
    output: 'Checked.',
    summary: 'Checked components',
  })
  await expect(tool).toHaveAttribute('data-state', 'succeeded')
  await settleLayout(page)
  const completedBounds = await elementBounds(tool)
  // Following the new pending row may scroll the viewport, not move the result in the transcript.
  const completedScroll = await viewport.evaluate(
    (element) => element.scrollTop,
  )
  expect(
    Math.abs(
      completedBounds.top + completedScroll - runningBounds.top - runningScroll,
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(completedBounds.height - runningBounds.height),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs((await elementBounds(composer)).top - composerTop),
  ).toBeLessThanOrEqual(1)
})

test('removes nonessential lifecycle motion when reduced motion is requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?fixture=workflow')

  await page
    .getByRole('textbox', { name: 'Message' })
    .fill('Use reduced motion')
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
  await expect(turn.locator('[data-slot="spinner"]')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(turn.locator('[data-slot="shimmer"]')).toHaveCount(0)

  const tool = turn.locator('[data-slot="tool-activity"]')
  await expect(tool).toHaveAttribute('data-state', 'succeeded')
  await expect(tool.locator('[data-slot="tool-state-icon"]')).toHaveCSS(
    'animation-name',
    'none',
  )
})

test('only offers jump to latest when detached content extends below the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 16000 })
  await page.goto('/?fixture=workflow')
  const trigger = page
    .locator('[data-renderer="task"]')
    .getByRole('button', { name: /Review agent · Review the chat surface/ })
  await trigger.click()
  await settleLayout(page)
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'detached',
  )
  expect(
    await page
      .locator(viewport)
      .evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBe(0)
  await expect(
    page.getByRole('button', { name: /Jump to latest/ }),
  ).toHaveCount(0)

  await page.setViewportSize({ width: 1100, height: 720 })
  await expect(
    page.getByRole('button', { name: /Jump to latest/ }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1100, height: 16000 })
  await expect(
    page.getByRole('button', { name: /Jump to latest/ }),
  ).toHaveCount(0)
})

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1100]) {
    test(`fades only overflowing transcript edges (${theme}, ${width})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/?fixture=workflow&theme=${theme}`)
      const scroll = page.locator(viewport)
      await expect(scroll).toHaveAttribute('data-overflow-start', 'true')
      await expect(scroll).not.toHaveAttribute('data-overflow-end')
      await scroll.evaluate((element) => {
        element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
      })
      await expect(scroll).toHaveAttribute('data-overflow-start', 'true')
      await expect(scroll).toHaveAttribute('data-overflow-end', 'true')
      await expect(scroll).not.toHaveCSS('mask-image', 'none')
      await expect(page.locator('[data-slot="chat-composer"]')).toHaveCSS(
        'mask-image',
        'none',
      )
      const jump = page.getByRole('button', { name: /Jump to latest/ })
      await expect(jump).toBeVisible()
      await expect(page.locator('[data-slot="jump-to-latest"]')).toHaveCSS(
        'mask-image',
        'none',
      )
      await page.screenshot({
        path: test.info().outputPath('scroll-edges.png'),
      })
      await scroll.evaluate((element) => {
        element.scrollTop = 0
      })
      await expect(scroll).not.toHaveAttribute('data-overflow-start')
      await expect(scroll).toHaveAttribute('data-overflow-end', 'true')
      await jump.click()
      await expect(scroll).toHaveAttribute('data-overflow-start', 'true')
      await expect(scroll).not.toHaveAttribute('data-overflow-end')
      await expect(jump).toHaveCount(0)
      await page.setViewportSize({ width, height: 16000 })
      await expect(scroll).not.toHaveAttribute('data-overflow-start')
      await expect(scroll).not.toHaveAttribute('data-overflow-end')
      await expect(scroll).toHaveCSS('mask-image', 'none')
    })
  }
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
  const toolbarChildren = await toolbar
    .locator(':scope > *')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect()
        return { bottom: bounds.bottom, top: bounds.top }
      }),
    )
  const firstCenter = (toolbarChildren[0]!.top + toolbarChildren[0]!.bottom) / 2
  const secondCenter =
    (toolbarChildren[1]!.top + toolbarChildren[1]!.bottom) / 2
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
  await expect(
    page.getByRole('menuitem', { name: 'Attach files' }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'Use Plan agent' }),
  ).toBeVisible()
  await page.getByRole('menuitem', { name: 'Commands' }).click()
  await expect(
    page.locator('[data-slot="filter-menu-popup"] input'),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused()

  await composerActions.click()
  await page.getByRole('menuitem', { name: 'Use shell mode' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Shell command' }),
  ).toBeVisible()
  await expectComposerInViewport(page)
})
