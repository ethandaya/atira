import { describe, expect, it, vi } from 'vitest'

import { runAnthropicTurn, searchAnthropicWeb } from './anthropic-runtime.mjs'

const inspectComponentCatalog = {
  description: 'Inspect components.',
  parameters: {
    properties: { query: { type: 'string' } },
    required: ['query'],
    type: 'object',
  },
  handler: vi.fn(() => ({ matches: [{ name: 'Markdown' }, { name: 'Response' }] })),
}

describe('runAnthropicTurn', () => {
  it('executes catalog tools and returns a compact event projection', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(messageResponse({
        content: [
          {
            id: 'catalog-1',
            input: { query: 'streaming response' },
            name: 'inspect_component_catalog',
            type: 'tool_use',
          },
        ],
        stop_reason: 'tool_use',
      }))
      .mockResolvedValueOnce(messageResponse({
        content: [{ text: 'Use `Markdown` and `Response`.', type: 'text' }],
        stop_reason: 'end_turn',
      }))
    const onEvent = vi.fn()

    const result = await runAnthropicTurn({
      apiKey: 'test-key',
      input: 'Audit streaming responses.',
      inspectComponentCatalog,
      model: 'test-model',
      onEvent,
      request,
    })

    expect(result.finalMessage).toBe('Use `Markdown` and `Response`.')
    expect(result.history).toHaveLength(2)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      input: 'streaming response',
      tool: 'inspect_component_catalog',
      type: 'tool-started',
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      output: 'Markdown, Response',
      status: 'succeeded',
      type: 'tool-completed',
    }))
    expect(request).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(request.mock.calls[1][1].body)
    expect(secondBody.messages.at(-1).content[0]).toEqual(expect.objectContaining({
      tool_use_id: 'catalog-1',
      type: 'tool_result',
    }))
  })

  it('projects hosted web search and appends usable source links', async () => {
    const request = vi.fn(async () => messageResponse({
      content: [
        {
          id: 'web-1',
          input: { query: 'StyleX official site' },
          name: 'web_search',
          type: 'server_tool_use',
        },
        {
          content: [
            { title: 'StyleX', type: 'web_search_result', url: 'https://stylexjs.com/' },
            { title: 'Unsafe', type: 'web_search_result', url: 'file:///etc/passwd' },
          ],
          tool_use_id: 'web-1',
          type: 'web_search_tool_result',
        },
        { text: 'StyleX is maintained by Meta.', type: 'text' },
      ],
      stop_reason: 'end_turn',
    }))
    const onEvent = vi.fn()

    const result = await runAnthropicTurn({
      apiKey: 'test-key',
      input: 'Find StyleX.',
      inspectComponentCatalog,
      model: 'test-model',
      onEvent,
      request,
    })

    expect(result.finalMessage).toContain('[StyleX](https://stylexjs.com/)')
    expect(result.finalMessage).not.toContain('file:///etc/passwd')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'search_web',
      type: 'tool-started',
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      output: expect.stringContaining('https://stylexjs.com/'),
      status: 'succeeded',
      type: 'tool-completed',
    }))
  })
})

describe('searchAnthropicWeb', () => {
  it('returns a concise answer and only safe source URLs', async () => {
    const request = vi.fn(async () => messageResponse({
      content: [
        {
          content: [
            { title: 'StyleX', type: 'web_search_result', url: 'https://stylexjs.com/' },
            { title: 'Unsafe', type: 'web_search_result', url: 'file:///etc/passwd' },
          ],
          tool_use_id: 'web-1',
          type: 'web_search_tool_result',
        },
        { text: 'The official site is StyleX.', type: 'text' },
      ],
    }))

    const result = await searchAnthropicWeb({
      apiKey: 'test-key',
      model: 'test-model',
      query: 'StyleX official site',
      request,
    })

    expect(result).toEqual({
      answer: 'The official site is StyleX.',
      query: 'StyleX official site',
      sources: [{ title: 'StyleX', url: 'https://stylexjs.com/' }],
    })
  })
})

function messageResponse(overrides) {
  return Response.json({
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  })
}
