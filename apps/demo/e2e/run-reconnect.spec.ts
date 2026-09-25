import { expect, test } from '@playwright/test'

for (const reload of [false, true]) {
  test(`replays a running turn without resubmitting (${reload ? 'reload' : 'disconnect'})`, async ({
    page,
  }) => {
    let submissions = 0
    let replays = 0
    await page.route('**/api/runtime', (route) =>
      route.fulfill({
        json: {
          conversationSessions: true,
          available: true,
          runtime: 'Test',
          model: 'test',
        },
      }),
    )
    await page.route('**/api/chat?*', (route) => {
      replays++
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: [
          { type: 'started' },
          { type: 'assistant-delta', text: 'Preparing catalog.' },
          {
            type: 'tool-started',
            id: 'catalog',
            tool: 'inspect_component_catalog',
            summary: 'Inspecting',
            input: 'References',
          },
          {
            type: 'tool-completed',
            id: 'catalog',
            tool: 'inspect_component_catalog',
            status: 'succeeded',
            summary: 'Inspection complete',
            output: 'References found.',
          },
          {
            type: 'completed',
            message: 'Preparing catalog. Done.',
            durationMs: 10,
            usage: { totalTokens: 1, outputTokens: 1 },
          },
        ]
          .map((event) => JSON.stringify(event) + '\n')
          .join(''),
      })
    })
    await page.exposeFunction('recordSubmit', () => submissions++)
    await page.addInitScript(
      ({ reload }) => {
        const original = window.fetch
        window.fetch = async (input, options) => {
          if (input !== '/api/chat') return original(input, options)
          await (
            window as unknown as { recordSubmit: () => Promise<void> }
          ).recordSubmit()
          return new Response(
            new ReadableStream({
              start(controller) {
                const emit = (event: unknown) =>
                  controller.enqueue(
                    new TextEncoder().encode(JSON.stringify(event) + '\n'),
                  )
                emit({ type: 'started' })
                emit({ type: 'assistant-delta', text: 'Preparing catalog.' })
                if (!reload) controller.close()
              },
            }),
            { headers: { 'Content-Type': 'application/x-ndjson' } },
          )
        }
      },
      { reload },
    )
    await page.goto('/?view=playground')
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Inspect the catalog')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    if (reload) {
      await expect(
        page.getByText('Preparing catalog.', { exact: true }),
      ).toBeVisible()
      await page.reload()
    }
    await expect(
      page.getByText('Preparing catalog.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Done.', { exact: true })).toBeVisible()
    const parts = page.locator('[data-slot="turn-assistant-message"]')
    expect(
      await parts
        .locator(
          ':scope > [data-slot="activity-slot-content"]:not([aria-hidden="true"]) > *',
        )
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-slot')),
        ),
    ).toEqual(['markdown', 'activity-sequence', 'markdown'])
    expect(submissions).toBe(1)
    expect(replays).toBe(1)
    await expect(page.locator('[data-slot="turn"]')).toHaveCount(1)
    await expect(page.locator('[data-slot="turn"]')).toHaveAttribute(
      'data-state',
      'complete',
    )
    await expect(
      page.locator('[data-tool="inspect_component_catalog"]'),
    ).toHaveCount(1)
  })
}
