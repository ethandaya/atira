import { expect, test } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`generated images keep geometry, recover loading, download and survive reload (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const image = { id: 'test-image', url: '/api/images/test-image', alt: 'A test image', width: 1, height: 1 }
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
    await page.route('**/api/runtime', route => route.fulfill({ json: { conversationSessions: true, available: true, model: 'test', runtime: 'Test' } }))
    await page.route('**/api/auth/chatgpt', route => route.fulfill({ json: { state: 'signed_out' } }))
    let imageAvailable = false
    await page.route('**/api/images/**', route => route.fulfill(imageAvailable ? { contentType: 'image/png', body: png } : { status: 404 }))
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(new ReadableStream({ start(controller) {
          const emit = (event: unknown) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'))
          emit({ type: 'started' })
          emit({ type: 'tool-started', id: 'image-call', tool: 'generate_image', kind: 'image', input: 'A test image', summary: 'Generating image' })
          window.addEventListener('image-result', event => {
            emit({ type: 'tool-completed', id: 'image-call', tool: 'generate_image', kind: 'image', status: 'succeeded', image: (event as CustomEvent).detail, summary: 'Image generated' })
            emit({ type: 'completed', message: 'Here is the image.', durationMs: 1, usage: { totalTokens: 1, outputTokens: 1 } })
            controller.close()
          }, { once: true })
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Generate an image')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const figure = page.locator('[data-slot="generated-image"]')
    await expect(figure).toHaveAttribute('data-state', 'generating')
    await expect(figure.getByText('Generating image…')).toBeVisible()
    const before = (await figure.boundingBox())!
    await page.screenshot({ path: test.info().outputPath('generating.png') })
    await page.evaluate(image => window.dispatchEvent(new CustomEvent('image-result', { detail: image })), image)
    await expect(figure.getByText('This image could not be loaded.')).toBeVisible()
    expect((await figure.boundingBox())!.height).toBe(before.height)
    await page.screenshot({ path: test.info().outputPath('load-error.png') })
    imageAvailable = true
    await figure.getByRole('button', { name: 'Retry loading' }).click()
    await expect(figure.getByRole('link', { name: 'Open image' })).toBeVisible()
    expect(await figure.locator('img').evaluate(img => img.complete && img.naturalWidth === 1)).toBe(true)
    expect((await figure.boundingBox())!.height).toBe(before.height)
    await page.screenshot({ path: test.info().outputPath('ready.png') })
    const download = page.waitForEvent('download')
    await figure.getByRole('link', { name: 'Download' }).click()
    expect((await download).suggestedFilename()).toBe('generated-image.png')
    await page.reload()
    await expect(figure.getByRole('img', { name: 'A test image' })).toBeVisible()
    await expect(figure.getByRole('link', { name: 'Open image' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await page.evaluate(() => sessionStorage.getItem('pretty-amped:conversations:v1'))).not.toContain('base64')
  })
}
