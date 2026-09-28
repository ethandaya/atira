import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { Agent } from 'nanocodex/node'
import { expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'

import { DemoAuth } from './auth.ts'
import { authStatusSchema } from './chat-contract.ts'

it('uses native device login and ChatGPT transport without exposing credentials or sharing accounts', async () => {
  const reset = vi.fn(async () => {})
  const requests: string[] = []
  const accessToken = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
  const auth = new DemoAuth({
    reset,
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      requests.push(path)
      if (path.endsWith('/usercode'))
        return Response.json({
          device_auth_id: 'device-secret',
          user_code: 'DEMO-CODE',
          interval: 1,
        })
      if (path.endsWith('/deviceauth/token'))
        return Response.json({
          authorization_code: 'code-secret',
          code_verifier: 'verifier-secret',
        })
      if (path === '/oauth/token')
        return Response.json({
          access_token: accessToken,
          refresh_token: 'refresh-secret',
          id_token: jwt({
            'https://api.openai.com/auth': {
              chatgpt_account_id: 'account-secret',
            },
          }),
        })
      throw new Error(`Unexpected auth request: ${path}`)
    },
  })
  const id = randomUUID()
  const otherId = randomUUID()
  const provider = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(provider, 'listening')
  const headers: IncomingHttpHeaders[] = []
  provider.on('connection', (socket, request) => {
    headers.push(request.headers)
    socket.on('message', () =>
      socket.send(
        JSON.stringify({
          type: 'response.completed',
          response: {
            id: 'response-1',
            status: 'completed',
            end_turn: true,
            usage: null,
            output: [
              {
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'Subscription works' }],
              },
            ],
          },
        }),
      ),
    )
  })
  let agent: Awaited<ReturnType<typeof Agent.create>> | undefined
  let turn:
    | ReturnType<Awaited<ReturnType<typeof Agent.create>>['turn']['prompt']>
    | undefined
  try {
    const [first, duplicate] = await Promise.all([
      auth.change(id, 'start'),
      auth.change(id, 'start'),
    ])
    expect(first).toEqual(duplicate)
    expect(authStatusSchema.parse(first)).toMatchObject({
      state: 'pending',
      userCode: 'DEMO-CODE',
    })
    if (first.state !== 'pending') throw new Error('Expected pending login')
    expect(requests).toEqual(['/api/accounts/deviceauth/usercode'])
    expect(await auth.change(otherId, 'status')).toEqual({
      state: 'signed_out',
    })
    expect(() => auth.transport(otherId, undefined, {})).toThrow(
      'Sign in with ChatGPT',
    )

    await delay(first.pollAfterMs + 20)
    const authenticated = await auth.change(id, 'status')
    expect(authStatusSchema.parse(authenticated)).toEqual({
      state: 'authenticated',
    })
    expect(requests).toEqual([
      '/api/accounts/deviceauth/usercode',
      '/api/accounts/deviceauth/token',
      '/oauth/token',
    ])

    const endpoint = `127.0.0.1:${(provider.address() as AddressInfo).port}`
    agent = await Agent.create({
      transport: auth.transport(id, undefined, {
        apiBaseUrl: `http://${endpoint}`,
        websocketUrl: `ws://${endpoint}`,
      }),
      model: 'gpt-6-sol',
      instructions: 'Answer briefly.',
      tools: {},
      toolMode: 'direct',
    })
    turn = agent.turn.prompt({ input: 'Hello' })
    const result = await turn.result()
    expect(result.finalMessage).toBe('Subscription works')
    result.dispose()
    expect(headers[0]?.authorization).toBe(`Bearer ${accessToken}`)
    expect(headers[0]?.['chatgpt-account-id']).toBe('account-secret')
    await agent.session.shutdown()
    agent = undefined

    expect(await auth.change(id, 'logout')).toEqual({ state: 'signed_out' })
    expect(() => auth.transport(id, undefined, {})).toThrow(
      'Sign in with ChatGPT',
    )
    expect(reset.mock.calls).toEqual([[id], [id], [id]])
  } finally {
    turn?.dispose()
    await agent?.session.shutdown()
    auth.dispose()
    await new Promise((resolve) => provider.close(resolve))
  }
}, 15_000)

