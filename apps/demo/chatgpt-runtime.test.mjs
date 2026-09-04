import { describe, expect, it, vi } from 'vitest'

import {
  createChatGptSession,
  createChatGptSubagentTool,
  runChatGptTurn,
} from './chatgpt-runtime.mjs'

const credential = {
  accessToken: 'access-secret',
  accountId: 'account-id',
  expiresAt: Date.now() + 3_600_000,
  fedramp: false,
  refreshToken: 'refresh-secret',
}

describe('runChatGptTurn', () => {
  it('uses the Responses-Lite prefix and projects streamed text', async () => {
    const request = vi.fn(async () => sseResponse([
      { delta: 'Use ', type: 'response.output_text.delta' },
      { delta: '`Response`.', type: 'response.output_text.delta' },
      completed([
        messageOutput('Use `Response`.'),
      ]),
    ]))
    const onEvent = vi.fn()
    const session = createChatGptSession()

    const result = await runChatGptTurn({
      getCredential: vi.fn(async () => credential),
      input: 'Audit the response.',
      model: 'gpt-5.6-sol',
      onEvent,
      request,
      session,
      sessionId: 'browser-session',
      tools: { inspect_component_catalog: catalogTool() },
    })

    expect(result.finalMessage).toBe('Use `Response`.')
    expect(session.history).toHaveLength(2)
    expect(onEvent).toHaveBeenCalledWith({ text: 'Use ', type: 'assistant-delta' })
    const [url, options] = request.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(url).toBe('https://chatgpt.com/backend-api/codex/responses')
    expect(options.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer access-secret',
      'ChatGPT-Account-ID': 'account-id',
      'x-openai-internal-codex-responses-lite': 'true',
    }))
    expect(body).not.toHaveProperty('instructions')
    expect(body).not.toHaveProperty('tools')
    expect(body.input[0]).toEqual(expect.objectContaining({
      role: 'developer',
      type: 'additional_tools',
    }))
    expect(body.input[1]).toEqual(expect.objectContaining({
      role: 'developer',
      type: 'message',
    }))
    expect(body.input[2]).toEqual(expect.objectContaining({ role: 'user' }))
  })

  it('executes function calls and includes their output in the next request', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([
        {
          item: {
            arguments: '{"query":"streaming"}',
            call_id: 'catalog-call',
            name: 'inspect_component_catalog',
            type: 'function_call',
          },
          type: 'response.output_item.done',
        },
        completed([]),
      ]))
      .mockResolvedValueOnce(sseResponse([
        { delta: 'Use Markdown.', type: 'response.output_text.delta' },
        completed([messageOutput('Use Markdown.')]),
      ]))
    const onEvent = vi.fn()
    const tool = catalogTool()

    const result = await runChatGptTurn({
      getCredential: vi.fn(async () => credential),
      input: 'Find streaming components.',
      model: 'gpt-5.6-sol',
      onEvent,
      request,
      session: createChatGptSession(),
      sessionId: 'browser-session',
      tools: { inspect_component_catalog: tool },
    })

    expect(result.finalMessage).toBe('Use Markdown.')
    expect(tool.handler).toHaveBeenCalledWith(
      { query: 'streaming' },
      expect.objectContaining({ signal: undefined }),
    )
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      input: 'streaming',
      tool: 'inspect_component_catalog',
      type: 'tool-started',
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      output: 'Markdown',
      status: 'succeeded',
      type: 'tool-completed',
    }))

    const secondBody = JSON.parse(request.mock.calls[1][1].body)
    expect(secondBody.input).toEqual(expect.arrayContaining([
      expect.objectContaining({
        call_id: 'catalog-call',
        output: JSON.stringify({ matches: [{ name: 'Markdown' }] }),
        type: 'function_call_output',
      }),
    ]))
  })

  it('refreshes once and retries a response rejected as unauthorized', async () => {
    const refreshedCredential = { ...credential, accessToken: 'refreshed-access' }
    const getCredential = vi
      .fn()
      .mockResolvedValueOnce(credential)
      .mockResolvedValueOnce(refreshedCredential)
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(sseResponse([
        { delta: 'Connected.', type: 'response.output_text.delta' },
        completed([]),
      ]))

    const result = await runChatGptTurn({
      getCredential,
      input: 'Connect.',
      model: 'gpt-5.6-sol',
      request,
      session: createChatGptSession(),
      sessionId: 'browser-session',
      tools: { inspect_component_catalog: catalogTool() },
    })

    expect(result.finalMessage).toBe('Connected.')
    expect(getCredential).toHaveBeenNthCalledWith(2, { forceRefresh: true })
    expect(request.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer refreshed-access',
    )
  })

  it('runs a bounded child session without exposing recursive delegation', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([
        {
          delta: 'I will inspect the component contract.',
          type: 'response.reasoning_summary_text.delta',
        },
        {
          item: {
            arguments: '{"query":"tool activity"}',
            call_id: 'child-catalog-call',
            name: 'inspect_component_catalog',
            type: 'function_call',
          },
          type: 'response.output_item.done',
        },
        completed([]),
      ]))
      .mockResolvedValueOnce(sseResponse([
        { delta: 'The focused review passed.', type: 'response.output_text.delta' },
        completed([messageOutput('The focused review passed.')]),
      ]))
    const tool = createChatGptSubagentTool({
      getCredential: vi.fn(async () => credential),
      model: 'gpt-5.6-sol',
      request,
      tools: { inspect_component_catalog: catalogTool() },
    })
    const invocation = tool.invocation({ role: 'review' })

    const result = await tool.handler(
      { role: 'review', task: 'Review the compact tool row.' },
      { invocation },
    )

    expect(invocation).toEqual(expect.objectContaining({
      agent: { id: 'review', label: 'Review agent' },
      childSessionId: expect.any(String),
      kind: 'task',
      transcript: {
        reasoning: 'I will inspect the component contract.',
        result: 'The focused review passed.',
        steps: [
          {
            id: 'child-catalog-call',
            input: 'tool activity',
            output: 'Markdown',
            status: 'succeeded',
            summary: 'Searched component catalog',
            tool: 'inspect_component_catalog',
          },
        ],
      },
    }))
    expect(result).toEqual({ result: 'The focused review passed.' })
    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body.input[0].tools.map((candidate) => candidate.name)).toEqual([
      'inspect_component_catalog',
    ])
    expect(body.input[1].content[0].text).toContain('ability to delegate')
    expect(request.mock.calls[0][1].headers['session-id']).toBe(
      invocation.childSessionId,
    )
  })
})

function catalogTool() {
  return {
    completedSummary: 'Searched component catalog',
    description: 'Inspect components.',
    formatInput: (value) => value.query,
    formatOutput: (value) => value.matches.map((match) => match.name).join(', '),
    handler: vi.fn(async () => ({ matches: [{ name: 'Markdown' }] })),
    parameters: {
      additionalProperties: false,
      properties: { query: { type: 'string' } },
      required: ['query'],
      type: 'object',
    },
    startedSummary: 'Searching component catalog',
  }
}

function completed(output) {
  return {
    response: {
      id: 'response-id',
      output,
      status: 'completed',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    },
    type: 'response.completed',
  }
}

function messageOutput(text) {
  return {
    content: [{ text, type: 'output_text' }],
    role: 'assistant',
    type: 'message',
  }
}

function sseResponse(events) {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}
