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
    await page.goto('/playground')
    await expect(
      page.getByText('Sign in with your ChatGPT subscription.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', {
        name: 'Why StyleX for AI interfaces?',
        exact: true,
      }),
    ).toHaveCount(0)
    const signin = page.getByRole('button', {
      name: 'Sign in ChatGPT',
      exact: true,
    })
    await signin.focus()
    await page.keyboard.press('Enter')
    await page
      .getByRole('button', { name: 'Continue with ChatGPT', exact: true })
      .click()
    await expect(page.getByText('DEMO-CODE', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'ChatGPT device sign-in' }),
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
          .include('[data-slot="dialog-content"]')
          .analyze()
      ).violations,
    ).toEqual([])
    approved = true
    await expect(
      page.getByRole('heading', { name: 'ChatGPT connected' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(
      page.getByRole('region', {
        name: 'Playground conversation',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Connected ChatGPT', exact: true })
      .click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(signin).toBeVisible()
    await expect(
      page.getByText('Sign in with your ChatGPT subscription.', {
        exact: true,
      }),
    ).toBeVisible()
  })
}

test('refreshes the runtime when the initial status check completes sign-in', async ({
  page,
}) => {
  let runtimeRequests = 0
  await page.route('**/api/runtime', (route) => {
    runtimeRequests++
    return route.fulfill({
      json: {
        available: runtimeRequests > 1,
        model: 'test',
        models: [{ label: 'Test model', modelId: 'test', providerId: 'test' }],
        runtime: 'Nanocodex',
      },
    })
  })
  await page.route('**/api/auth/chatgpt', (route) =>
    route.fulfill({ json: { state: 'authenticated' } }),
  )

  await page.goto('/playground')

  await expect(
    page.getByRole('button', { name: 'Connected ChatGPT', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Message', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Runtime refreshed')
  await expect(
    page.getByRole('button', { name: 'Send', exact: true }),
  ).toBeEnabled()
  expect(runtimeRequests).toBeGreaterThanOrEqual(2)
})

test('recovers a failed sign-in request and lets the user cancel the pending code', async ({
  page,
}) => {
  let failed = false
  let state = 'signed_out'
  await page.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
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
  await page.goto('/playground')
  await page
    .getByRole('button', { name: 'Sign in ChatGPT', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue with ChatGPT', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('could not be updated')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('RETRY-CODE')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel sign-in' }).click()
  await expect(
    page.getByRole('button', { name: 'Continue with ChatGPT', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('RETRY-CODE')).toHaveCount(0)
})

test('shows pending polling failures and retries without discarding the device code', async ({
  page,
}) => {
  let state = 'signed_out'
  let failNextPoll = false
  await page.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
        available: false,
        model: 'test',
        runtime: 'Nanocodex',
      },
    }),
  )
  await page.route('**/api/auth/chatgpt', (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      state = 'pending'
      failNextPoll = true
    } else if (method === 'GET' && failNextPoll) {
      failNextPoll = false
      return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    }
    return route.fulfill({
      json:
        state === 'pending'
          ? {
              state,
              verificationUrl: 'https://auth.openai.com/codex/device',
              userCode: 'POLL-CODE',
              expiresAt: Date.now() + 60_000,
              pollAfterMs: 1_000,
            }
          : { state },
    })
  })

  await page.goto('/playground')
  await page
    .getByRole('button', { name: 'Sign in ChatGPT', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue with ChatGPT', exact: true })
    .click()
  await expect(page.getByText('POLL-CODE', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Could not check sign-in')
  await expect(page.getByText('POLL-CODE', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Retry sign-in status', exact: true })
    .click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('POLL-CODE', { exact: true })).toBeVisible()
})

test('shows a failed sign-out while preserving the connected state', async ({
  page,
}) => {
  await page.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
        available: true,
        model: 'test',
        runtime: 'Nanocodex',
      },
    }),
  )
  await page.route('**/api/auth/chatgpt', (route) => {
    if (route.request().method() === 'DELETE')
      return route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    return route.fulfill({ json: { state: 'authenticated' } })
  })

  await page.goto('/playground')
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Ready to submit')
  await expect(
    page.getByRole('button', { name: 'Send', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Connected ChatGPT', exact: true })
    .click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be updated')
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()
})

test('locks the playground before signed-out runtime refresh completes', async ({
  page,
}) => {
  let state = 'authenticated'
  let release!: () => void
  const refresh = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/runtime', async (route) => {
    if (state === 'signed_out') await refresh
    await route.fulfill({
      json: {
        available: state === 'authenticated',
        model: 'test',
        runtime: 'Nanocodex',
      },
    })
  })
  await page.route('**/api/auth/chatgpt', async (route) => {
    if (route.request().method() === 'DELETE') state = 'signed_out'
    await route.fulfill({ json: { state } })
  })

  try {
    await page.goto('/playground')
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Ready before sign-out')
    await expect(
      page.getByRole('button', { name: 'Send', exact: true }),
    ).toBeEnabled()
    await page
      .getByRole('button', { name: 'Connected ChatGPT', exact: true })
      .click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(
      page.getByText('Sign in with your ChatGPT subscription.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'New conversation', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Conversation history', exact: true }),
    ).toBeDisabled()
  } finally {
    release()
  }
})

test('locks another tab when the shared server session signs out', async ({
  context,
  page,
}) => {
  let state = 'authenticated'
  await context.route('**/api/runtime', (route) =>
    route.fulfill({
      json: {
        available: state === 'authenticated',
        model: 'test',
        runtime: 'Nanocodex',
      },
    }),
  )
  await context.route('**/api/auth/chatgpt', async (route) => {
    if (route.request().method() === 'DELETE') state = 'signed_out'
    await route.fulfill({ json: { state } })
  })

  const sibling = await context.newPage()
  await Promise.all([page.goto('/playground'), sibling.goto('/playground')])
  await expect(
    sibling.getByRole('textbox', { name: 'Message', exact: true }),
  ).toBeVisible()
  await sibling
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Ready in sibling')
  await expect(
    sibling.getByRole('button', { name: 'Send', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Connected ChatGPT', exact: true })
    .click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    sibling.getByText('Sign in with your ChatGPT subscription.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    sibling.getByRole('textbox', { name: 'Message', exact: true }),
  ).toHaveCount(0)
  await sibling.close()
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
    await page.goto('/playground')
    const signin = page.getByRole('button', {
      name: 'Sign in ChatGPT',
      exact: true,
    })
    await signin.click()
    await page
      .getByRole('button', { name: 'Continue with ChatGPT', exact: true })
      .click()
    await expect.poll(() => initializing).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel sign-in' }).click()
    await expect(
      page.getByRole('button', { name: 'Continue with ChatGPT', exact: true }),
    ).toBeVisible()
    release()
    await expect(
      page.getByText('Sign in with your ChatGPT subscription.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByText('WAIT-CODE')).toHaveCount(0)
  } finally {
    release()
  }
})
