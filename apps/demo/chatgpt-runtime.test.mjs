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
  it('retries only the failed provider request and resumes its checkpoint after exhaustion', async () => {
    const tool = catalogTool()
    const checkpoint = {}
    const session = createChatGptSession()
    const request = vi.fn()
      .mockResolvedValueOnce(sseResponse([completed([{ type: 'function_call', call_id: 'saved', name: 'search_web', arguments: '{"query":"bike"}' }])]))
      .mockImplementation(async () => new Response('', { status: 503, headers: { 'Retry-After': '0' } }))
    const events = []
    const options = { getCredential: async () => credential, input: 'Find a bike', model: 'test', request, session, sessionId: 'test', checkpoint, tools: { search_web: tool }, onEvent: event => events.push(event) }
    await expect(runChatGptTurn(options)).rejects.toThrow('503')
    expect(request).toHaveBeenCalledTimes(4)
    expect(events.filter(event => event.type === 'provider-retry').map(event => event.attempt)).toEqual([2, 3])
    expect(tool.handler).toHaveBeenCalledTimes(1)
    request.mockImplementation(async () => sseResponse([completed([messageOutput('Found it.')])]))
    events.length = 0
    expect((await runChatGptTurn(options)).finalMessage).toBe('Found it.')
    expect(tool.handler).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(5)
    expect(JSON.parse(request.mock.calls[4][1].body).input).toContainEqual(expect.objectContaining({ type: 'function_call_output', call_id: 'saved' }))
    expect(session.history.filter(item => item.role === 'user')).toHaveLength(1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-completed', id: 'saved', status: 'succeeded' }))
  })

  it('resumes a failed child request without rerunning parent image generation or child searches', async () => {
    const image = catalogTool()
    const search = catalogTool()
    const childRequest = vi.fn()
      .mockResolvedValueOnce(sseResponse([completed([{ type: 'function_call', call_id: 'child-search', name: 'search_web', arguments: '{"query":"reference"}' }])]))
      .mockImplementation(async () => new Response('', { status: 503, headers: { 'Retry-After': '0' } }))
    const getCredential = async () => credential
    const child = createChatGptSubagentTool({ getCredential, model: 'test', request: childRequest, tools: { search_web: search } })
    const request = vi.fn()
      .mockResolvedValueOnce(sseResponse([completed([
        { type: 'function_call', call_id: 'image', name: 'generate_image', arguments: '{"query":"bike"}' },
        { type: 'function_call', call_id: 'child', name: 'run_subagent', arguments: '{"task":"Research references","role":"research"}' },
      ])]))
      .mockImplementation(async () => sseResponse([completed([messageOutput('All done.')])]))
    const checkpoint = {}
    const options = { getCredential, input: 'Research and render', model: 'test', request, session: createChatGptSession(), sessionId: 'test', checkpoint, tools: { generate_image: image, run_subagent: child } }
    await expect(runChatGptTurn(options)).rejects.toThrow('503')
    const childId = checkpoint.executions.child.invocation.childSessionId
    childRequest.mockImplementation(async () => sseResponse([completed([messageOutput('References ready.')])]))
    expect((await runChatGptTurn(options)).finalMessage).toBe('All done.')
    expect(image.handler).toHaveBeenCalledTimes(1)
    expect(search.handler).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(2)
    expect(childRequest).toHaveBeenCalledTimes(5)
    const task = checkpoint.events.findLast(event => event.id === 'child' && event.status === 'succeeded')
    expect(task.childSessionId).toBe(childId)
    expect(task.transcript.steps).toHaveLength(1)
  })

  it('discards partial failed-stream output and retries without duplicate text', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(sseResponse([{ type: 'response.output_text.delta', delta: 'Discard this' }]))
      .mockResolvedValueOnce(sseResponse([{ type: 'response.output_text.delta', delta: 'Recovered' }, completed([messageOutput('Recovered')])]))
    const checkpoint = {}
    const result = await runChatGptTurn({ getCredential: async () => credential, input: 'Hello', model: 'test', request, session: createChatGptSession(), sessionId: 'test', checkpoint, tools: {} })
    expect(result.finalMessage).toBe('Recovered')
    expect(checkpoint.events).not.toContainEqual({ type: 'assistant-delta', text: 'Discard this' })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not retry invalid requests or cancellation, including during backoff', async () => {
    for (const status of [400, 403]) {
      const request = vi.fn(async () => new Response('', { status }))
      await expect(runChatGptTurn({ getCredential: async () => credential, input: 'Hello', model: 'test', request, session: createChatGptSession(), sessionId: 'test', tools: {} })).rejects.toThrow(String(status))
      expect(request).toHaveBeenCalledTimes(1)
    }
    const controller = new AbortController()
    const request = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '10' } }))
    await expect(runChatGptTurn({ getCredential: async () => credential, input: 'Hello', model: 'test', request, session: createChatGptSession(), sessionId: 'test', tools: {}, signal: controller.signal, onEvent: event => { if (event.type === 'provider-retry') controller.abort() } })).rejects.toMatchObject({ name: 'AbortError' })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('forwards selected effort through authentication refresh and to subagents', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockImplementation(async () => sseResponse([completed([messageOutput('Done.')])]))
    const getCredential = vi.fn(async () => credential)
    await runChatGptTurn({ getCredential, input: 'Think carefully', model: 'test', reasoningEffort: 'high', request, session: createChatGptSession(), sessionId: 'test', tools: {} })
    const child = createChatGptSubagentTool({ getCredential, model: 'test', reasoningEffort: 'high', request, tools: {} })
    await child.handler({ task: 'Review this', role: 'review' })
    expect(request).toHaveBeenCalledTimes(3)
    for (const call of request.mock.calls) expect(JSON.parse(call[1].body).reasoning.effort).toBe('high')
    expect(getCredential).toHaveBeenCalledWith({ forceRefresh: true })
  })

  it('keeps a failed request and partial reply for continue without leaking tool protocol items', async () => {
    const session = createChatGptSession()
    const request = vi.fn()
      .mockResolvedValueOnce(sseResponse([completed([
        { type: 'function_call', call_id: 'catalog-call', name: 'inspect_component_catalog', arguments: '{"query":"bike"}' },
      ])]))
      .mockResolvedValueOnce(sseResponse([
        { type: 'response.output_text.delta', delta: 'I found a possible supplier.' },
        { type: 'error', error: { message: 'network error' } },
      ]))
      .mockResolvedValueOnce(sseResponse([completed([messageOutput('Continuing the bike search.')])]))
    const options = { getCredential: async () => credential, model: 'test', request, session, sessionId: 'test-session', tools: { inspect_component_catalog: catalogTool() } }
    await expect(runChatGptTurn({ ...options, input: 'Find bike parts shipping to Brooklyn' })).rejects.toThrow('network error')
    expect(session.history).toEqual([
      expect.objectContaining({ role: 'user', content: [{ type: 'input_text', text: 'Find bike parts shipping to Brooklyn' }] }),
      expect.objectContaining({ role: 'assistant', content: [{ type: 'output_text', text: 'I found a possible supplier.\n\n[This response is incomplete.]' }] }),
    ])
    await runChatGptTurn({ ...options, input: 'continue' })
    const sent = JSON.parse(request.mock.calls[2][1].body).input
    expect(sent.filter(item => item.role === 'user').map(item => item.content[0].text))
      .toEqual(['Find bike parts shipping to Brooklyn', 'continue'])
    expect(sent.some(item => item.type === 'function_call' || item.type === 'function_call_output')).toBe(false)
    expect(session.history.filter(item => item.role === 'user')).toHaveLength(2)
  })

  it('publishes partial child transcripts before a network failure', async () => {
    const request = vi.fn(async () => sseResponse([
      { type: 'response.reasoning_summary_text.delta', delta: 'Checking ' },
      { type: 'response.reasoning_summary_text.delta', delta: 'stores.' },
      { type: 'response.output_text.delta', delta: 'One possible ' },
      { type: 'response.output_text.delta', delta: 'supplier.' },
      { type: 'error', error: { message: 'network error' } },
    ]))
    const tool = createChatGptSubagentTool({ getCredential: async () => credential, model: 'test', request, tools: {} })
    const input = { task: 'Find bike stores', role: 'research' }
    const invocation = tool.invocation(input)
    const snapshots = []
    await expect(tool.handler(input, { invocation, onProgress: () => snapshots.push(structuredClone(invocation.transcript)) }))
      .rejects.toThrow('network error')
    expect(snapshots.at(-1)).toEqual({ reasoning: 'Checking stores.', result: 'One possible supplier.', steps: [] })
    expect(invocation.transcript).toEqual(snapshots.at(-1))
  })

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
    const onProgress = vi.fn()

    const result = await tool.handler(
      { role: 'review', task: 'Review the compact tool row.' },
      { invocation, onProgress },
    )

    expect(invocation).toEqual(expect.objectContaining({
      agent: { id: 'review', label: 'Review agent' },
      activity: {
        summary: 'Writing response',
      },
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
    expect(onProgress).toHaveBeenCalledTimes(4)
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
