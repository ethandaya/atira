import { expect, test } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`hands off supported tools without remounting open evidence (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    })
    await page.route('**/api/runtime', (route) =>
      route.fulfill({
        json: {
          available: true,
          conversationSessions: true,
          model: 'nanocodex',
          models: [
            {
              label: 'Nanocodex',
              modelId: 'nanocodex',
              providerId: 'nanocodex',
            },
          ],
          runtime: 'Nanocodex',
        },
      }),
    )
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(
          new ReadableStream({
            start(controller) {
              const emit = (event: unknown) =>
                controller.enqueue(
                  new TextEncoder().encode(`${JSON.stringify(event)}\n`),
                )
              emit({ type: 'started' })
              window.addEventListener('activity-event', (event) => {
                const value = (event as CustomEvent).detail
                emit(value)
                if (value.type === 'completed') controller.close()
              })
            },
          }),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        )
      }
    })
    await page.goto('/?view=playground')
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Inspect the catalog and research accessibility guidance.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const emit = (event: object) =>
      page.evaluate(
        (value) =>
          window.dispatchEvent(
            new CustomEvent('activity-event', { detail: value }),
          ),
        event,
      )
    const turn = page.locator('[data-slot="turn"]').last()
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveText(
      'Working',
    )

    await emit({
      type: 'tool-started',
      id: 'catalog',
      tool: 'inspect_component_catalog',
      input: 'activity',
      summary: 'Inspect catalog',
    })
    const catalog = turn.locator('[data-tool="inspect_component_catalog"]')
    await expect(catalog).toHaveAttribute('data-state', 'running')
    await emit({
      type: 'tool-completed',
      id: 'catalog',
      tool: 'inspect_component_catalog',
      status: 'succeeded',
      output: 'Activity components found.',
      summary: 'Catalog inspected',
    })
    await expect(catalog).toHaveAttribute('data-state', 'succeeded')
    const trigger = catalog.getByRole('button').first()
    await trigger.click()
    const triggerNode = await trigger.elementHandle()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await emit({
      type: 'tool-started',
      id: 'research',
      tool: 'search_web',
      input: 'Activity accessibility guidance',
      summary: 'Research accessibility',
    })
    const check = turn.locator('[data-tool="search_web"]')
    await expect(check).toHaveAttribute('data-state', 'running')
    expect(await triggerNode!.evaluate((node) => node.isConnected)).toBe(true)
    await emit({
      type: 'tool-completed',
      id: 'research',
      tool: 'search_web',
      status: 'failed',
      error: 'Search unavailable',
      summary: 'Research failed',
    })
    await expect(check).toHaveAttribute('data-state', 'failed')
    await expect(check.getByRole('alert')).toHaveText('Search unavailable')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await emit({
      type: 'assistant-delta',
      text: 'The catalog is available, but the accessibility search failed.',
    })
    await emit({
      type: 'completed',
      message: 'The catalog is available, but the accessibility search failed.',
      durationMs: 1,
      usage: { totalTokens: 1, outputTokens: 1 },
    })
    await expect(turn).toHaveAttribute('data-state', 'complete')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
