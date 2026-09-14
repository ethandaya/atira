import { expect, test } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`preserves successful tools during provider retry (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/runtime', route => route.fulfill({ json: { conversationSessions: true, available: true, model: 'test', runtime: 'Test' } }))
    await page.route('**/api/auth/chatgpt', route => route.fulfill({ json: { state: 'signed_out' } }))
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(new ReadableStream({ start(controller) {
          const emit = (event: unknown) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'))
          emit({ type: 'started' })
          emit({ type: 'assistant-delta', text: 'I will check the sources.\n\n' })
          emit({ type: 'tool-started', id: 'search', tool: 'search_web', input: 'Gravel frames', summary: 'Searching' })
          emit({ type: 'tool-completed', id: 'search', tool: 'search_web', status: 'succeeded', summary: 'Found frame references' })
          emit({ type: 'provider-started' })
          emit({ type: 'assistant-delta', text: 'Incomplete response' })
          emit({ type: 'provider-retry', attempt: 2 })
          window.addEventListener('recover', () => {
            emit({ type: 'provider-started' })
            emit({ type: 'assistant-delta', text: 'Recovered answer.' })
            window.addEventListener('complete', () => {
              emit({ type: 'assistant-message', text: 'I will check the sources.\n\nRecovered answer.' })
              emit({ type: 'completed', message: 'I will check the sources.\n\nRecovered answer.', durationMs: 100, usage: { totalTokens: 1, outputTokens: 1 } })
              controller.close()
            }, { once: true })
          }, { once: true })
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Find alternatives')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const turn = page.locator('[data-slot="turn"]')
    await expect(turn).toHaveAttribute('data-state', 'retrying')
    await expect(turn.locator('[data-slot="turn-status"]')).toContainText('Retrying · attempt 2')
    await expect(page.getByText('Incomplete response')).toHaveCount(0)
    const tool = turn.locator('[data-slot="tool-activity"]')
    await expect(tool).toHaveAttribute('data-state', 'succeeded')
    await expect(tool).toHaveCount(1)
    await page.screenshot({ path: test.info().outputPath('retrying.png') })
    await page.evaluate(() => window.dispatchEvent(new Event('recover')))
    await expect(page.getByText('Recovered answer.', { exact: true })).toBeVisible()
    const parts = turn.locator('[data-slot="turn-assistant-message"]')
    const order = () => parts.locator(':scope > [data-slot="activity-slot-content"]:not([aria-hidden="true"]) > *').evaluateAll(elements => elements.map(element => element.getAttribute('data-slot')))
    expect(await order()).toEqual(['markdown', 'activity-sequence', 'markdown'])
    await page.evaluate(() => window.dispatchEvent(new Event('complete')))
    await expect(turn).toHaveAttribute('data-state', 'complete')
    expect(await order()).toEqual(['markdown', 'activity-sequence', 'markdown'])
    await page.reload()
    await expect(page.getByText('Recovered answer.', { exact: true })).toBeVisible()
    expect(await order()).toEqual(['markdown', 'activity-sequence', 'markdown'])
    await expect(tool).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
