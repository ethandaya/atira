import { describe, expect, it, vi } from 'vitest'
import { ModelCatalog } from './model-catalog.mjs'

describe('ModelCatalog', () => {
  it('authenticates ChatGPT discovery, filters visibility and sorts priority without API-key filtering', async () => {
    const request = vi.fn(async () => Response.json({ models: [
      { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' },
      { slug: 'second', display_name: 'Second', visibility: 'list', priority: 2 },
      { slug: 'first', display_name: 'First', visibility: 'list', priority: 1, supported_in_api: false },
    ] }))
    let now = 0
    const catalog = new ModelCatalog({ request, now: () => now })
    const options = { kind: 'chatgpt', credential: { accessToken: 'test-token', accountId: 'account-a', fedramp: true } }
    const results = await Promise.all([catalog.list(options), catalog.list(options)])
    expect(results[0]).toEqual([
      { modelId: 'first', label: 'First', providerId: 'chatgpt' },
      { modelId: 'second', label: 'Second', providerId: 'chatgpt' },
    ])
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toBe('https://chatgpt.com/backend-api/codex/models?client_version=0.0.0')
    expect(request.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer test-token', 'ChatGPT-Account-ID': 'account-a', 'X-OpenAI-Fedramp': 'true' })
    await catalog.list({ ...options, credential: { ...options.credential, accountId: 'account-b' } })
    await catalog.list({ ...options, credential: { ...options.credential, accessToken: 'refreshed-token' } })
    expect(request).toHaveBeenCalledTimes(3)
    now = 300_001
    await catalog.list(options)
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('paginates Anthropic results using provider names and scopes the cache to the key', async () => {
    const request = vi.fn(async url => Response.json(url.includes('after_id=')
      ? { data: [{ id: 'b', display_name: 'Model B' }], has_more: false }
      : { data: [{ id: 'a', display_name: 'Model A' }], has_more: true, last_id: 'a' }))
    const catalog = new ModelCatalog({ request })
    expect(await catalog.list({ kind: 'anthropic', apiKey: 'key-a' })).toEqual([
      { modelId: 'a', label: 'Model A', providerId: 'anthropic' },
      { modelId: 'b', label: 'Model B', providerId: 'anthropic' },
    ])
    expect(request.mock.calls[0][1].headers).toEqual({ 'x-api-key': 'key-a', 'anthropic-version': '2023-06-01' })
    await catalog.list({ kind: 'anthropic', apiKey: 'key-b' })
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('uses the OpenAI data schema for API-key discovery', async () => {
    const request = vi.fn(async () => Response.json({ data: [{ id: 'api-model' }] }))
    const models = await new ModelCatalog({ request }).list({ kind: 'nanocodex', apiKey: 'test-key' })
    expect(models).toEqual([{ modelId: 'api-model', label: 'api-model', providerId: 'nanocodex' }])
    expect(request.mock.calls[0][0]).toBe('https://api.openai.com/v1/models')
  })

  it.each([
    () => new Response('Unauthorized', { status: 401 }),
    () => Response.json({ unexpected: [] }),
    () => Response.json({ data: [] }),
    () => Response.json({ data: [{ id: 'a' }], has_more: true, last_id: 'a' }),
  ])('does not cache failures or invent fallback options', async failedResponse => {
    let failed = true
    const request = vi.fn(async () => failed ? failedResponse() : Response.json({ data: [{ id: 'recovered', display_name: 'Recovered' }] }))
    const catalog = new ModelCatalog({ request })
    const options = { kind: 'anthropic', apiKey: 'key' }
    await expect(catalog.list(options)).rejects.toThrow()
    failed = false
    expect(await catalog.list(options)).toEqual([{ modelId: 'recovered', label: 'Recovered', providerId: 'anthropic' }])
  })
})
