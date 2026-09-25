import { expect, test } from '@playwright/test'

const comparison = `| Carbon frameset | Frameset price | Stated tyre clearance | L-size fit: stack / reach, mm | BB / hanger | Availability |
| --- | --- | --- | --- | --- | --- |
| [Tavelo Grow](https://example.com/tavelo) — benchmark | **US$1,650**, listing labelled “frame only”; **US$1,880** with flat cockpit | **700c: 55mm front / 50mm rear** | **L: 579 / 395** | BSA 68 / UDH | General orders accepted; pre-orders fulfilled first. Immediate L stock unverified |
| [Winspace G3](https://example.com/winspace) | **US$1,480** listed by retailer; current manufacturer-direct price unverified | **700c × 50mm** for L; also stated 650b × 2.1″ | **L: 582 / 388** | T47 / UDH | Order listings active; size-specific dispatch unverified |
| Carbonda CFR707 | **Quote required**; current price and currency unverified | **700c × 50mm** or **650b × 2.1″** | **L: 596 / 400**, older independent chart | BSA 68 / current page provides UDH drawings | Direct enquiry; stock and lead time unverified |`

for (const width of [1100, 390]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`readable markdown table ${width} ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme })
      await page.route('**/api/runtime', (route) =>
        route.fulfill({
          json: {
            conversationSessions: true,
            available: true,
            model: 'test',
            runtime: 'Test',
          },
        }),
      )
      await page.addInitScript((markdown) => {
        const original = window.fetch
        window.fetch = async (input, options) => {
          if (input !== '/api/chat') return original(input, options)
          return new Response(
            new ReadableStream({
              start(controller) {
                const emit = (event: unknown) =>
                  controller.enqueue(
                    new TextEncoder().encode(JSON.stringify(event) + '\n'),
                  )
                emit({ type: 'started' })
                emit({ type: 'assistant-delta', text: markdown })
                window.addEventListener(
                  'finish-table',
                  () => {
                    emit({
                      type: 'completed',
                      message: markdown,
                      durationMs: 1,
                      usage: { outputTokens: 1, totalTokens: 1 },
                    })
                    controller.close()
                  },
                  { once: true },
                )
              },
            }),
            { headers: { 'Content-Type': 'application/x-ndjson' } },
          )
        }
      }, comparison)
      await page.goto('/?view=playground')
      await page
        .getByRole('textbox', { name: 'Message', exact: true })
        .fill('Compare these framesets')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      const table = page.getByRole('table')
      const scroller = page.getByRole('region', {
        name: 'Scrollable table',
        exact: true,
      })
      await expect(table.getByRole('columnheader')).toHaveCount(6)
      expect(
        await table
          .locator('th')
          .first()
          .evaluate((el) => el.getBoundingClientRect().width),
      ).toBeGreaterThanOrEqual(160)
      await page.evaluate(() => window.dispatchEvent(new Event('finish-table')))
      await expect(page.locator('[data-slot="turn"]')).toHaveAttribute(
        'data-state',
        'complete',
      )
      expect(
        await table
          .locator('td')
          .first()
          .evaluate((el) => getComputedStyle(el).overflowWrap),
      ).toBe('break-word')
      expect(
        await scroller.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true)
      await expect(scroller).toHaveAttribute('data-overflow-end', 'true')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await scroller.focus()
      await page.keyboard.press('ArrowRight')
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0)
      await expect(scroller).toHaveAttribute('data-overflow-start', 'true')
      // Let native keyboard smooth-scrolling finish before testing the endpoints.
      await page.waitForTimeout(300)
      await scroller.evaluate((el) => {
        el.scrollLeft = el.scrollWidth
      })
      await expect(scroller).not.toHaveAttribute('data-overflow-end')
      await scroller.evaluate((el) => {
        el.scrollLeft = 0
      })
      await expect(scroller).not.toHaveAttribute('data-overflow-start')
      await page.getByRole('textbox', { name: 'Message', exact: true }).focus()
      await page.screenshot({ path: test.info().outputPath('table.png') })
    })
  }
}
