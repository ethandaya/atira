import { expect, test } from '@playwright/test'

import { routeRuntime } from './chat-test-helpers'

test('preserves the configured Nanocodex model across send, reload, and retry', async ({
  page,
}) => {
  const model = {
    label: 'Nanocodex',
    modelId: 'nanocodex',
    providerId: 'nanocodex',
  }
  const requestModel = {
    modelId: model.modelId,
    providerId: model.providerId,
  }
  const requests: { model: typeof requestModel; retry: boolean }[] = []
  await routeRuntime(page, {
    retryTurns: true,
    available: true,
    model: model.modelId,
    models: [model],
    runtime: 'Nanocodex',
  })
  await page.route('**/api/chat', (route) => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify(
        requests.length === 1
          ? { type: 'error', message: 'Temporary provider failure.' }
          : {
              type: 'completed',
              message: 'Recovered with the original model.',
              durationMs: 1,
              usage: { outputTokens: 1, totalTokens: 2 },
            },
      ),
    })
  })
  await page.goto('/playground')
  const picker = page.getByRole('combobox', { name: 'Model', exact: true })
  await expect(picker).toContainText('Nanocodex')
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Test the selected model')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.locator('[data-slot="turn"]')).toHaveAttribute(
    'data-state',
    'failed',
  )
  expect(requests[0]?.model).toEqual(requestModel)
  await page.reload()
  await expect(picker).toContainText('Nanocodex')
  await page
    .getByRole('button', { name: 'Retry response', exact: true })
    .click()
  await expect(page.locator('[data-slot="turn"]')).toHaveAttribute(
    'data-state',
    'complete',
  )
  expect(requests[1]).toMatchObject({ model: requestModel, retry: true })
  await expect(picker).toContainText('Nanocodex')
  const identity = page.getByRole('group', { name: 'Response author' })
  const answer = page.locator('[data-slot="turn-assistant-message"]')
  const headerBox = (await identity.boundingBox())!
  const answerBox = (await answer.boundingBox())!
  expect(answerBox.y - headerBox.y - headerBox.height).toBeGreaterThanOrEqual(8)
  expect(Math.abs(answerBox.x - headerBox.x)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-slot="turn-meta"]')).toHaveCount(0)

  await page.addInitScript(() => {
    const key = 'atira:conversations:v1'
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    const turn = saved.conversations.find(
      (item: { id: string }) => item.id === saved.activeId,
    ).turns[0]
    turn.agent = {
      id: 'research',
      label: 'Research and implementation review agent',
    }
    turn.model.label = 'A model with an unusually long descriptive name'
    sessionStorage.setItem(key, JSON.stringify(saved))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(identity).toContainText(
    'Research and implementation review agent',
  )
  const mobileIdentity = (await identity.boundingBox())!
  expect(mobileIdentity.x).toBeGreaterThanOrEqual(0)
  expect(mobileIdentity.x + mobileIdentity.width).toBeLessThanOrEqual(390)
  expect(
    await identity.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
})

test('retains failed catalog evidence and retries the response in place', async ({
  page,
}) => {
  const requests: { input: string; turnId: string; retry: boolean }[] = []
  let releaseRetry: () => void = () => undefined
  const retryReady = new Promise<void>((resolve) => {
    releaseRetry = resolve
  })
  await routeRuntime(page, {
    retryTurns: true,
    available: true,
    model: 'test',
    runtime: 'Test runtime',
  })
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON())
    if (requests.length > 1) await retryReady
    const events =
      requests.length === 1
        ? [
            {
              type: 'tool-started',
              id: 'catalog',
              tool: 'inspect_component_catalog',
              summary: 'Inspecting catalog',
              input: 'Find bike components',
            },
            {
              type: 'tool-completed',
              id: 'catalog',
              tool: 'inspect_component_catalog',
              status: 'failed',
              summary: 'Catalog failed',
              error: 'Catalog unavailable',
            },
            { type: 'error', message: 'network error' },
          ]
        : [
            {
              type: 'completed',
              message: 'Research recovered.',
              durationMs: 1,
              usage: { outputTokens: 1, totalTokens: 2 },
            },
          ]
    await route.fulfill({
      contentType: 'application/x-ndjson',
      body: events.map((event) => JSON.stringify(event)).join('\n'),
    })
  })
  await page.goto('/playground')
  const editor = page.getByRole('textbox', { name: 'Message', exact: true })
  await editor.fill('Find a bike')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const turn = page.locator('[data-slot="turn"]')
  await expect(turn).toHaveAttribute('data-state', 'failed')
  await editor.fill('Keep my draft')
  await page.reload()
  const catalog = page.locator('[data-tool="inspect_component_catalog"]')
  await catalog.getByRole('button').click()
  await expect(
    catalog.locator('dd').filter({ hasText: 'Catalog unavailable' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Retry response', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Conversation history', exact: true }),
  ).toBeDisabled()
  expect(requests).toHaveLength(2)
  expect(requests[1]).toMatchObject({
    turnId: requests[0]!.turnId,
    input: 'Find a bike',
    retry: true,
  })
  releaseRetry()
  await expect(turn).toHaveAttribute('data-state', 'complete')
  await expect(turn).toHaveCount(1)
  await expect(turn).toContainText('Research recovered.')
  await expect(editor).toHaveValue('Keep my draft')
  await expect(
    page.getByRole('button', { name: 'Retry response', exact: true }),
  ).toHaveCount(0)
})

test('preserves and resumes conversations and drafts across reloads', async ({
  page,
}) => {
  const contexts = new Map<string, string[]>()
  await routeRuntime(page, {
    available: true,
    model: 'test',
    runtime: 'Test runtime',
  })
  await page.route('**/api/chat', async (route) => {
    const id = route.request().headers()['x-conversation-id']!
    const { input, resume } = route.request().postDataJSON()
    if (resume && !contexts.has(id)) {
      await route.fulfill({
        status: 409,
        json: { error: 'Runtime context expired. Start a new conversation.' },
      })
      return
    }
    const history = [...(contexts.get(id) ?? []), input]
    contexts.set(id, history)
    await route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify({
        type: 'completed',
        message: history.join(' / '),
        durationMs: 1,
        usage: { outputTokens: 1, totalTokens: 2 },
      }),
    })
  })
  await page.goto('/playground')
  const editor = page.getByRole('textbox', { name: 'Message', exact: true })
  const send = async (text: string) => {
    await editor.fill(text)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.locator('[data-slot="turn"]').last()).toHaveAttribute(
      'data-state',
      'complete',
    )
  }
  await send('Remember alpha')
  await editor.fill('Alpha draft')
  await page.reload()
  await expect(editor).toHaveValue('Alpha draft')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'New conversation', exact: true })
    .click()
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(0)
  await send('Remember beta')
  await editor.fill('Beta draft')
  await page
    .getByRole('button', { name: 'Conversation history', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Remember alpha', exact: true })
    .click()
  await expect(editor).toHaveValue('Alpha draft')
  await send('Continue alpha')
  await expect(page.locator('[data-slot="turn"]').last()).toContainText(
    'Remember alpha / Continue alpha',
  )
  await page.reload()
  await page
    .getByRole('button', { name: 'Conversation history', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Remember beta', exact: true })
    .click()
  await expect(editor).toHaveValue('Beta draft')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(1)
  contexts.clear()
  await editor.fill('Resume expired conversation')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    page.getByText('Runtime context expired. Start a new conversation.'),
  ).toBeVisible()
  await expect(editor).toHaveValue('Resume expired conversation')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(1)
})
