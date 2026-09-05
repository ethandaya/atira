import { expect, test } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`shows honest pending progress and separates image output (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/runtime', route => route.fulfill({
      json: { conversationSessions: true, available: true, model: 'test', runtime: 'Test' },
    }))
    await page.route('**/api/auth/chatgpt', route => route.fulfill({
      json: { state: 'signed_out' },
    }))
    await page.route('**/api/images/**', route => route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#d8e7df"/><circle cx="320" cy="280" r="150" fill="#52796f"/><path d="M150 510h340L320 250z" fill="#2f3e46"/></svg>',
      contentType: 'image/svg+xml',
    }))
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(new ReadableStream({ start(controller) {
          const emit = (event: unknown) => controller.enqueue(
            new TextEncoder().encode(`${JSON.stringify(event)}\n`),
          )
          emit({ type: 'started' })
          emit({ type: 'assistant-delta', text: 'I prepared the image prompt.' })
          window.addEventListener('start-image', () => {
            emit({
              type: 'tool-started',
              id: 'image-call',
              tool: 'generate_image',
              kind: 'image',
              input: 'A test image',
              summary: 'Generating image',
            })
          }, { once: true })
          window.addEventListener('finish-image', () => {
            emit({
              type: 'tool-completed',
              id: 'image-call',
              tool: 'generate_image',
              kind: 'image',
              status: 'succeeded',
              image: {
                id: 'test-image',
                url: '/api/images/test-image',
                alt: 'A test image',
                width: 640,
                height: 640,
              },
              summary: 'Image generated',
            })
            emit({
              type: 'completed',
              message: 'I prepared the image prompt.',
              durationMs: 1,
              usage: { totalTokens: 1, outputTokens: 1 },
            })
            controller.close()
          }, { once: true })
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })

    await page.goto('/')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Generate an image')
    await page.getByRole('button', { name: 'Send', exact: true }).click()

    const turn = page.locator('[data-slot="turn"]').last()
    await expect(turn.getByText('I prepared the image prompt.')).toBeVisible()
    await expect(turn.locator('[data-slot="turn-status"]')).toContainText('Working')
    await expect(turn.locator('[data-slot="spinner"]')).toHaveCount(1)
    await page.screenshot({ path: test.info().outputPath('waiting.png') })

    await page.evaluate(() => window.dispatchEvent(new Event('start-image')))
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await expect(turn.getByText('Generating image…')).toBeVisible()
    await expect(turn.locator('[data-slot="spinner"]')).toHaveCount(1)

    await page.evaluate(() => window.dispatchEvent(new Event('finish-image')))
    const imageOutput = turn.locator('[data-tool-kind="image"]')
    await expect(imageOutput.getByRole('img', { name: 'A test image' })).toBeVisible()
    expect(await imageOutput.evaluate(element => getComputedStyle(element).marginBlockStart)).toBe('16px')
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('image-ready.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
