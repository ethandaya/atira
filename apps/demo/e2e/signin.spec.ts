import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`uses an available API-key runtime while signed out at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/auth/chatgpt', (route) =>
      route.fulfill({ json: { state: 'signed_out' } }),
    )
    await page.route('**/api/runtime', (route) =>
      route.fulfill({
        json: {
          available: true,
          model: 'gpt-6-sol',
          models: [
            {
              defaultReasoningEffort: 'medium',
              description: 'OpenAI via Nanocodex',
              label: 'GPT-6 Sol',
              modelId: 'gpt-6-sol',
              providerId: 'openai',
              reasoningEfforts: ['low', 'medium', 'high'],
            },
          ],
          retryTurns: true,
          runtime: 'Nanocodex',
        },
      }),
    )

    await page.goto('/playground')

    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Model' })).toHaveText(
      'GPT-6 Sol',
    )
    await expect(
      page.getByRole('button', { name: 'New conversation' }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Sign in ChatGPT', exact: true }),
    ).toBeVisible()
  })
}

for (const width of [1280, 390]) {
  test(`signs in with a device code and signs out at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    let state = 'signed_out'
    let approved = false
    let starts = 0
    await page.route('**/api/runtime', (route) =>
      route.fulfill({
        json: {
          conversationSessions: true,
          available: state === 'authenticated',
          model: 'gpt-6-sol',
          runtime: 'Nanocodex',
          message: 'Sign in with ChatGPT or set OPENAI_API_KEY on the server.',
        },
      }),
    )
    await page.route('**/api/auth/chatgpt', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        starts++
        state = 'pending'
      }
      if (method === 'DELETE') state = 'signed_out'
      if (method === 'GET' && state === 'pending' && approved)
        state = 'authenticated'
      await route.fulfill({
        json:
          state === 'pending'
            ? {
                state,
                verificationUrl: 'https://auth.openai.com/codex/device',
                userCode: 'DEMO-CODE',
                expiresAt: Date.now() + 60_000,
                pollAfterMs: 1_000,
              }
            : { state },
      })
    })
    await page.goto('/?view=playground')
    const signin = page.getByRole('button', {
      name: 'Sign in with ChatGPT',
      exact: true,
    })
    await signin.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('status').filter({ hasText: 'DEMO-CODE' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'ChatGPT sign-in' }),
    ).toHaveAttribute('href', 'https://auth.openai.com/codex/device')
    expect(starts).toBe(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      (
        await new AxeBuilder({ page })
          .include('section[aria-label="ChatGPT sign-in"]')
          .analyze()
      ).violations,
    ).toEqual([])
    approved = true
    await expect(
      page.getByRole('button', { name: 'Sign out of ChatGPT' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Start a conversation' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Sign out of ChatGPT' }).click()
    await expect(signin).toBeVisible()
    await expect(page.getByText('Playground unavailable')).toBeVisible()
  })
}

test('recovers a failed sign-in request and lets the user cancel the pending code', async ({
  page,
}) => {
  let failed = false
  let state = 'signed_out'
  await page.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
        conversationSessions: true,
        available: false,
        model: 'test',
        runtime: 'Nanocodex',
      },
    }),
  )
  await page.route('**/api/auth/chatgpt', (route) => {
    if (route.request().method() === 'POST') {
      if (!failed) {
        failed = true
        return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
      }
      state = 'pending'
    }
    if (route.request().method() === 'DELETE') state = 'signed_out'
    return route.fulfill({
      json:
        state === 'pending'
          ? {
              state,
              verificationUrl: 'https://auth.openai.com/codex/device',
              userCode: 'RETRY-CODE',
              expiresAt: Date.now() + 60_000,
              pollAfterMs: 1_000,
            }
          : { state },
    })
  })
  await page.goto('/?view=playground')
  await page
    .getByRole('button', { name: 'Sign in with ChatGPT', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('could not be updated')
  await page
    .getByRole('button', { name: 'Sign in with ChatGPT', exact: true })
    .click()
  await expect(page.getByText('RETRY-CODE')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel sign-in' }).click()
  await expect(
    page.getByRole('button', { name: 'Sign in with ChatGPT', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('RETRY-CODE')).toHaveCount(0)
})

test('keeps sign-in cancellable while the authenticated runtime initializes', async ({
  page,
}) => {
  let state = 'signed_out'
  let initializing = false
  let release!: () => void
  const initialization = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/runtime', async (route) => {
    const available = state === 'authenticated'
    if (available) {
      initializing = true
      await initialization
    }
    await route.fulfill({
      json: {
        conversationSessions: true,
        available,
        model: 'test',
        runtime: 'Nanocodex',
      },
    })
  })
  await page.route('**/api/auth/chatgpt', async (route) => {
    const method = route.request().method()
    if (method === 'POST') state = 'pending'
    else if (method === 'DELETE') state = 'signed_out'
    else if (state === 'pending') state = 'authenticated'
    await route.fulfill({
      json:
        state === 'pending'
          ? {
              state,
              verificationUrl: 'https://auth.openai.com/codex/device',
              userCode: 'WAIT-CODE',
              expiresAt: Date.now() + 60_000,
              pollAfterMs: 1_000,
            }
          : { state },
    })
  })
  try {
    await page.goto('/?view=playground')
    const signin = page.getByRole('button', {
      name: 'Sign in with ChatGPT',
      exact: true,
    })
    await signin.click()
    await expect.poll(() => initializing).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Sign out of ChatGPT' }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel sign-in' }).click()
    await expect(signin).toBeVisible()
    release()
    await expect(page.getByText('Playground unavailable')).toBeVisible()
    await expect(page.getByText('WAIT-CODE')).toHaveCount(0)
  } finally {
    release()
  }
})
