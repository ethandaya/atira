import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

import { Agent } from 'nanocodex/node'
import { createServer as createViteServer } from 'vite'

const apiKey = process.env.OPENAI_API_KEY?.trim()
const model = 'gpt-5.6-sol'
const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT ?? readArgument('--port') ?? 5173)
const host = process.env.HOST ?? readArgument('--host') ?? '0.0.0.0'
const sessions = new Map()
const sessionMaxAge = 30 * 60 * 1000
const maxSessions = 20

let vite
const server = createServer((request, response) => {
  void handleRequest(request, response)
    .then((handled) => {
      if (!handled) vite.middlewares(request, response)
    })
    .catch((error) => {
      const message = publicError(error)
      console.error(`[demo-runtime] ${message}`)

      if (!response.headersSent) {
        sendJson(response, 500, { error: message })
      } else if (!response.writableEnded) {
        response.end()
      }
    })
})

vite = await createViteServer({
  appType: 'spa',
  root,
  server: {
    middlewareMode: true,
    ws: { server },
  },
})

server.listen(port, host, () => {
  console.log(`Pretty Amped demo listening on http://${host}:${port}`)
})

const pruneTimer = setInterval(() => {
  void pruneSessions()
}, 5 * 60 * 1000)
pruneTimer.unref()

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', 'http://demo.local')

  if (!url.pathname.startsWith('/api/')) return false

  setApiHeaders(response)

  if (request.method === 'GET' && url.pathname === '/api/runtime') {
    sessionId(request, response)
    sendJson(response, 200, {
      available: Boolean(apiKey),
      model,
      runtime: 'Nanocodex',
    })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    await streamChat(request, response)
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/cancel') {
    await cancelTurn(request, response)
    return true
  }

  if (request.method === 'DELETE' && url.pathname === '/api/session') {
    await resetSession(request, response)
    return true
  }

  sendJson(response, 404, { error: 'API route not found.' })
  return true
}

async function streamChat(request, response) {
  if (!apiKey) {
    sendJson(response, 503, {
      error: 'The Nanocodex runtime is not configured.',
    })
    return
  }

  const body = await readJson(request)
  const input = typeof body.input === 'string' ? body.input.trim() : ''

  if (!input) {
    sendJson(response, 400, { error: 'Enter a message to continue.' })
    return
  }

  if (input.length > 8_000) {
    sendJson(response, 413, { error: 'Messages are limited to 8,000 characters.' })
    return
  }

  const id = sessionId(request, response)
  const session = await getSession(id)

  if (session.active) {
    sendJson(response, 409, { error: 'Wait for the current response to finish.' })
    return
  }

  const control = {
    cancelRequested: false,
    turn: undefined,
  }
  session.active = control
  session.lastUsed = Date.now()

  let agent
  try {
    agent = await session.agent
  } catch (error) {
    if (session.active === control) session.active = undefined
    throw error
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
  })
  response.flushHeaders()

  const watch = agent.events.watch()
  const startedAt = Date.now()
  let runtimeError

  const unwatch = watch.onEvent((event) => {
    if (event.type === 'assistant.delta') {
      writeEvent(response, {
        text: payloadString(event.payload, 'text'),
        type: 'assistant-delta',
      })
    } else if (event.type === 'assistant.message') {
      writeEvent(response, {
        text: payloadString(event.payload, 'text'),
        type: 'assistant-message',
      })
    } else if (event.type === 'reasoning.summary.delta') {
      writeEvent(response, {
        text: payloadString(event.payload, 'text'),
        type: 'reasoning-delta',
      })
    } else if (event.type === 'run.error') {
      runtimeError = payloadString(event.payload, 'message')
    }
  })

  const cancelOnClose = () => {
    if (response.writableEnded || !control.turn) return
    control.cancelRequested = true
    void control.turn.cancel().catch(() => {})
  }
  response.once('close', cancelOnClose)

  writeEvent(response, { type: 'started' })

  try {
    control.turn = agent.turn.prompt({ input })
    const result = await control.turn.result()
    writeEvent(response, {
      durationMs: Date.now() - startedAt,
      message: result.finalMessage,
      type: 'completed',
      usage: {
        outputTokens: result.usage.output_tokens,
        totalTokens: result.usage.total_tokens,
      },
    })
  } catch (error) {
    if (control.cancelRequested) {
      writeEvent(response, { type: 'cancelled' })
    } else {
      writeEvent(response, {
        message: publicError(runtimeError ?? error),
        type: 'error',
      })
    }
  } finally {
    control.turn?.dispose()
    unwatch()
    watch.off()
    response.off('close', cancelOnClose)
    if (session.active === control) session.active = undefined
    session.lastUsed = Date.now()
    if (!response.writableEnded && !response.destroyed) response.end()
  }
}