it('serializes account changes with turn acquisition without blocking other browsers', async () => {
  const operations: string[] = []
  const auth = new DemoAuth({
    reset: async (id) => {
      operations.push(`reset:${id}`)
    },
  })
  let finish: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    finish = resolve
  })
  try {
    const acquire = auth.run('one', async () => {
      operations.push('acquire')
      await gate
    })
    const logout = auth.change('one', 'logout')
    const next = auth.run('one', async () => {
      operations.push('next')
    })
    await auth.change('two', 'logout')
    expect(operations).toEqual(['reset:two', 'acquire'])
    finish()
    await Promise.all([acquire, logout, next])
    expect(operations).toEqual(['reset:two', 'acquire', 'reset:one', 'next'])
  } finally {
    finish()
    auth.dispose()
  }
})

it('does not allocate accounts for status checks or redundant logout', async () => {
  const reset = vi.fn(async () => {})
  const auth = new DemoAuth({ reset })

  try {
    for (let index = 0; index < 110; index++) {
      const id = randomUUID()
      expect(await auth.change(id, 'status')).toEqual({ state: 'signed_out' })
      expect(await auth.change(id, 'logout')).toEqual({ state: 'signed_out' })
      expect(auth.has(id)).toBe(false)
    }
    expect(reset).toHaveBeenCalledTimes(110)
  } finally {
    auth.dispose()
  }
})

it('expires unauthenticated accounts on an absolute fifteen-minute limit', async () => {
  let now = 0
  const reset = vi.fn(async () => {})
  const auth = new DemoAuth({ reset, now: () => now })
  const id = randomUUID()

  try {
    await auth.run(id, async () => {})
    expect(auth.has(id)).toBe(true)

    now = 15 * 60 * 1000
    await auth.prune()

    expect(auth.has(id)).toBe(false)
    expect(reset).toHaveBeenCalledWith(id)
  } finally {
    auth.dispose()
  }
})

it('keeps a restarted login tracked when logout and start are queued together', async () => {
  const userCodes: string[] = []
  const auth = new DemoAuth({
    reset: async () => {},
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (!path.endsWith('/usercode'))
        throw new Error(`Unexpected auth request: ${path}`)
      const userCode = `DEMO-${userCodes.length + 1}`
      userCodes.push(userCode)
      return Response.json({
        device_auth_id: `device-${userCodes.length}`,
        user_code: userCode,
        interval: 1,
      })
    },
  })
  const id = randomUUID()

  try {
    await auth.change(id, 'start', 'client')
    const logout = auth.change(id, 'logout', 'client')
    const restart = auth.change(id, 'start', 'client')

    await expect(logout).resolves.toEqual({ state: 'signed_out' })
    await expect(restart).resolves.toMatchObject({
      state: 'pending',
      userCode: 'DEMO-2',
    })
    expect(auth.has(id)).toBe(true)
    await expect(auth.change(id, 'start', 'client')).resolves.toMatchObject({
      state: 'pending',
      userCode: 'DEMO-2',
    })
    expect(userCodes).toEqual(['DEMO-1', 'DEMO-2'])
  } finally {
    auth.dispose()
  }
})

it('atomically caps pending sign-ins per trusted client key', async () => {
  const auth = new DemoAuth({
    reset: async () => {},
    fetch: async () =>
      Response.json({
        device_auth_id: randomUUID(),
        user_code: 'DEMO-CODE',
        interval: 1,
      }),
  })

  try {
    const ids = Array.from({ length: 4 }, () => randomUUID())
    const admissions = await Promise.allSettled(
      ids.map((id) => auth.change(id, 'start', '2001:db8:1:2::/64')),
    )
    expect(
      admissions.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(3)
    expect(admissions.filter(({ status }) => status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({
          message: 'Too many sign-in attempts. Try again shortly.',
          status: 429,
        }),
      }),
    ])
    expect(ids.filter((id) => auth.has(id))).toHaveLength(3)
    await expect(
      auth.change(randomUUID(), 'start', '2001:db8:1:3::/64'),
    ).resolves.toMatchObject({ state: 'pending' })
  } finally {
    auth.dispose()
  }
})

function jwt(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}
