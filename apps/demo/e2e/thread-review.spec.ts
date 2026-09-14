import { expect, test } from '@playwright/test'
import { readFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

for (const width of [1280, 390]) {
  test(`captures, scrubs, replays and annotates actual chat components (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: width === 390 ? 'reduce' : 'no-preference' })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/runtime', route => route.fulfill({ json: { conversationSessions: true, available: true, model: 'test', runtime: 'Test' } }))
    await page.addInitScript(() => {
      const original = window.fetch
      Object.assign(window, { reviewSends: 0 })
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        Object.assign(window, { reviewSends: (window as unknown as { reviewSends: number }).reviewSends + 1 })
        return new Response(new ReadableStream({ start(controller) {
          const emit = (event: unknown) => controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`))
          emit({ type: 'started' })
          window.addEventListener('review-event', event => {
            const value = (event as CustomEvent).detail
            emit(value)
            if (value.type === 'completed') controller.close()
          })
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })
    await page.goto('/proto/thread-review/index.html')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Review the interface, delegate a spacing audit, and check the implementation.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.locator('[data-slot="turn-status"]')).toHaveText('Working')
    const emit = (value: object) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('review-event', { detail })), value)
    const task = { id: 'review', tool: 'run_subagent', kind: 'task', agent: { id: 'reviewer', label: 'Review' } }
    const long = 'Inspecting the complete interface and checking every component, nested inset, multi-row alignment, and responsive state across desktop and mobile'
    await emit({ ...task, type: 'tool-started', summary: 'Review interface', activity: { summary: long }, input: 'Review the interface' })
    const label = page.locator('[data-slot="tool-activity-summary"]').first()
    await expect(label).toHaveAttribute('data-overflowing', 'true')
    await emit({ ...task, type: 'tool-progress', summary: 'Review interface', activity: { summary: 'Writing response' } })
    await expect(label).toContainText('Writing response')
    await expect(label).toHaveCSS('mask-image', 'none')
    await expect(page.getByLabel('Elapsed time')).toBeVisible()
    await expect(page.locator('[data-slot="tool-activity-status"]').getByText('Running', { exact: true })).toHaveCSS('position', 'absolute')

    const jump = page.getByRole('combobox', { name: 'Jump to captured state' })
    const options = await jump.locator('option').allTextContents()
    const working = options.findIndex(text => text.endsWith('. Working'))
    const writing = options.findIndex(text => text.endsWith('Review · Writing response'))
    expect(working).toBeGreaterThan(0)
    expect(writing).toBeGreaterThan(working)
    await jump.selectOption(String(writing))
    const playback = page.frameLocator('iframe')
    const frozenTimer = playback.getByLabel('Elapsed time')
    await expect(frozenTimer).toBeVisible()
    const time = await frozenTimer.textContent()
    await page.waitForTimeout(1200)
    await expect(frozenTimer).toHaveText(time!)
    await expect(playback.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled()

    // The real stream keeps progressing while an old snapshot is on screen.
    await emit({ ...task, type: 'tool-completed', summary: 'Review interface', status: 'succeeded', output: 'Spacing checked.' })
    await emit({ type: 'assistant-delta', text: 'The audit is complete. The summary now fits without an unnecessary fade.' })
    await emit({ type: 'completed', durationMs: 1800, message: 'The audit is complete. The summary now fits without an unnecessary fade.', usage: { outputTokens: 20, totalTokens: 40 } })
    await expect(jump).toHaveValue(String(writing))
    await expect(playback.locator('[data-slot="tool-activity-summary"]').first()).toContainText('Writing response')

    await jump.selectOption(String(working))
    await expect(playback.locator('[data-slot="turn-status"]')).toHaveText('Working')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(playback.locator('[data-slot="subagent-activity"]')).toBeVisible()
    const opacity = await page.getByRole('button', { name: 'Replay transition', exact: true }).evaluate(async button => {
      const samples: number[] = []
      button.click()
      const started = performance.now()
      while (performance.now() - started < 750) {
        await new Promise(requestAnimationFrame)
        const element = document.querySelector('iframe')!.contentDocument!.querySelector('[data-slot="turn-assistant-message"] > [data-slot="activity-slot-content"]:not([aria-hidden="true"])')
        if (element) samples.push(Number(element.ownerDocument.defaultView!.getComputedStyle(element).opacity))
      }
      return samples
    })
    expect(opacity.length).toBeGreaterThan(0)
    expect(opacity.at(-1)).toBe(1)
    if (width === 1280) expect(opacity.some(value => value < 1)).toBe(true)
    else expect(opacity.every(value => value === 1)).toBe(true)
    await expect(playback.locator('[data-slot="subagent-activity"]')).toBeVisible()

    // Range keyboard seeking is instantaneous, including backwards.
    const slider = page.getByRole('slider', { name: 'Recorded state' })
    await slider.focus()
    await slider.press('Home')
    await expect(jump).toHaveValue('0')
    await slider.press('End')
    await expect(playback.getByText('The audit is complete. The summary now fits without an unnecessary fade.')).toBeVisible()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pause', exact: true }).click()

    await jump.selectOption(String(writing))
    await page.getByRole('button', { name: 'Select component', exact: true }).click()
    await playback.locator('[data-slot="tool-activity-summary"]').first().click()
    await page.getByRole('textbox', { name: 'Animation note' }).fill('Keep this row anchored while the subagent becomes a tool result.')
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await expect(page.getByRole('button', { name: /Keep this row anchored/ })).toBeVisible()
    await expect(page.locator('[data-review-mode] > [aria-hidden="true"]')).toBeVisible()
    await page.getByRole('button', { name: 'Save review', exact: true }).click()
    const saved = page.getByRole('status').filter({ hasText: '.amp/in/artifacts/thread-review-' })
    await expect(saved).toBeVisible()
    const file = resolve((await saved.textContent())!)
    const recording = JSON.parse(await readFile(file, 'utf8'))
    expect(recording.notes).toHaveLength(1)
    expect(recording.notes[0].frame).toBe(writing)
    expect(recording.notes[0].target.selector).toContain('data-tool-activity-id')
    expect(recording.frames[working].label).toBe('Working')
    await unlink(file)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const noteBounds = (await page.getByRole('button', { name: /Keep this row anchored/ }).boundingBox())!
    const saveBounds = (await page.getByRole('button', { name: 'Save review', exact: true }).boundingBox())!
    expect(noteBounds.y + noteBounds.height).toBeLessThanOrEqual(saveBounds.y)
    await page.screenshot({ path: test.info().outputPath(`thread-review-${width}.png`), fullPage: true })
    await page.getByRole('complementary', { name: 'Motion review controls' }).evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: test.info().outputPath(`thread-review-controls-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Live', exact: true }).click()
    await expect(page.locator('[data-slot="turn"]').last()).toHaveAttribute('data-state', 'complete')
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEditable()
    expect(await page.evaluate(() => (window as unknown as { reviewSends: number }).reviewSends)).toBe(1)
    expect(errors).toEqual([])
  })
}
