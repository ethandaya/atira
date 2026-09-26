import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const scenario of [
  { name: 'dark reduced-motion', url: '/?fixture=workflow&theme=dark' },
  { name: 'RTL', url: '/?fixture=workflow&dir=rtl' },
] as const) {
  test(`has no serious accessibility violations in ${scenario.name}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: scenario.name.startsWith('dark') ? 'dark' : 'light',
      forcedColors: scenario.name === 'RTL' ? 'active' : 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(scenario.url)
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([])
  })
}
