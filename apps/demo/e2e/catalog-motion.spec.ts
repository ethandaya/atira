import { expect, test } from '@playwright/test'

test('animates dialog presence without losing focus or leaving interactive exits', async ({
  page,
}) => {
  await page.goto('/components')
  const trigger = page.getByRole('button', { name: 'Open dialog', exact: true })
  await trigger.scrollIntoViewIfNeeded()
  const samples = await trigger.evaluate(async (element) => {
    element.click()
    const values: number[] = []
    for (let frame = 0; frame < 24; frame++) {
      await new Promise(requestAnimationFrame)
      const popup = document.querySelector('[data-slot="dialog-content"]')
      if (popup) values.push(Number(getComputedStyle(popup).opacity))
    }
    return values
  })
  expect(samples.some((opacity) => opacity > 0 && opacity < 1)).toBe(true)
  const popup = page.getByRole('dialog')
  await expect(popup).toHaveCSS('opacity', '1')
  expect((await popup.boundingBox())!.width).toBeGreaterThan(250)
  await popup.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.press('Enter')
  await expect(popup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('keeps press motion pointer-only and disables dialog motion with reduced motion', async ({
  page,
}) => {
  await page.goto('/components')
  const primary = page.getByRole('button', { name: 'Primary', exact: true })
  await primary.hover()
  await page.mouse.down()
  await expect(primary).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 1)')
  await page.mouse.up()
  await expect(primary).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await primary.focus()
  await page.keyboard.down('Space')
  await expect(primary).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await page.keyboard.up('Space')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.getByRole('button', { name: 'Open dialog', exact: true }).click()
  const popup = page.getByRole('dialog')
  await expect(popup).toHaveCSS('opacity', '1')
  await expect(popup).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  expect(
    await popup.evaluate((element) => element.getAnimations().length),
  ).toBe(0)
})

test('indexes categories and uses compositor-safe progress motion', async ({
  page,
}) => {
  await page.goto('/components')
  const categories = page.getByRole('navigation', { name: 'Documentation' })
  await expect(
    categories.locator('a[href^="/components#gallery-"]'),
  ).toHaveCount(5)
  const indicator = page.locator('[data-slot="progress-indicator"]').first()
  await expect(indicator).toHaveCSS('transition-property', 'transform')
  await expect(indicator).toHaveCSS('width', /\d+px/)
  await categories.getByRole('link', { name: 'Structured output' }).click()
  const heading = page.getByRole('heading', { name: 'Structured output' })
  await expect(heading).toBeFocused()
  await expect(page).toHaveURL(/#gallery-output$/)
})
