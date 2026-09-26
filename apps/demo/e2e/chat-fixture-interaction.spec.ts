import { expect, test, type Page } from '@playwright/test'

import {
  dispatch,
  elementBounds,
  expectComposerInViewport,
  routeRuntime,
  settleLayout,
  textMetrics,
} from './chat-test-helpers'

const viewport = '[data-slot="timeline-viewport"]'

for (const fixture of [false, true]) {
  test(`keeps every typed character and the caret during mid-prompt edits (${fixture ? 'fixture' : 'live store'})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await routeRuntime(page, {
      available: true,
      model: 'test',
      runtime: 'Test',
    })
    await page.goto(fixture ? '/?fixture=workflow' : '/playground')
    const editor = page.getByRole('textbox', { name: 'Message', exact: true })
    const text =
      'Render a black bicycle with raised handlebars and gravel wheels. Use a plain background and photorealistic lighting.'
    await editor.click()
    await editor.pressSequentially(text, { delay: 2 })
    await expect(editor).toHaveValue(text)
    await editor.evaluate((element) => element.setSelectionRange(9, 9))
    await expect
      .poll(() => editor.evaluate((element) => element.selectionStart))
      .toBe(9)
    await editor.pressSequentially('beautiful ', { delay: 2 })
    const edited = text.slice(0, 9) + 'beautiful ' + text.slice(9)
    await expect(editor).toHaveValue(edited)
    expect(await editor.evaluate((element) => element.selectionStart)).toBe(19)
    await editor.press('Enter')
    await editor.pressSequentially('Next line', { delay: 2 })
    await expect(editor).toHaveValue(
      edited.slice(0, 19) + '\nNext line' + edited.slice(19),
    )
  })
}

test('preserves detached scroll and history anchors', async ({ page }) => {
  await page.goto('/?fixture=workflow')
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(18)
  await expectComposerInViewport(page)

  await page.locator(viewport).evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'detached',
  )

  const beforeAppend = await page
    .locator(viewport)
    .evaluate((element) => element.scrollTop)
  await dispatch(page, 'atira:append-turn')
  await expect(
    page.getByRole('button', { name: '1 new · Jump to latest' }),
  ).toBeVisible()
  await expect
    .poll(() => page.locator(viewport).evaluate((element) => element.scrollTop))
    .toBe(beforeAppend)

  const anchor = await firstVisibleTurn(page)
  await page
    .getByRole('button', { name: 'Load earlier messages' })
    .evaluate((button) => button.click())
  await expect(page.locator('[data-slot="turn"]')).toHaveCount(31)
  const restored = await turnTop(page, anchor.id)
  expect(Math.abs(restored - anchor.top)).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: /Jump to latest/ }).click()
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'following',
  )
})

test('submits, queues, stops, edits, and restores a reverted prompt', async ({
  page,
}) => {
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })

  await message.fill('Start a deterministic response')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Queue' })).toHaveCount(0)

  await message.fill('Review this after the active response')
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible()
  await page.getByRole('button', { name: 'Queue' }).click()
  const queue = page.locator('[data-slot="queue-list"]')
  await expect(queue).toContainText('Review this after the active response')
  await queue.getByRole('button', { name: 'Edit' }).click()
  await expect(message).toHaveValue('Review this after the active response')
  await expect(queue).toHaveCount(0)

  await message.fill('')
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('[data-slot="turn"]').last()).toHaveAttribute(
    'data-state',
    'interrupted',
  )
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  await page
    .getByRole('button', { name: 'Revert prompt fixture-turn:17' })
    .click()
  await expect(page.locator('[data-slot="revert-dock"]')).toBeVisible()
  await page.getByRole('button', { name: 'Edit prompt' }).click()
  await expect(message).toHaveValue('Fixture prompt 18')
})

test('restores composer focus, draft, and selection around requests', async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 320 })
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })
  await message.fill('Draft remains intact')
  const originalEditor = await message.elementHandle()
  await message.press('Home')
  await expect.poll(() => selectionStart(message)).toBe(0)
  for (let offset = 0; offset < 6; offset += 1) {
    await message.press('ArrowRight')
    await expect.poll(() => selectionStart(message)).toBe(offset + 1)
  }
  await settleLayout(page)
  const timelineBounds = await elementBounds(page.locator(viewport))

  await dispatch(page, 'atira:request-permission')
  const permission = page.locator('[data-slot="permission-prompt"]')
  await expect(permission).toHaveAttribute(
    'data-origin-session-id',
    'fixture-child',
  )
  await expect(
    page.getByRole('heading', { name: 'Allow preview publishing?' }),
  ).toBeFocused()
  await settleLayout(page)
  const permissionTimelineBounds = await elementBounds(page.locator(viewport))
  expect(
    Math.abs(permissionTimelineBounds.top - timelineBounds.top),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(permissionTimelineBounds.height - timelineBounds.height),
  ).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Allow once' }).click()
  await expect(message).toBeFocused()
  await expect(message).toHaveValue('Draft remains intact')
  expect(await originalEditor!.evaluate((element) => element.isConnected)).toBe(
    true,
  )
  await expect(page.locator('[data-slot="active-request-layer"]')).toHaveCount(
    0,
  )
  await expect.poll(() => selectionStart(message)).toBe(6)

  await dispatch(page, 'atira:request-question')
  await settleLayout(page)
  const questionTimelineBounds = await elementBounds(page.locator(viewport))
  expect(
    Math.abs(questionTimelineBounds.top - timelineBounds.top),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(questionTimelineBounds.height - timelineBounds.height),
  ).toBeLessThanOrEqual(1)
  await page.getByRole('radio', { name: 'Compact' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page
    .getByRole('textbox', { name: 'Review notes' })
    .fill('Keep the exact IDs.')
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.locator('[data-slot="question-request"]')).toHaveCount(0)
  await expect(message).toHaveValue('Draft remains intact')
})

test('uses commands, references, and every attachment input path', async ({
  page,
}) => {
  await page.goto('/?fixture=workflow')
  const message = page.getByRole('textbox', { name: 'Message' })

  await expect(page.getByRole('combobox', { name: 'Model' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Attach' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Agent' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Variant' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Composer actions' }).click()
  await page.getByRole('menuitem', { name: 'Commands' }).click()
  const commandInput = page.locator('[data-slot="filter-menu-popup"] input')
  await commandInput.fill('audit')
  await commandInput.press('Enter')
  await expect(message).toHaveValue('/audit ')

  await page.getByRole('button', { name: 'Composer actions' }).click()
  await page.getByRole('menuitem', { name: 'References' }).click()
  const referenceInput = page.locator('[data-slot="filter-menu-popup"] input')
  await referenceInput.fill('demo')
  await referenceInput.press('Enter')
  await expect(page.locator('[data-reference-type="file"]')).toContainText(
    '@apps/demo/src/app.tsx',
  )

  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('picker'),
    mimeType: 'text/plain',
    name: 'picker.txt',
  })
  await addClipboardFile(message, 'pasted.txt', 'pasted')
  await addDroppedFile(page, 'dropped.txt', 'dropped')
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('retry'),
    mimeType: 'text/plain',
    name: 'retry.blocked',
  })

  const attachments = page.locator('[data-slot="attachment-tray"] li')
  await expect(attachments).toHaveCount(4)
  await expect(attachments).toContainText([
    'picker.txt',
    'pasted.txt',
    'dropped.txt',
    'retry.blocked',
  ])
  const failed = attachments.filter({ hasText: 'retry.blocked' })
  await expect(failed).toHaveAttribute('data-state', 'failed')
  await failed.getByRole('button', { name: 'Retry' }).click()
  await expect(failed).toHaveAttribute('data-state', 'ready')
  await attachments
    .filter({ hasText: 'picker.txt' })
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(attachments).toHaveCount(3)
})

test('selects every built-in tool renderer and the generic fallback', async ({
  page,
}) => {
  await page.goto('/?fixture=workflow')
  const renderers = page.locator('[data-slot="tool-renderer"]')
  await expect(renderers).toHaveCount(7)
  expect(
    await renderers.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-renderer')),
    ),
  ).toEqual([
    'context',
    'shell',
    'file-change',
    'task',
    'web',
    'skill',
    'generic',
  ])
  await expect(page.locator('[data-renderer="generic"]')).toHaveAttribute(
    'data-tool-kind',
    'generic',
  )
})

test('renders a readable subagent transcript with markdown', async ({
  page,
}) => {
  await page.goto('/?fixture=workflow')
  const task = page.locator('[data-renderer="task"]')

  const trigger = task.getByRole('button', {
    name: /Review agent · Review the chat surface/,
  })
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'following',
  )
  const headerTop = (await trigger.boundingBox())!.y
  await trigger.click()

  const transcript = task.locator('[data-slot="task-transcript"]')
  await expect(transcript).toBeVisible()
  await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute(
    'data-follow-state',
    'detached',
  )
  await settleLayout(page)
  expect(
    Math.abs((await trigger.boundingBox())!.y - headerTop),
  ).toBeLessThanOrEqual(2)
  await expect(
    transcript.getByText('No blocking issues.', { exact: true }),
  ).toHaveCSS('font-weight', '600')
  await expect(task).not.toContainText('transcript is not available')

  const description = transcript.getByText('Review the chat surface', {
    exact: true,
  })
  const result = transcript.locator(
    '[aria-label="Subagent result"] [data-slot="markdown"]',
  )
  expect((await textMetrics(description)).fontSize).toBe('14px')
  expect((await textMetrics(result)).fontSize).toBe('15px')
})

async function firstVisibleTurn(page: Page) {
  return page.locator(viewport).evaluate((element) => {
    const viewportTop = element.getBoundingClientRect().top
    const turn = Array.from(
      element.querySelectorAll<HTMLElement>('[data-turn-id]'),
    ).find((item) => item.getBoundingClientRect().bottom > viewportTop)
    if (!turn?.dataset.turnId) throw new Error('No visible turn')
    return { id: turn.dataset.turnId, top: turn.getBoundingClientRect().top }
  })
}

async function turnTop(page: Page, id: string) {
  return page
    .locator(`[data-turn-id="${id}"]`)
    .evaluate((element) => element.getBoundingClientRect().top)
}

async function selectionStart(locator: ReturnType<Page['getByRole']>) {
  return locator.evaluate(
    (element) => (element as HTMLTextAreaElement).selectionStart,
  )
}

async function addClipboardFile(
  locator: ReturnType<Page['getByRole']>,
  name: string,
  contents: string,
) {
  await locator.evaluate(
    (element, { contents, name }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([contents], name, { type: 'text/plain' }))
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          clipboardData: transfer,
        }),
      )
    },
    { contents, name },
  )
}

async function addDroppedFile(page: Page, name: string, contents: string) {
  await page.locator('[data-slot="chat-composer"]').evaluate(
    (element, { contents, name }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([contents], name, { type: 'text/plain' }))
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          dataTransfer: transfer,
        }),
      )
    },
    { contents, name },
  )
}
