import { expect, test } from '@playwright/test'

test.use({ video: 'on' })

for (const width of [1100, 390]) {
  test(`every pending position hands off without moving completed evidence (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' })
    await page.route('**/api/runtime', route => route.fulfill({ json: { available: true, conversationSessions: true, model: 'test', runtime: 'Test' } }))
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(new ReadableStream({ start(controller) {
          const emit = (value: unknown) => controller.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`))
          emit({ type: 'started' })
          window.addEventListener('handoff-event', event => emit((event as CustomEvent).detail))
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })
    await page.goto('/?view=playground')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Research the interaction, delegate a review, then check the implementation.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const turn = page.locator('[data-slot="turn"]').last()
    const owner = turn.locator('[data-slot="assistant-sequence"]')
    const pending = owner.locator('[data-slot="activity-pending"]:not([aria-hidden="true"])')
    await expect(pending).toBeVisible()
    const calls = [
      { id: 'research', tool: 'search_web', summary: 'Research interaction patterns', input: 'Shared layout interactions' },
      { id: 'reviewer', tool: 'inspect_component_catalog', summary: 'Review the findings', input: 'Check the findings' },
      { id: 'followup', tool: 'search_web', summary: 'Research implementation guidance', input: 'Accessible activity handoffs' },
    ]
    const emit = (detail: object) => page.evaluate(value => window.dispatchEvent(new CustomEvent('handoff-event', { detail: value })), detail)
    const completed: { node: Awaited<ReturnType<typeof owner.elementHandle>>; top: number }[] = []
    for (const [index, call] of calls.entries()) {
      await expect(pending).toHaveAttribute('data-handoff-slot', String(index))
      const slot = await pending.elementHandle()
      const before = (await pending.boundingBox())!
      await emit({ ...call, type: 'tool-started' })
      const incoming = owner.locator(`[data-handoff-slot="${index}"][data-slot="turn-assistant-message"]`)
      await expect(incoming).toBeVisible()
      expect(await slot!.evaluate(element => element.isConnected && element.dataset.slot === 'turn-assistant-message')).toBe(true)
      await expect(incoming).toHaveCSS('opacity', '1')
      if (width === 1100 && index === 0) {
        const opacities = await incoming.evaluate(element => new Promise<number[]>((resolve, reject) => {
          const samples: number[] = []
          const sample = () => {
            if (getComputedStyle(element).opacity !== '1') return reject(new Error('Persistent slot faded during handoff'))
            const content = element.querySelector('[data-slot="activity-slot-content"]:not([aria-hidden="true"])')!
            const opacity = Number(getComputedStyle(content).opacity)
            samples.push(opacity)
            if (opacity === 1 || samples.length > 60) resolve(samples)
            else requestAnimationFrame(sample)
          }
          sample()
        }))
        expect(opacities.some(opacity => opacity > 0 && opacity < 1)).toBe(true)
        expect(opacities.at(-1)).toBe(1)
      }
      await expect(incoming).toHaveCSS('transform', 'none')
      await expect(pending).toHaveCount(0)
      expect((await incoming.boundingBox())!.y).toBeCloseTo(before.y, 0)
      // Completed rows keep their actual nodes, open disclosures and screen positions.
      for (const previous of completed) {
        expect(await previous.node!.evaluate(node => node.isConnected)).toBe(true)
        expect((await previous.node!.boundingBox())!.y).toBeCloseTo(previous.top, 0)
      }
      await emit({ ...call, type: 'tool-completed', status: 'succeeded', output: 'Checked.' })
      await expect(pending).toBeVisible()
      const trigger = incoming.getByRole('button').first()
      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      // Let the existing disclosure animation settle before measuring the next slot.
      await page.waitForTimeout(300)
      completed.push({ node: await incoming.elementHandle(), top: (await incoming.boundingBox())!.y })
    }
    await expect(pending).toHaveAttribute('data-handoff-slot', '3')
    const responseSlot = await pending.elementHandle()
    const before = (await pending.boundingBox())!
    const { heights, tops } = await page.evaluate(async () => {
      window.dispatchEvent(new CustomEvent('handoff-event', { detail: {
        type: 'assistant-delta', text: 'The handoffs now share the same position.',
      } }))
      const samples: number[] = []
      const tops: number[] = []
      const started = performance.now()
      let appended = false
      await new Promise<void>(resolve => {
        const sample = () => {
          const slot = document.querySelector('[data-slot="turn-assistant-message"][data-handoff-slot="3"]')
          if (slot) {
            samples.push(slot.getBoundingClientRect().height)
            const paragraph = slot.querySelector('p')
            if (paragraph) tops.push(paragraph.getBoundingClientRect().top - slot.closest('[data-slot="turn"]')!.getBoundingClientRect().top)
          }
          if (!appended && performance.now() - started > 50) {
            appended = true
            window.dispatchEvent(new CustomEvent('handoff-event', { detail: { type: 'assistant-delta', text: '\n\nThis chunk arrives during the handoff.' } }))
          }
          if (performance.now() - started < 350) requestAnimationFrame(sample)
          else resolve()
        }
        requestAnimationFrame(sample)
      })
      return { heights: samples, tops }
    })
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1)
    const response = owner.locator('[data-handoff-slot="3"][data-slot="turn-assistant-message"]')
    await expect(response).toHaveCSS('transform', 'none')
    expect(await responseSlot!.evaluate(element => element.isConnected && element.dataset.slot === 'turn-assistant-message')).toBe(true)
    const finalHeight = (await response.boundingBox())!.height
    expect(finalHeight).toBeGreaterThan(before.height)
    expect(heights.at(-1)).toBeCloseTo(finalHeight, 0)
    await expect(pending).toHaveCount(0)
    expect((await response.boundingBox())!.y).toBeCloseTo(before.y, 0)
    await expect(response.locator('[data-sd-animate]').last()).toHaveCSS('animation-duration', width === 390 ? '0s' : '0.09s')
    for (const previous of completed) {
      expect((await previous.node!.boundingBox())!.y).toBeCloseTo(previous.top, 0)
      expect(await previous.node!.evaluate(node => node.querySelector('button')?.getAttribute('aria-expanded'))).toBe('true')
    }
    // Once the handoff settles, streaming must not replay layout on existing lines.
    const lineOffsets = await response.evaluate(async element => {
      const turn = element.closest('[data-slot="turn"]')!
      const top = () => element.querySelector('p')!.getBoundingClientRect().top - turn.getBoundingClientRect().top
      const samples = [top()]
      for (const text of ['\n\nAnother paragraph', ' with more detail.', '\n\nAnd one final paragraph.']) {
        window.dispatchEvent(new CustomEvent('handoff-event', { detail: { type: 'assistant-delta', text } }))
        const started = performance.now()
        await new Promise<void>(resolve => {
          const sample = () => {
            samples.push(top())
            if (performance.now() - started < 300) requestAnimationFrame(sample)
            else resolve()
          }
          requestAnimationFrame(sample)
        })
      }
      return samples
    })
    expect(Math.max(...lineOffsets) - Math.min(...lineOffsets)).toBeLessThan(1)
    const jump = page.getByRole('button', { name: /Jump to latest/ })
    if (await jump.isVisible()) await jump.click()
    await expect(response).toBeInViewport()
    await expect(response).toHaveCSS('opacity', '1')
    await page.screenshot({ path: test.info().outputPath('handoff.png'), fullPage: true })
  })
}
