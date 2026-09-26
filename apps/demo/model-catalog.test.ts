import { describe, expect, it, vi } from 'vitest'
import type { ChatGptCredential } from 'nanocodex/node'
import { ModelCatalog } from './model-catalog.ts'

describe('ModelCatalog', () => {
  it('provides the Nanocodex OpenAI models without a subscription', async () => {
    const models = await new ModelCatalog().list({})
    expect(models.map((model) => model.modelId)).toEqual([
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-6-astra',
    ])
    expect(models[2]).toMatchObject({
      defaultReasoningEffort: 'medium',
      description: 'OpenAI via Nanocodex',
      label: 'GPT-6 Astra',
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    })
    expect(models[0]?.reasoningEfforts).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ])
    expect(models[1]?.reasoningEfforts).toContain('high')
  })

  it('discovers compatible subscription models with provider metadata', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        models: [
          { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' },
          {
            slug: 'unsupported',
            display_name: 'Unsupported',
            visibility: 'list',
          },
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
      }),
    )
    const credential = {
      accessToken: 'secret',
      accountId: 'account',
      fedramp: true,
      kind: 'chatgpt',
      revision: '1',
    } as ChatGptCredential
    const catalog = new ModelCatalog({ request })

    await expect(
      Promise.all([catalog.list({ credential }), catalog.list({ credential })]),
    ).resolves.toEqual([
      [
        {
          defaultReasoningEffort: 'xhigh',
          description: 'Best for deep work',
          label: 'GPT-6 Astra Pro',
          modelId: 'gpt-6-astra',
          providerId: 'openai',
          reasoningEfforts: ['low', 'xhigh'],
        },
      ],
      [
        {
          defaultReasoningEffort: 'xhigh',
          description: 'Best for deep work',
          label: 'GPT-6 Astra Pro',
          modelId: 'gpt-6-astra',
          providerId: 'openai',
          reasoningEfforts: ['low', 'xhigh'],
        },
      ],
    ])
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1]!.headers).toMatchObject({
      Authorization: 'Bearer secret',
      'ChatGPT-Account-ID': 'account',
      'X-OpenAI-Fedramp': 'true',
    })
  })

  it('preserves compatible provider efforts without inventing replacements', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        models: [
          {
            slug: 'gpt-6-luna',
            visibility: 'list',
            supported_reasoning_levels: [
              { effort: 'high' },
              { effort: 'unsupported' },
            ],
            default_reasoning_level: 'high',
          },
          {
            slug: 'gpt-6-sol',
            visibility: 'list',
            supported_reasoning_levels: [
              { effort: 'none' },
              { effort: 'xhigh' },
              { effort: 'max' },
            ],
            default_reasoning_level: 'max',
          },
          {
            slug: 'gpt-6-astra',
            visibility: 'list',
            supported_reasoning_levels: [{ effort: 'none' }],
            default_reasoning_level: 'none',
          },
        ],
      }),
    )
    const credential = {
      accessToken: 'secret',
      accountId: 'account',
      fedramp: false,
      kind: 'chatgpt',
      revision: '1',
    } as ChatGptCredential

    await expect(
      new ModelCatalog({ request }).list({ credential }),
    ).resolves.toMatchObject([
      {
        modelId: 'gpt-6-luna',
        reasoningEfforts: ['high'],
        defaultReasoningEffort: 'high',
      },
      {
        modelId: 'gpt-6-sol',
        reasoningEfforts: ['none', 'xhigh', 'max'],
        defaultReasoningEffort: 'max',
      },
      {
        modelId: 'gpt-6-astra',
        reasoningEfforts: [],
      },
    ])
  })
})
