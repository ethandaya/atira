import { describe, expect, it, vi } from 'vitest'
import { ModelCatalog } from './model-catalog.mjs'

describe('ModelCatalog', () => {
  it('provides the Nanocodex OpenAI models without a subscription', async () => {
    const models = await new ModelCatalog().list({})
    expect(models.map(model => model.modelId)).toEqual([
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-6-astra',
    ])
    expect(models[2]).toMatchObject({
      defaultReasoningEffort: 'medium',
      description: 'OpenAI via Nanocodex',
      label: 'GPT-6 Astra',
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    })
  })

  it('discovers compatible subscription models with provider metadata', async () => {
    const request = vi.fn(async () => Response.json({
      models: [
        { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' },
        { slug: 'unsupported', display_name: 'Unsupported', visibility: 'list' },
        {
          slug: 'gpt-6-astra',
          display_name: 'GPT-6 Astra Pro',
          description: 'Best for deep work',
          visibility: 'list',
          priority: 1,
          supported_reasoning_levels: [
            { effort: 'low' },
            { effort: 'xhigh' },
            { effort: 'unsupported' },
          ],
          default_reasoning_level: 'xhigh',
        },
      ],
    }))
    const credential = {
      accessToken: 'secret',
      accountId: 'account',
      fedramp: true,
      kind: 'chatgpt',
      revision: '1',
    }
    const catalog = new ModelCatalog({ request })

    await expect(Promise.all([
      catalog.list({ credential }),
      catalog.list({ credential }),
    ])).resolves.toEqual([
      [{
        defaultReasoningEffort: 'xhigh',
        description: 'Best for deep work',
        label: 'GPT-6 Astra Pro',
        modelId: 'gpt-6-astra',
        providerId: 'openai',
        reasoningEfforts: ['low', 'xhigh'],
      }],
      [{
        defaultReasoningEffort: 'xhigh',
        description: 'Best for deep work',
        label: 'GPT-6 Astra Pro',
        modelId: 'gpt-6-astra',
        providerId: 'openai',
        reasoningEfforts: ['low', 'xhigh'],
      }],
    ])
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer secret',
      'ChatGPT-Account-ID': 'account',
      'X-OpenAI-Fedramp': 'true',
    })
  })
})
