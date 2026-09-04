import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'

it('resumes isolated runtime histories, scopes cancellation, and rejects lost context over HTTP', { timeout: 30_000 }, async () => {
  const reservation = createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  // Only the provider transport is faked; the real server and runtime history run.
  // Reject every other outbound fetch so the test cannot call a real provider.
  const preload = `
    import { setTimeout as delay } from 'node:timers/promises';
    let failedOnce = false;
    globalThis.fetch = async (url, options) => {
      if (url !== 'https://api.anthropic.com/v1/messages') throw new Error('Unexpected outbound request');
      const { messages } = JSON.parse(options.body);
      const inputs = messages.filter(m => m.role === 'user').map(m => m.content);
      if (inputs.at(-1) === 'retry me' && !failedOnce) { failedOnce = true; throw new Error('network error'); }
      if (inputs.at(-1) === 'wait') await delay(10000, undefined, { signal: options.signal });
      return Response.json({ content: [{ type: 'text', text: inputs.join(' / ') }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
    };
  `
  const child = spawn(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, 'server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: 'isolated-test-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const base = `http://127.0.0.1:${port}`
  try {
    let ready
    for (let attempt = 0; attempt < 100; attempt++) {
      ready = await fetch(`${base}/api/runtime`).catch(() => undefined)
      if (ready?.ok) break
      if (child.exitCode !== null) throw new Error(`Isolated demo server exited: ${output}`)
      await delay(100)
    }
    expect(ready?.ok).toBe(true)
    const cookie = ready.headers.get('set-cookie').split(';')[0]
    const a = randomUUID()
    const b = randomUUID()
    const headers = (id, owner = cookie) => ({ Cookie: owner, 'X-Conversation-Id': id, 'Content-Type': 'application/json' })
    const chat = (id, input, resume = false, owner = cookie, turn = {}) => fetch(`${base}/api/chat`, {
      method: 'POST', headers: headers(id, owner), body: JSON.stringify({ input, resume, ...turn }),
    })
    const final = async (response) => {
      expect(response.status).toBe(200)
      const events = (await response.text()).trim().split('\n').map(JSON.parse)
      return events.find(event => event.type === 'completed')?.message
    }
    expect(await final(await chat(a, 'alpha'))).toBe('alpha')
    expect(await final(await chat(b, 'beta'))).toBe('beta')
    expect(await final(await chat(a, 'continue', true))).toBe('alpha / continue')
    const stranger = `pretty_amped_session=${randomUUID()}`
    expect((await chat(a, 'steal context', true, stranger)).status).toBe(409)

    const running = await chat(b, 'wait', true)
    const wrongCancel = await fetch(`${base}/api/cancel`, { method: 'POST', headers: headers(a) })
    expect(await wrongCancel.json()).toEqual({ cancelled: false })
    const cancel = await fetch(`${base}/api/cancel`, { method: 'POST', headers: headers(b) })
    expect(cancel.status).toBe(202)
    expect(await running.text()).toContain('"cancelled"')

    await fetch(`${base}/api/session`, { method: 'DELETE', headers: headers(a) })
    const expired = await chat(a, 'resume without context', true)
    expect(expired.status).toBe(409)
    expect((await expired.json()).error).toContain('expired or changed')
    expect(await final(await chat(b, 'still here', true))).toBe('beta / still here')
    const turnId = randomUUID()
    expect(await (await chat(b, 'retry me', true, cookie, { turnId })).text()).toContain('"error"')
    const recovered = await final(await chat(b, 'retry me', true, cookie, { turnId, retry: true }))
    expect(recovered).toBe('beta / still here / retry me')
    // If completion was lost in transit, retry replays it instead of calling tools again.
    expect(await final(await chat(b, 'retry me', true, cookie, { turnId, retry: true }))).toBe(recovered)
    expect((await chat(b, 'different input', true, cookie, { turnId, retry: true })).status).toBe(409)
    expect(await final(await chat(b, 'next', true))).toBe('beta / still here / retry me / next')
    expect((await chat(b, 'retry me', true, cookie, { turnId, retry: true })).status).toBe(409)
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      const forceExit = setTimeout(() => child.kill('SIGKILL'), 2_000)
      await exited
      clearTimeout(forceExit)
    }
  }
})