async function cancelTurn(request, response) {
  const id = existingSessionId(request)
  const active = id ? sessions.get(id)?.active : undefined

  if (!active?.turn) {
    sendJson(response, 200, { cancelled: false })
    return
  }

  active.cancelRequested = true
  await active.turn.cancel().catch(() => {})
  sendJson(response, 202, { cancelled: true })
}

async function resetSession(request, response) {
  const id = existingSessionId(request)
  const session = id ? sessions.get(id) : undefined

  if (id) sessions.delete(id)

  if (session) {
    if (session.active?.turn) {
      session.active.cancelRequested = true
      await session.active.turn.cancel().catch(() => {})
    }
    await session.agent.then((agent) => agent.session.shutdown()).catch(() => {})
  }

  response.writeHead(204)
  response.end()
}

async function getSession(id) {
  await pruneSessions()

  const existing = sessions.get(id)
  if (existing) return existing

  if (sessions.size >= maxSessions) {
    throw new Error('The demo is at its session limit. Try again shortly.')
  }

  const session = {
    active: undefined,
    agent: Agent.create({
      apiKey,
      instructions:
        'You are the assistant inside Pretty Amped, a component playground for AI interfaces. You have no tools or workspace access. Help users inspect and discuss interface design. Be concise and use plain text.',
      model,
      thinking: 'low',
      toolMode: 'direct',
      tools: {},
    }),
    lastUsed: Date.now(),
  }

  sessions.set(id, session)
  session.agent.catch(() => {
    if (sessions.get(id) === session) sessions.delete(id)
  })
  return session
}

async function pruneSessions() {
  const now = Date.now()
  const expired = []

  for (const [id, session] of sessions) {
    if (!session.active && now - session.lastUsed > sessionMaxAge) {
      sessions.delete(id)
      expired.push(session.agent)
    }
  }

  await Promise.allSettled(
    expired.map((agent) => agent.then((value) => value.session.shutdown())),
  )
}

function sessionId(request, response) {
  const existing = existingSessionId(request)
  if (existing) return existing

  const id = randomUUID()
  response.setHeader(
    'Set-Cookie',
    `pretty_amped_session=${id}; HttpOnly; Max-Age=86400; Path=/; SameSite=Strict; Secure`,
  )
  return id
}

function existingSessionId(request) {
  const cookie = request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('pretty_amped_session='))
  const id = cookie?.slice('pretty_amped_session='.length)
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined
}

async function readJson(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > 16_384) throw new Error('The request is too large.')
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('The request body must be valid JSON.')
  }
}

function writeEvent(response, event) {
  if (!response.destroyed && !response.writableEnded) {
    response.write(`${JSON.stringify(event)}\n`)
  }
}

function payloadString(payload, key) {
  return typeof payload[key] === 'string' ? payload[key] : ''
}

function publicError(error) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('session limit')) return message
  if (/HTTP 401|authenticate|api key/i.test(message)) {
    return 'The Nanocodex runtime could not authenticate with OpenAI.'
  }
  if (/HTTP 429|rate limit/i.test(message)) {
    return 'The Nanocodex runtime is rate limited. Try again shortly.'
  }
  if (/request is too large|valid JSON/i.test(message)) return message
  return 'The Nanocodex runtime could not complete this response.'
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function setApiHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function shutdown() {
  clearInterval(pruneTimer)
  server.close()
  await vite.close()
  await Promise.allSettled(
    [...sessions.values()].map(async (session) => {
      if (session.active?.turn) {
        session.active.cancelRequested = true
        await session.active.turn.cancel().catch(() => {})
      }
      const agent = await session.agent
      await agent.session.shutdown()
    }),
  )
}
