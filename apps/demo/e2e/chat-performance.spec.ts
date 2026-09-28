import { expect, test, type Page } from '@playwright/test'

import { dispatch } from './chat-test-helpers'

test('bounds the stress fixture and keeps the composer responsive', async ({
  page,
}, testInfo) => {
  await page.goto('/?fixture=stress')
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-virtualized',
    'true',
  )
  await expect
    .poll(() => page.locator('[data-slot="turn"]').count())
    .toBeLessThanOrEqual(30)

  const markdown = page.locator('[data-source-length]').last()
  expect(
    Number(await markdown.getAttribute('data-source-length')),
  ).toBeGreaterThanOrEqual(200_000)
  expect(await page.locator('body *').count()).toBeLessThan(1_000)

  const message = page.getByRole('textbox', { name: 'Message' })
  const notificationCount = await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __atiraFixtureMetrics: FixtureMetrics
      }
    ).__atiraFixtureMetrics
    metrics.commitDurations.length = 0
    metrics.longTasks = []
    metrics.longTaskObserver = new PerformanceObserver((list) => {
      metrics.longTasks?.push(
        ...list.getEntries().map((entry) => entry.duration),
      )
    })
    metrics.longTaskObserver.observe({ type: 'longtask' })
    return metrics.getNotificationCount()
  })
  const startedAt = Date.now()
  await dispatch(page, 'atira:burst-deltas', 1_000)
  await expect
    .poll(() => fixtureNotificationCount(page))
    .toBe(notificationCount + 1)
  await message.fill('Responsive after a delta burst')
  await expect(message).toHaveValue('Responsive after a delta burst')
  expect(Date.now() - startedAt).toBeLessThan(1_000)
  await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __atiraFixtureMetrics: FixtureMetrics
      }
    ).__atiraFixtureMetrics
    metrics.commitDurations.length = 0
  })
  for (let sample = 0; sample < 20; sample += 1) {
    const before = await fixtureNotificationCount(page)
    await dispatch(page, 'atira:burst-deltas', 1)
    await expect.poll(() => fixtureNotificationCount(page)).toBe(before + 1)
  }
  const performance = await page.evaluate(() => {
    const metrics = (
      window as Window & {
        __atiraFixtureMetrics: FixtureMetrics
      }
    ).__atiraFixtureMetrics
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

type FixtureMetrics = {
  commitDurations: number[]
  getNotificationCount: () => number
  longTasks?: number[]
  longTaskObserver?: PerformanceObserver
}

async function fixtureNotificationCount(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __atiraFixtureMetrics: FixtureMetrics
      }
    ).__atiraFixtureMetrics.getNotificationCount(),
  )
}

function percentile(values: readonly number[], quantile: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0
}
