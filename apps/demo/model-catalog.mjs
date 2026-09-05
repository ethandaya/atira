import { createHash } from 'node:crypto'

// Cache successful discovery only, scoped to credentials as well as account.
export class ModelCatalog {
  #cache = new Map()
  #request
  #now

  constructor({ request = globalThis.fetch, now = Date.now } = {}) {
    this.#request = request
    this.#now = now
  }

  async list({ kind, apiKey, credential }) {
    const key = createHash('sha256').update(JSON.stringify([
      kind, apiKey, credential?.accountId, credential?.accessToken, credential?.fedramp,
    ])).digest('hex')
    for (const [id, entry] of this.#cache) {
      if (entry.expiresAt <= this.#now()) this.#cache.delete(id)
    }
    const cached = this.#cache.get(key)
    if (cached) return cached.promise
    const promise = this.#load({ kind, apiKey, credential })
    const entry = { promise, expiresAt: this.#now() + 5 * 60 * 1000 }
    this.#cache.set(key, entry)
    try {
      return await promise
    } catch (error) {
      if (this.#cache.get(key) === entry) this.#cache.delete(key)
      throw error
    }
  }

  async #load({ kind, apiKey, credential }) {
    const headers = kind === 'chatgpt'
      ? {
          Authorization: `Bearer ${credential.accessToken}`,
          'ChatGPT-Account-ID': credential.accountId,
          'User-Agent': 'pretty-amped/0.0.0',
          ...(credential.fedramp ? { 'X-OpenAI-Fedramp': 'true' } : {}),
        }
      : kind === 'anthropic'
        ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { Authorization: `Bearer ${apiKey}` }
    const url = new URL(kind === 'chatgpt'
      ? 'https://chatgpt.com/backend-api/codex/models?client_version=0.0.0'
      : kind === 'anthropic'
        ? 'https://api.anthropic.com/v1/models?limit=1000'
        : 'https://api.openai.com/v1/models')
    const models = new Map()
    const cursors = new Set()
    const signal = AbortSignal.timeout(10_000)
    do {
      const response = await this.#request(url.toString(), { headers, signal })
      if (!response.ok) throw new Error('Model discovery failed.')
      const body = await response.json()
      const items = kind === 'chatgpt' ? body?.models : body?.data
      if (!Array.isArray(items)) throw new Error('Invalid model catalog.')
      const visible = kind === 'chatgpt'
        ? items.filter(item => item?.visibility === 'list').sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        : items
      for (const item of visible) {
        const modelId = kind === 'chatgpt' ? item?.slug : item?.id
        const label = kind === 'chatgpt' ? item?.display_name : item?.display_name ?? modelId
        if (typeof modelId !== 'string' || !modelId || typeof label !== 'string' || !label) continue
        const reasoningEfforts = kind === 'chatgpt' && Array.isArray(item.supported_reasoning_levels)
          ? [...new Set(item.supported_reasoning_levels.map(level => level?.effort).filter(effort => typeof effort === 'string' && effort.length > 0))]
          : []
        models.set(modelId, {
          modelId, label, providerId: kind,
          ...(kind === 'chatgpt' ? { supportsImages: Array.isArray(item.input_modalities) && item.input_modalities.includes('image') } : {}),
          ...(reasoningEfforts.length ? {
            reasoningEfforts,
            defaultReasoningEffort: reasoningEfforts.includes(item.default_reasoning_level) ? item.default_reasoning_level : reasoningEfforts[0],
          } : {}),
        })
      }
      if (kind !== 'anthropic' || body.has_more !== true) break
      if (typeof body.last_id !== 'string' || !body.last_id || cursors.has(body.last_id)) {
        throw new Error('Invalid model catalog pagination.')
      }
      cursors.add(body.last_id)
      url.searchParams.set('after_id', body.last_id)
    } while (true)
    if (!models.size) throw new Error('No available models were returned.')
    return [...models.values()]
  }
}
