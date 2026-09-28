import { expect, type Page } from '@playwright/test'

type RuntimeResponse = {
  available: boolean
  model: string
  models?: {
    description?: string
    label: string
    modelId: string
    providerId: string
  }[]
  retryTurns?: boolean
  runtime: string
}

export async function routeRuntime(page: Page, json: RuntimeResponse) {
  await page.route('**/api/auth/chatgpt', (route) =>
    route.fulfill({ json: { state: 'authenticated' } }),
  )
  await page.route('**/api/runtime', (route) => route.fulfill({ json }))
}

export async function dispatch(page: Page, name: string, detail?: number) {
  await page.evaluate(
    ({ detail, name }) =>
      window.dispatchEvent(
        detail === undefined
          ? new Event(name)
          : new CustomEvent(name, { detail }),
      ),
    { detail, name },
  )
}

export async function elementBounds(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect()
    return {
      height: rectangle.height,
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
    }
  })
}

export async function textMetrics(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
    }
  })
}

export async function settleLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

export async function expectComposerInViewport(page: Page) {
  const bounds = await page
    .locator('[data-slot="chat-composer"]')
    .evaluate((element) => {
      const rectangle = element.getBoundingClientRect()
      return {
        bottom: rectangle.bottom,
        top: rectangle.top,
        viewportHeight: innerHeight,
      }
    })
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight)
}
