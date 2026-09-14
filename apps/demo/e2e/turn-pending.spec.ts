import { expect, test } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`shows honest pending progress and separates image output (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' })
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
          window.addEventListener('stream-text', () => {
            emit({ type: 'assistant-delta', text: 'I prepared the image prompt.' })
          }, { once: true })
          window.addEventListener('append-text', () => {
            emit({ type: 'assistant-delta', text: ' The next words arrive gradually.' })
          }, { once: true })
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
              message: 'I prepared the image prompt. The next words arrive gradually.',
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
    await expect(turn.locator('[data-slot="turn-status"]')).toContainText('Working')
    await expect(turn.locator('[data-slot="spinner"]')).toHaveCount(1)
    await page.screenshot({ path: test.info().outputPath('waiting.png') })

    await page.evaluate(() => window.dispatchEvent(new Event('stream-text')))
    await expect(turn.getByText('I prepared the image prompt.', { exact: true })).toBeVisible()
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await expect(turn.locator('[data-slot="spinner"]')).toHaveCount(0)
    const words = turn.locator('[data-sd-animate]')
    await expect(words.first()).toHaveCSS('opacity', '1')
    const firstWord = await words.first().elementHandle()
    await page.evaluate(() => window.dispatchEvent(new Event('append-text')))
    await expect(turn.getByText('I prepared the image prompt. The next words arrive gradually.', { exact: true })).toBeVisible()
    expect(await firstWord!.evaluate(element => element === document.querySelector('[data-sd-animate]'))).toBe(true)
    await expect(words.first()).toHaveCSS('animation-duration', '0s')
    await expect(words.first()).toHaveCSS('opacity', '1')
    await expect(words.last()).toHaveCSS('animation-duration', width === 390 ? '0s' : '0.09s')

    await page.evaluate(() => window.dispatchEvent(new Event('start-image')))
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await expect(turn.getByText('Generating image…')).toBeVisible()
    await expect(turn.locator('[data-slot="spinner"]')).toHaveCount(1)

    await page.evaluate(() => window.dispatchEvent(new Event('finish-image')))
    const imageOutput = turn.locator('[data-tool-kind="image"]')
    await expect(imageOutput.getByRole('img', { name: 'A test image' })).toBeVisible()
    expect(await imageOutput.evaluate(element => getComputedStyle(element).marginBlockStart)).toBe('16px')
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await expect(turn.locator('[data-sd-animate]')).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('image-ready.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test(`hands off tools and subagents without remounting open evidence (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: width === 390 ? 'reduce' : 'no-preference' })
    await page.route('**/api/runtime', route => route.fulfill({
      json: { conversationSessions: true, available: true, model: 'test', runtime: 'Test' },
    }))
    await page.route('**/api/auth/chatgpt', route => route.fulfill({ json: { state: 'signed_out' } }))
    await page.addInitScript(() => {
      const original = window.fetch
      window.fetch = async (input, options) => {
        if (input !== '/api/chat') return original(input, options)
        return new Response(new ReadableStream({ start(controller) {
          const emit = (event: unknown) => controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`))
          emit({ type: 'started' })
          window.addEventListener('activity-event', event => {
            const value = (event as CustomEvent).detail
            emit(value)
            if (value.type === 'completed') controller.close()
          })
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } })
      }
    })
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Review the interface and check the implementation.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const emit = (event: object) => page.evaluate(value => window.dispatchEvent(new CustomEvent('activity-event', { detail: value })), event)
    const turn = page.locator('[data-slot="turn"]').last()
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveText('Working')
    const waitingBounds = await turn.locator('[data-slot="turn-status"]').boundingBox()
    if (width === 390) {
      await emit({ type: 'reasoning-delta', text: 'I will inspect the interface, then check the implementation.' })
      await expect(turn.locator('[data-slot="reasoning"]')).toHaveAttribute('data-state', 'thinking')
      await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    }

    const task = { id: 'design-review', tool: 'run_subagent', kind: 'task', agent: { id: 'reviewer', label: 'Design reviewer' } }
    const handoff = await page.evaluate(async value => {
      window.dispatchEvent(new CustomEvent('activity-event', { detail: value }))
      const samples: { y: number; scaleX: number; scaleY: number; opacity: number }[] = []
      const started = performance.now()
      await new Promise<void>(resolve => {
        const sample = () => {
          const incoming = document.querySelector('[data-slot="subagent-activity"]')?.closest('[data-slot="turn-assistant-message"]')
          if (incoming) {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(incoming).transform)
            samples.push({ y: matrix.m42, scaleX: matrix.m11, scaleY: matrix.m22, opacity: Number(getComputedStyle(incoming).opacity) })
          }
          if (performance.now() - started < 450) requestAnimationFrame(sample)
          else resolve()
        }
        requestAnimationFrame(sample)
      })
      return samples
    }, { ...task, type: 'tool-started', summary: 'Review interface', input: 'Review the interface', activity: { summary: 'Inspecting components' } })
    expect(handoff.length).toBeGreaterThan(0)
    expect(handoff.every(sample => sample.scaleX === 1 && sample.scaleY === 1)).toBe(true)
    expect(handoff.every(sample => sample.opacity === 1)).toBe(true)
    if (width === 390) expect(handoff.every(sample => sample.y === 0)).toBe(true)
    expect(handoff.at(-1)!.y).toBe(0)
    const child = turn.locator('[data-slot="subagent-activity"]')
    const trigger = child.getByRole('button').first()
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    if (width === 1100) {
      await expect(turn.locator('[data-slot="turn-assistant-message"]')).toHaveCSS('transform', 'none')
      expect((await child.boundingBox())!.y).toBeCloseTo(waitingBounds!.y, 0)
    }
    await trigger.click()
    const triggerNode = await trigger.elementHandle()
    const evidence = await child.locator('[data-slot="tool-activity-evidence"]').first().elementHandle()
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep this follow-up draft.')
    await trigger.focus()

    await emit({ ...task, type: 'tool-progress', summary: 'Review interface', activity: { summary: 'Checking spacing' }, transcript: { result: '', reasoning: 'Compare the label and evidence insets.', steps: [] } })
    await expect(trigger).toHaveAccessibleName(/Checking spacing/)
    await expect(child.locator('[data-slot="task-transcript"]')).toBeVisible()
    await expect(child.getByRole('region', { name: 'Subagent result' })).toHaveCount(0)
    const summary = child.locator('[data-slot="tool-activity-summary"] [data-text-state]:not([aria-hidden="true"])').first()
    await expect(summary).toHaveCSS('opacity', '1')
    const summaryNode = await summary.elementHandle()
    const step = { id: 'read', tool: 'read', summary: 'Read component styles', status: 'succeeded', output: 'Insets aligned.' }
    const partialResult = 'Spacing is consistent; checking mobile.'
    await emit({ ...task, type: 'tool-progress', summary: 'Review interface', activity: { summary: 'Checking spacing' }, transcript: { result: partialResult, steps: [step] } })
    await expect(child.getByRole('button', { name: 'Complete Read component styles' })).toBeVisible()
    await expect(child.getByRole('region', { name: 'Subagent result' }).locator('..')).toHaveCSS('transform', 'none')
    expect(await summaryNode!.evaluate(node => node.isConnected)).toBe(true)
    const motionSamples = await page.evaluate(async value => {
      window.dispatchEvent(new CustomEvent('activity-event', { detail: value }))
      const samples: { opacity: number; entryY: number; resultY: number }[] = []
      const started = performance.now()
      await new Promise<void>(resolve => {
        const sample = () => {
          const row = document.querySelector('[data-tool-activity-id$=":check"]')?.parentElement
          const result = document.querySelector('[aria-label="Subagent result"]')?.parentElement
          if (row && result) samples.push({
            opacity: Number(getComputedStyle(row).opacity),
            entryY: new DOMMatrixReadOnly(getComputedStyle(row).transform).m42,
            resultY: new DOMMatrixReadOnly(getComputedStyle(result).transform).m42,
          })
          if (performance.now() - started < 450) requestAnimationFrame(sample)
          else resolve()
        }
        requestAnimationFrame(sample)
      })
      return samples
    }, { ...task, type: 'tool-progress', summary: 'Review interface', activity: { summary: 'Checking spacing' }, transcript: { result: partialResult, steps: [step, { ...step, id: 'check', summary: 'Check mobile layout' }] } })
    expect(motionSamples.length).toBeGreaterThan(0)
    if (width === 390) expect(motionSamples.every(value => value.opacity === 1 && value.entryY === 0 && value.resultY === 0)).toBe(true)
    else {
      expect(motionSamples.some(value => value.opacity < 1 && value.entryY > 0)).toBe(true)
      expect(motionSamples.some(value => value.resultY < -1)).toBe(true)
    }
    expect(motionSamples.at(-1)).toEqual({ opacity: 1, entryY: 0, resultY: 0 })
    const addedStep = child.getByRole('group', { name: 'read: Check mobile layout' }).locator('..')
    await expect(addedStep).toHaveCSS('opacity', '1')
    await page.screenshot({ path: test.info().outputPath('subagent-active.png') })

    await emit({ ...task, type: 'tool-completed', status: 'succeeded', summary: 'Review complete', transcript: { result: 'The insets and mobile layout are consistent.', steps: [step] } })
    await expect(child).toHaveAttribute('data-state', 'succeeded')
    await expect(trigger).toHaveAccessibleName('Complete Design reviewer · Review the interface')
    await expect(child.getByRole('region', { name: 'Subagent result' })).toBeVisible()
    expect(await triggerNode!.evaluate(node => node === document.activeElement)).toBe(true)
    expect(await evidence!.evaluate(node => node.isConnected)).toBe(true)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await emit({ type: 'tool-started', id: 'check', tool: 'shell', input: 'pnpm typecheck', summary: 'Check types' })
    const check = turn.locator('[data-tool="shell"]')
    await expect(check).toHaveAttribute('data-state', 'running')
    await emit({ type: 'tool-completed', id: 'check', tool: 'shell', status: 'failed', error: 'Type mismatch', summary: 'Check failed' })
    await expect(check).toHaveAttribute('data-state', 'failed')
    await expect(check.getByRole('alert')).toHaveText('Type mismatch')
    await expect(turn.getByRole('status').and(turn.locator('[data-slot="turn-status"]'))).toHaveText('Working')
    await emit({ type: 'assistant-delta', text: 'The design review is complete. The type check found an issue to resolve.' })
    await expect(turn.locator('[data-slot="turn-status"]')).toHaveCount(0)
    await expect(turn.locator('[data-sd-animate]').last()).toHaveCSS('animation-duration', width === 390 ? '0s' : '0.09s')
    await emit({ type: 'completed', message: 'The design review is complete. The type check found an issue to resolve.', durationMs: 1, usage: { totalTokens: 1, outputTokens: 1 } })
    await expect(turn).toHaveAttribute('data-state', 'complete')
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('Keep this follow-up draft.')
    await expect(turn.locator('[data-text-state][aria-hidden="true"]')).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('activity-complete.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
