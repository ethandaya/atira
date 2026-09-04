import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const issuer = 'https://auth.openai.com'
const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann'
const verificationUrl = `${issuer}/codex/device`
const loginLifetimeMs = 15 * 60 * 1000
const refreshWindowMs = 5 * 60 * 1000

export class ChatGptSubscriptionStore {
  #directory
  #now
  #pending = new Map()
  #refreshes = new Map()
  #request

  constructor({ directory, now = Date.now, request = globalThis.fetch }) {
    this.#directory = directory
    this.#now = now
    this.#request = request
  }

  async status(sessionId) {
    const pending = this.#pending.get(sessionId)
    if (pending) {
      if (pending.expiresAt <= this.#now()) {
        this.#pending.delete(sessionId)
        return { state: 'expired' }
      }
      return pendingStatus(pending, this.#now())
    }

    const credential = await this.credential(sessionId)
    return credential
      ? { expiresAt: credential.expiresAt, state: 'authenticated' }
      : { state: 'signed_out' }
  }

  async startLogin(sessionId) {
    const credential = await this.credential(sessionId)
    if (credential) {
      return { expiresAt: credential.expiresAt, state: 'authenticated' }
    }

    const response = await this.#request(`${issuer}/api/accounts/deviceauth/usercode`, {
      body: JSON.stringify({ client_id: clientId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !isRecord(payload)) {
      throw new Error(`ChatGPT device login failed with HTTP ${response.status}.`)
    }

    const deviceAuthId = stringValue(payload.device_auth_id)
    const userCode = stringValue(payload.user_code) || stringValue(payload.usercode)
    if (!deviceAuthId || !userCode) {
      throw new Error('ChatGPT device login returned an invalid response.')
    }

    const intervalMs = Math.min(30, positiveNumber(payload.interval) || 5) * 1000
    const pending = {
      deviceAuthId,
      expiresAt: this.#now() + loginLifetimeMs,
      intervalMs,
      nextPollAt: this.#now() + intervalMs,
      userCode,
    }
    this.#pending.set(sessionId, pending)
    return pendingStatus(pending, this.#now())
  }

  async pollLogin(sessionId) {
    const pending = this.#pending.get(sessionId)
    if (!pending) return this.status(sessionId)

    const now = this.#now()
    if (pending.expiresAt <= now) {
      this.#pending.delete(sessionId)
      return { state: 'expired' }
    }
    if (pending.nextPollAt > now) return pendingStatus(pending, now)

    const response = await this.#request(`${issuer}/api/accounts/deviceauth/token`, {
      body: JSON.stringify({
        device_auth_id: pending.deviceAuthId,
        user_code: pending.userCode,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (response.status === 403 || response.status === 404) {
      pending.nextPollAt = this.#now() + pending.intervalMs
      return pendingStatus(pending, this.#now())
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok || !isRecord(payload)) {
      throw new Error(`ChatGPT device authorization failed with HTTP ${response.status}.`)
    }

    const authorizationCode = stringValue(payload.authorization_code)
    const codeVerifier = stringValue(payload.code_verifier)
    if (!authorizationCode || !codeVerifier) {
      throw new Error('ChatGPT device authorization returned an invalid response.')
    }

    const tokenResponse = await this.#request(`${issuer}/oauth/token`, {
      body: new URLSearchParams({
        client_id: clientId,
        code: authorizationCode,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: `${issuer}/deviceauth/callback`,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
    const tokens = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || !isRecord(tokens)) {
      throw new Error(`ChatGPT token exchange failed with HTTP ${tokenResponse.status}.`)
    }

    const credential = credentialFromTokens(tokens, undefined, this.#now())
    await this.#writeCredential(sessionId, credential)
    this.#pending.delete(sessionId)
    return { expiresAt: credential.expiresAt, state: 'authenticated' }
  }

  async credential(sessionId, { forceRefresh = false } = {}) {
    const activeRefresh = this.#refreshes.get(sessionId)
    if (activeRefresh) {
      const credential = await activeRefresh.operation
      if (!forceRefresh || activeRefresh.forceRefresh) return credential
      return this.credential(sessionId, { forceRefresh: true })
    }

    const operation = this.#credential(sessionId, forceRefresh).finally(() => {
      if (this.#refreshes.get(sessionId)?.operation === operation) {
        this.#refreshes.delete(sessionId)
      }
    })
    this.#refreshes.set(sessionId, { forceRefresh, operation })
    return operation
  }

  async logout(sessionId) {
    this.#pending.delete(sessionId)
    await rm(this.#credentialPath(sessionId), { force: true })
  }

  async #credential(sessionId, forceRefresh) {
    const current = await this.#readCredential(sessionId)
    if (!current) return undefined
    if (!forceRefresh && current.expiresAt > this.#now() + refreshWindowMs) {
      return current
    }
    if (!current.refreshToken) {
      await this.logout(sessionId)
      return undefined
    }

    const response = await this.#request(`${issuer}/oauth/token`, {
      body: JSON.stringify({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    const payload = await response.json().catch(() => null)

    if (refreshRequiresLogin(response.status, payload)) {
      await this.logout(sessionId)
      return undefined
    }
    if (!response.ok || !isRecord(payload)) {
      throw new Error(`ChatGPT credential refresh failed with HTTP ${response.status}.`)
    }

    const credential = credentialFromTokens(payload, current, this.#now())
    if (credential.accountId !== current.accountId) {
      throw new Error('ChatGPT credential refresh changed accounts.')
    }
    await this.#writeCredential(sessionId, credential)
    return credential
  }

  async #readCredential(sessionId) {
    let envelope
    try {
      envelope = JSON.parse(await readFile(this.#credentialPath(sessionId), 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined
      throw new Error('The stored ChatGPT credential could not be read.')
    }

    try {
      const key = await this.#encryptionKey()
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(envelope.iv, 'base64'),
      )
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ])
      return JSON.parse(plaintext.toString('utf8'))
    } catch {
      throw new Error('The stored ChatGPT credential could not be decrypted.')
    }
  }

  async #writeCredential(sessionId, credential) {
    await mkdir(this.#directory, { mode: 0o700, recursive: true })
    const key = await this.#encryptionKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(credential), 'utf8'),
      cipher.final(),
    ])
    const envelope = JSON.stringify({
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    })
    const path = this.#credentialPath(sessionId)
    const temporaryPath = `${path}.${randomUUID()}.tmp`

    try {
      await writeFile(temporaryPath, envelope, { mode: 0o600 })
      await rename(temporaryPath, path)
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }

  async #encryptionKey() {
    await mkdir(this.#directory, { mode: 0o700, recursive: true })
    const path = join(this.#directory, 'credentials.key')
    try {
      return await readFile(path)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }

    const key = randomBytes(32)
    try {
      await writeFile(path, key, { flag: 'wx', mode: 0o600 })
      return key
    } catch (error) {
      if (error?.code === 'EEXIST') return readFile(path)
      throw error
    }
  }

  #credentialPath(sessionId) {
    const name = createHash('sha256').update(sessionId).digest('hex')
    return join(this.#directory, `${name}.json`)
  }
}

function pendingStatus(pending, now) {
  return {
    expiresAt: pending.expiresAt,
    pollAfterMs: Math.max(250, pending.nextPollAt - now),
    state: 'pending',
    userCode: pending.userCode,
    verificationUrl,
  }
}

function credentialFromTokens(tokens, previous, now) {
  const accessToken = stringValue(tokens.access_token)
  if (!accessToken) throw new Error('ChatGPT returned no access token.')

  const accessClaims = decodeJwt(accessToken)
  const idClaims = decodeJwt(stringValue(tokens.id_token))
  const authClaims = isRecord(idClaims?.['https://api.openai.com/auth'])
    ? idClaims['https://api.openai.com/auth']
    : undefined
  const accountId = stringValue(authClaims?.chatgpt_account_id) || previous?.accountId
  if (!accountId) throw new Error('ChatGPT returned no account identifier.')

  return {
    accessToken,
    accountId,
    expiresAt: positiveNumber(accessClaims?.exp) * 1000 || now + 55 * 60 * 1000,
    fedramp: typeof authClaims?.chatgpt_account_is_fedramp === 'boolean'
      ? authClaims.chatgpt_account_is_fedramp
      : Boolean(previous?.fedramp),
    refreshToken: stringValue(tokens.refresh_token) || previous?.refreshToken,
  }
}

function decodeJwt(token) {
  const encoded = token.split('.')[1]
  if (!encoded) return undefined
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return undefined
  }
}

function refreshRequiresLogin(status, payload) {
  if (status === 401) return true
  const code = isRecord(payload?.error)
    ? stringValue(payload.error.code)
    : stringValue(payload?.error)
  return [
    'refresh_token_expired',
    'refresh_token_invalidated',
    'refresh_token_reused',
  ].includes(code)
}

function positiveNumber(value) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function stringValue(value) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value) {
  return typeof value === 'object' && value !== null
}
