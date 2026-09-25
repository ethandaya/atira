// @ts-check

const supportedModels = new Map([
  ['gpt-6-sol', { label: 'GPT-6 Sol', reasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium' }],
  ['gpt-6-luna', { label: 'GPT-6 Luna', reasoningEfforts: ['low', 'medium'], defaultReasoningEffort: 'medium' }],
  ['gpt-6-astra', { label: 'GPT-6 Astra', reasoningEfforts: ['low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'medium' }],
])

export class ModelCatalog {
  #cache = new Map()

  /** @param {{request?: typeof globalThis.fetch, now?: () => number}} options */
  constructor({ request = globalThis.fetch, now = Date.now } = {}) {
    this.request = request
    this.now = now
  }

  /** @param {{credential?: import('nanocodex/node').ChatGptCredential}} options */
  async list({ credential }) {
    if (!credential) return apiKeyModels()
    for (const [key, entry] of this.#cache) {
      if (entry.expiresAt <= this.now()) this.#cache.delete(key)
    }
    const key = `${credential.accountId}:${credential.revision}`
    const cached = this.#cache.get(key)
    if (cached) return cached.promise
    const promise = this.#load(credential)
    const entry = { expiresAt: this.now() + 5 * 60 * 1000, promise }
    this.#cache.set(key, entry)
    try {
      return await promise
    } catch (error) {
      if (this.#cache.get(key) === entry) this.#cache.delete(key)
      throw error
    }
  }

  /** @param {import('nanocodex/node').ChatGptCredential} credential */
  async #load(credential) {
    const response = await this.request(
      'https://chatgpt.com/backend-api/codex/models?client_version=0.0.0',
      {
        headers: {
          Authorization: `Bearer ${credential.accessToken}`,
          'ChatGPT-Account-ID': credential.accountId,
          'User-Agent': 'pretty-amped/0.0.0',
          ...(credential.fedramp ? { 'X-OpenAI-Fedramp': 'true' } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) throw new Error('Model discovery failed.')
    const body = await response.json()
    if (!body || typeof body !== 'object' || !Array.isArray(body.models)) {
      throw new Error('Invalid model catalog.')
    }
    const models = body.models
      .filter(item => item?.visibility === 'list' && supportedModels.has(item.slug))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map(item => {
        const supported = supportedModels.get(item.slug)
        const efforts = Array.isArray(item.supported_reasoning_levels)
          ? [...new Set(item.supported_reasoning_levels
              .map(level => level?.effort)
              .filter(effort => supported.reasoningEfforts.includes(effort)))]
          : supported.reasoningEfforts
        return {
          description: typeof item.description === 'string' && item.description.trim()
            ? item.description.trim()
            : 'OpenAI via ChatGPT',
          label: typeof item.display_name === 'string' && item.display_name.trim()
            ? item.display_name.trim()
            : supported.label,
          modelId: item.slug,
          providerId: 'openai',
          reasoningEfforts: efforts,
          defaultReasoningEffort: efforts.includes(item.default_reasoning_level)
            ? item.default_reasoning_level
            : efforts[0],
        }
      })
    if (!models.length) throw new Error('No compatible models were returned.')
    return models
  }
}

function apiKeyModels() {
  return [...supportedModels].map(([modelId, model]) => ({
    description: 'OpenAI via Nanocodex',
    ...model,
    modelId,
    providerId: 'openai',
  }))
}
