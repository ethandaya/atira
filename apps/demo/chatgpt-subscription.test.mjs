import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatGptSubscriptionStore } from './chatgpt-subscription.mjs'

const directories = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, {
    force: true,
    recursive: true,
  })))
})

describe('ChatGptSubscriptionStore', () => {
  it('completes device login and keeps credentials encrypted on disk', async () => {
    let now = 1_800_000_000_000
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        device_auth_id: 'device-secret',
        interval: 5,
        user_code: 'ABCD-EFGH',
      }))
      .mockResolvedValueOnce(Response.json({
        authorization_code: 'authorization-secret',
        code_verifier: 'verifier-secret',
      }))
      .mockResolvedValueOnce(Response.json({
        access_token: jwt({ exp: Math.floor(now / 1000) + 3_600 }),
        id_token: jwt({
          'https://api.openai.com/auth': {
            chatgpt_account_id: 'account-secret',
            chatgpt_account_is_fedramp: false,
          },
        }),
        refresh_token: 'refresh-secret',
      }))
    const directory = await temporaryDirectory()
    const store = new ChatGptSubscriptionStore({ directory, now: () => now, request })

    const started = await store.startLogin('browser-session')
    expect(started).toEqual(expect.objectContaining({
      pollAfterMs: 5_000,
      state: 'pending',
      userCode: 'ABCD-EFGH',
      verificationUrl: 'https://auth.openai.com/codex/device',
    }))

    expect(await store.pollLogin('browser-session')).toEqual(expect.objectContaining({
      state: 'pending',
    }))
    expect(request).toHaveBeenCalledTimes(1)

    now += 5_000
    expect(await store.pollLogin('browser-session')).toEqual(expect.objectContaining({
      state: 'authenticated',
    }))
    const credential = await store.credential('browser-session')
    expect(credential).toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      accountId: 'account-secret',
      refreshToken: 'refresh-secret',
    }))

    const files = await import('node:fs/promises').then(({ readdir }) => readdir(directory))
    const encryptedPath = files.find((file) => file.endsWith('.json'))
    const encrypted = await readFile(join(directory, encryptedPath), 'utf8')
    expect(encrypted).not.toContain('refresh-secret')
    expect(encrypted).not.toContain('account-secret')
  })

  it('refreshes rotating credentials and signs out when requested', async () => {
    let now = 1_800_000_000_000
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        device_auth_id: 'device',
        interval: 1,
        user_code: 'CODE',
      }))
      .mockResolvedValueOnce(Response.json({
        authorization_code: 'authorization',
        code_verifier: 'verifier',
      }))
      .mockResolvedValueOnce(Response.json({
        access_token: jwt({ exp: Math.floor(now / 1000) + 3_600 }),
        id_token: accountToken('account'),
        refresh_token: 'refresh-one',
      }))
      .mockResolvedValueOnce(Response.json({
        access_token: jwt({ exp: Math.floor(now / 1000) + 7_200 }),
        refresh_token: 'refresh-two',
      }))
    const directory = await temporaryDirectory()
    const store = new ChatGptSubscriptionStore({ directory, now: () => now, request })

    await store.startLogin('session')
    now += 1_000
    await store.pollLogin('session')
    now += 56 * 60 * 1000

    const refreshed = await store.credential('session')
    expect(refreshed).toEqual(expect.objectContaining({
      accountId: 'account',
      refreshToken: 'refresh-two',
    }))
    expect(JSON.parse(request.mock.calls[3][1].body)).toEqual({
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      grant_type: 'refresh_token',
      refresh_token: 'refresh-one',
    })

    await store.logout('session')
    expect(await store.status('session')).toEqual({ state: 'signed_out' })
  })
})

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'pretty-amped-chatgpt-'))
  directories.push(directory)
  return directory
}

function accountToken(accountId) {
  return jwt({
    'https://api.openai.com/auth': {
      chatgpt_account_id: accountId,
      chatgpt_account_is_fedramp: false,
    },
  })
}

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}
