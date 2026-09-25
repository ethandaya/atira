import { describe, expect, it, vi } from 'vitest'

import { searchWeb } from './web-search.mjs'

describe('searchWeb', () => {
  it('uses OpenAI hosted web search and returns deduplicated public sources', async () => {
    const request = vi.fn(async () =>
      Response.json({
        output: [
          {
            action: {
              sources: [
                { title: 'StyleX', url: 'https://stylexjs.com/' },
                { title: 'Duplicate', url: 'https://stylexjs.com/' },
              ],
            },
            type: 'web_search_call',
          },
          {
            content: [
              {
                annotations: [
                  {
                    title: 'StyleX introduction',
                    type: 'url_citation',
                    url: 'https://stylexjs.com/docs/learn/',
                  },
                  { title: 'Unsafe', url: 'file:///etc/passwd' },
                ],
                text: 'StyleX is a styling system for applications.',
                type: 'output_text',
              },
            ],
            type: 'message',
          },
        ],
      }),
    )

    const result = await searchWeb({
      apiKey: 'test-key',
      model: 'test-model',
      query: '  What is StyleX?  ',
      request,
    })

    expect(result).toEqual({
      answer: 'StyleX is a styling system for applications.',
      query: 'What is StyleX?',
      sources: [
        {
          title: 'StyleX introduction',
          url: 'https://stylexjs.com/docs/learn/',
        },
        { title: 'StyleX', url: 'https://stylexjs.com/' },
      ],
    })
    expect(request).toHaveBeenCalledOnce()
    const [url, options] = request.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options.headers.Authorization).toBe('Bearer test-key')
    expect(JSON.parse(options.body)).toEqual(
      expect.objectContaining({
        include: ['web_search_call.action.sources'],
        input: 'What is StyleX?',
        model: 'test-model',
        tool_choice: 'required',
        tools: [
          expect.objectContaining({
            external_web_access: true,
            type: 'web_search',
          }),
        ],
      }),
    )
  })

  it('fails without exposing an upstream response body', async () => {
    const request = vi.fn(async () =>
      Response.json(
        { error: { message: 'sensitive upstream detail' } },
        { status: 429 },
      ),
    )

    await expect(
      searchWeb({
        apiKey: 'test-key',
        model: 'test-model',
        query: 'current news',
        request,
      }),
    ).rejects.toThrow('Web search failed with HTTP 429.')
  })
})
