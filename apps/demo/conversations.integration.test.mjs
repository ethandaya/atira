import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'
import { WebSocketServer } from 'ws'

it('runs Nanocodex through an isolated Responses transport and replays turns', { timeout: 30_000 }, async () => {
  const providerRequests = []
  const provider = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(provider, 'listening')
  provider.on('connection', socket => socket.on('message', bytes => {
    const body = JSON.parse(bytes.toString())
    if (body.generate === false) {
      socket.send(JSON.stringify({ type: 'response.completed', response: { id: 'warmup', usage: null } }))
      return
    }
    providerRequests.push(body)
    if (JSON.stringify(body.input).includes('Hold this response')) return
    const hasToolOutput = body.input.some(item => item.type === 'function_call_output')
    const listAgents = JSON.stringify(body.input).includes('List runtime agents')
    const completed = hasToolOutput
      ? {
          id: 'resp2',
          status: 'completed',
          end_turn: true,
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'DONE' }] }],
          usage: null,
        }
      : {
          id: 'resp1',
          status: 'completed',
          end_turn: false,
          output: [{ type: 'function_call', call_id: 'call1', name: listAgents ? 'list_agents' : 'inspect_component_catalog', arguments: listAgents ? '{}' : '{"query":"button"}' }],
          usage: null,
        }
    if (hasToolOutput) socket.send(JSON.stringify({ type: 'response.output_text.delta', item_id: 'message', output_index: 0, content_index: 0, delta: 'DONE' }))
    socket.send(JSON.stringify({ type: 'response.completed', response: completed }))
  }))
  const providerPort = provider.address().port

  const port = await reservePort()
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      NANOCODEX_API_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      NANOCODEX_WEBSOCKET_URL: `ws://127.0.0.1:${providerPort}/v1/responses`,
      NANOCODEX_MODEL: 'gpt-6-sol',
      OPENAI_API_KEY: 'isolated-test-key',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const base = `http://127.0.0.1:${port}`

  try {
    const runtime = await waitForServer(base, child, () => output)
    expect(await runtime.json()).toMatchObject({
      available: true,
      model: 'gpt-6-sol',
      models: [
        { label: 'GPT-6 Sol', modelId: 'gpt-6-sol' },
        { label: 'GPT-6 Luna', modelId: 'gpt-6-luna' },
        { label: 'GPT-6 Astra', modelId: 'gpt-6-astra' },
      ],
      runtime: 'Nanocodex',
    })
    const cookie = runtime.headers.get('set-cookie').split(';')[0]
    const conversationId = randomUUID()
    const turnId = randomUUID()
    const headers = { Cookie: cookie, 'Content-Type': 'application/json', 'X-Conversation-Id': conversationId }
    const body = JSON.stringify({ input: 'Find the button component', turnId })

    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers, body })
    expect(response.status).toBe(200)
    const events = await streamEvents(response)
    if (events.some(event => event.type === 'error')) {
      await delay(100)
      throw new Error(`Runtime error: ${JSON.stringify({ events, output, providerRequests: providerRequests.length })}`)
    }
    expect(events.map(event => event.type)).toEqual([
      'started',
      'tool-started',
      'tool-completed',
      'assistant-delta',
      'assistant-message',
      'completed',
    ])
    expect(events.find(event => event.type === 'tool-started')).toMatchObject({ input: 'button', tool: 'inspect_component_catalog' })
    expect(events.find(event => event.type === 'tool-completed')).toMatchObject({ status: 'succeeded', tool: 'inspect_component_catalog' })
    expect(events.find(event => event.type === 'tool-completed').output).toContain('Button')
    expect(events.find(event => event.type === 'completed')).toMatchObject({ message: 'DONE' })
    expect(providerRequests).toHaveLength(2)
    expect(providerRequests[0].model).toBe('gpt-6-sol')
    expect(providerRequests[1].input).toContainEqual(expect.objectContaining({ type: 'function_call_output', call_id: 'call1' }))

    const replay = await fetch(`${base}/api/chat?turnId=${turnId}`, { headers })
    expect(await streamEvents(replay)).toEqual(events)
    const retry = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: 'Find the button component', retry: true, turnId }),
    })
    expect(await streamEvents(retry)).toEqual(events)
    expect(providerRequests).toHaveLength(2)

    const other = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { ...headers, 'X-Conversation-Id': randomUUID() },
      body: JSON.stringify({
        input: 'List runtime agents',
        model: { modelId: 'gpt-6-luna', providerId: 'openai' },
        reasoningEffort: 'low',
        turnId: randomUUID(),
      }),
    })
    const nativeEvents = await streamEvents(other)
    expect(nativeEvents.at(-1)).toMatchObject({ message: 'DONE', type: 'completed' })
    expect(nativeEvents).toContainEqual(expect.objectContaining({ type: 'tool-started', tool: 'list_agents', input: '{}' }))
    expect(nativeEvents).toContainEqual(expect.objectContaining({ type: 'tool-completed', tool: 'list_agents', status: 'succeeded' }))
    expect(providerRequests).toHaveLength(4)
    expect(providerRequests[2]).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'low' },
    })

    const activeId = randomUUID()
    const active = await fetch(`${base}/api/chat`, {
      method: 'POST', headers,
      body: JSON.stringify({ input: 'Hold this response', turnId: activeId, resume: true }),
    })
    await expect.poll(() => providerRequests.length).toBe(5)
    const cancel = (requestHeaders, id) => fetch(`${base}/api/cancel`, {
      method: 'POST', headers: requestHeaders, body: JSON.stringify({ turnId: id }),
    })
    expect(await (await cancel({ ...headers, Cookie: '' }, activeId)).json()).toEqual({ cancelled: false })
    expect(await (await cancel({ ...headers, 'X-Conversation-Id': randomUUID() }, activeId)).json()).toEqual({ cancelled: false })
    expect(await (await cancel(headers, turnId)).json()).toEqual({ cancelled: false })
    expect(await (await cancel(headers, activeId)).json()).toEqual({ cancelled: true })
    expect((await streamEvents(active)).at(-1)).toEqual({ type: 'cancelled' })
    expect(providerRequests).toHaveLength(5)

    const foreignReplay = await fetch(`${base}/api/chat?turnId=${activeId}`, {
      headers: { ...headers, Cookie: '' },
    })
    expect(foreignReplay.status).toBe(404)
    expect((await fetch(`${base}/api/images/removed`, { headers })).status).toBe(404)
    const auth = await fetch(`${base}/api/auth/chatgpt`, { headers })
    expect(auth.headers.get('cache-control')).toBe('no-store')
    expect(await auth.json()).toEqual({ state: 'signed_out' })
    expect((await fetch(`${base}/api/auth/chatgpt`, { method: 'POST', headers: { ...headers, Origin: 'https://foreign.example' } })).status).toBe(403)
    expect((await fetch(`${base}/api/chat`, { method: 'POST', headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' }, body })).status).toBe(403)
    const logoutTurn = await fetch(`${base}/api/chat`, {
      method: 'POST', headers,
      body: JSON.stringify({ input: 'Hold this response for logout', turnId: randomUUID(), resume: true }),
    })
    await expect.poll(() => providerRequests.length).toBe(6)
    expect((await fetch(`${base}/api/auth/chatgpt`, { method: 'DELETE', headers })).status).toBe(200)
    expect((await streamEvents(logoutTurn)).at(-1)).toEqual({ type: 'cancelled' })
    expect((await fetch(`${base}/api/chat?turnId=${turnId}`, { headers })).status).toBe(404)
  } finally {
    await stopChild(child)
    await new Promise(resolve => provider.close(resolve))
  }
})

async function streamEvents(response) {
  expect(response.status).toBe(200)
  return (await response.text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
}

async function reservePort() {
  const server = createServer()
  await listen(server)
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function waitForServer(base, child, getOutput) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await fetch(`${base}/api/runtime`).catch(() => undefined)
    if (response?.ok) return response
    if (child.exitCode !== null) throw new Error(`Isolated demo server exited: ${getOutput()}`)
    await delay(100)
  }
  throw new Error(`Isolated demo server did not start: ${getOutput()}`)
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const forceExit = setTimeout(() => child.kill('SIGKILL'), 2_000)
  await exited
  clearTimeout(forceExit)
}
