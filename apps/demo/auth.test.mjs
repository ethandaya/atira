import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { Agent } from 'nanocodex/node'
import { expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'

import { DemoAuth } from './auth.mjs'
import { authStatusSchema } from './chat-contract.mjs'

it('uses native device login and ChatGPT transport without exposing credentials or sharing accounts', async () => {
  const reset = vi.fn(async () => {})
  const requests = []
  const accessToken = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  const auth = new DemoAuth({ reset, fetch: async input => {
    const path = new URL(String(input)).pathname
    requests.push(path)
    if (path.endsWith('/usercode')) return Response.json({ device_auth_id: 'device-secret', user_code: 'DEMO-CODE', interval: 1 })
    if (path.endsWith('/deviceauth/token')) return Response.json({ authorization_code: 'code-secret', code_verifier: 'verifier-secret' })
    if (path === '/oauth/token') return Response.json({
      access_token: accessToken,
      refresh_token: 'refresh-secret',
      id_token: jwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'account-secret' } }),
    })
    throw new Error(`Unexpected auth request: ${path}`)
  } })
  const id = randomUUID()
  const otherId = randomUUID()
  const provider = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(provider, 'listening')
  const headers = []
  provider.on('connection', (socket, request) => {
    headers.push(request.headers)
    socket.on('message', () => socket.send(JSON.stringify({ type: 'response.completed', response: {
      id: 'response-1', status: 'completed', end_turn: true, usage: null,
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Subscription works' }] }],
    } })))
  })
  let agent
  let turn
  try {
    const [first, duplicate] = await Promise.all([auth.change(id, 'start'), auth.change(id, 'start')])
    expect(first).toEqual(duplicate)
    expect(authStatusSchema.parse(first)).toMatchObject({ state: 'pending', userCode: 'DEMO-CODE' })
    expect(requests).toEqual(['/api/accounts/deviceauth/usercode'])
    expect(await auth.change(otherId, 'status')).toEqual({ state: 'signed_out' })
    expect(() => auth.transport(otherId, undefined, {})).toThrow('Sign in with ChatGPT')

    await delay(first.pollAfterMs + 20)
    const authenticated = await auth.change(id, 'status')
    expect(authStatusSchema.parse(authenticated)).toEqual({ state: 'authenticated' })
    expect(requests).toEqual(['/api/accounts/deviceauth/usercode', '/api/accounts/deviceauth/token', '/oauth/token'])

    const endpoint = `127.0.0.1:${provider.address().port}`
    agent = await Agent.create({
      transport: auth.transport(id, undefined, { apiBaseUrl: `http://${endpoint}`, websocketUrl: `ws://${endpoint}` }),
      model: 'gpt-6-sol', instructions: 'Answer briefly.', tools: {}, toolMode: 'direct',
    })
    turn = agent.turn.prompt({ input: 'Hello' })
    const result = await turn.result()
    expect(result.finalMessage).toBe('Subscription works')
    result.dispose()
    expect(headers[0].authorization).toBe(`Bearer ${accessToken}`)
    expect(headers[0]['chatgpt-account-id']).toBe('account-secret')
    await agent.session.shutdown()
    agent = undefined

    expect(await auth.change(id, 'logout')).toEqual({ state: 'signed_out' })
    expect(() => auth.transport(id, undefined, {})).toThrow('Sign in with ChatGPT')
    expect(reset.mock.calls).toEqual([[id], [id], [id]])
  } finally {
    turn?.dispose()
    await agent?.session.shutdown()
    auth.dispose()
    await new Promise(resolve => provider.close(resolve))
  }
}, 15_000)

it('serializes account changes with turn acquisition without blocking other browsers', async () => {
  const operations = []
  const auth = new DemoAuth({ reset: async id => { operations.push(`reset:${id}`) } })
  let finish
  const gate = new Promise(resolve => { finish = resolve })
  try {
    const acquire = auth.run('one', async () => { operations.push('acquire'); await gate })
    const logout = auth.change('one', 'logout')
    const next = auth.run('one', async () => { operations.push('next') })
    await auth.change('two', 'logout')
    expect(operations).toEqual(['acquire', 'reset:two'])
    finish()
    await Promise.all([acquire, logout, next])
    expect(operations).toEqual(['acquire', 'reset:two', 'reset:one', 'next'])
  } finally {
    finish()
    auth.dispose()
  }
})

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}
