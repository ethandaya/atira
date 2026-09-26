import {
  ChatGptSubscription,
  createMemoryChatGptSubscriptionStore,
  Transport,
  type ChatGptLoginStatus,
  type ChatGptSubscriptionHandle,
} from 'nanocodex/node'
import { ConversationError } from './conversations.ts'

export type Account = {
  lastUsed: number
  pending: number
  state: ChatGptLoginStatus
  subscription?: ChatGptSubscriptionHandle
  tail: Promise<unknown>
}

type DemoAuthOptions = {
  fetch?: typeof globalThis.fetch
  reset: (id: string) => Promise<void>
}

type TransportEndpoints = {
  apiBaseUrl?: string
  websocketUrl?: string
}

// Demo credentials are deliberately process-local, never written to disk or sent to the browser.
export class DemoAuth {
  #accounts = new Map<string, Account>()
  fetch: typeof globalThis.fetch
  reset: DemoAuthOptions['reset']

  constructor({ reset, fetch }: DemoAuthOptions) {
    this.reset = reset
    this.fetch =
      fetch ??
      ((input, init) =>
        globalThis.fetch(input, {
          ...init,
          signal: AbortSignal.timeout(15_000),
        }))
  }

  run<T>(id: string, operation: (account: Account) => Promise<T>): Promise<T> {
    let account = this.#accounts.get(id)
    if (!account) {
      if (this.#accounts.size >= 100)
        throw new ConversationError(
          'The demo is at its session limit. Try again shortly.',
          503,
        )
      account = {
        state: { state: 'signed_out' },
        pending: 0,
        lastUsed: Date.now(),
        tail: Promise.resolve(),
      }
      this.#accounts.set(id, account)
    }
    const current = account
    current.pending++
    const result = current.tail.then(() => operation(current))
    current.tail = result
      .catch(() => {})
      .finally(() => {
        current.pending--
        current.lastUsed = Date.now()
      })
    return result
  }

  change(id: string, action: 'start' | 'status' | 'logout') {
    return this.run(id, async (account) => {
      if (action === 'start') {
        if (
          account.state.state === 'pending' ||
          account.state.state === 'authenticated'
        )
          return account.state
        await this.reset(id)
        account.subscription ??= await ChatGptSubscription.open({
          id,
          store: createMemoryChatGptSubscriptionStore(id),
          fetch: this.fetch,
        })
        account.state = await account.subscription.startLogin()
      } else if (action === 'logout') {
        await this.reset(id)
        await account.subscription?.logout()
        account.subscription?.dispose()
        delete account.subscription
        account.state = { state: 'signed_out' }
      } else if (account.subscription) {
        const status = await account.subscription.status()
        if (status.state !== account.state.state) await this.reset(id)
        account.state = status
      }
      return account.state
    })
  }

  transport(
    id: string,
    apiKey: string | undefined,
    endpoints: TransportEndpoints,
  ) {
    const account = this.#accounts.get(id)
    if (account?.state.state === 'authenticated' && account.subscription) {
      return Transport.chatGpt({
        subscription: account.subscription,
        ...endpoints,
      })
    }
    if (!apiKey)
      throw new ConversationError(
        'Sign in with ChatGPT or set OPENAI_API_KEY on the server.',
        503,
      )
    return Transport.openAi({ apiKey, ...endpoints })
  }

  async prune() {
    for (const [id, account] of this.#accounts) {
      if (account.pending || account.lastUsed > Date.now() - 60 * 60 * 1000)
        continue
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Bound teardown concurrency and recheck eligibility after each reset.
      await this.run(id, async () => {
        await this.reset(id)
        if (account.pending > 1) return
        account.subscription?.dispose()
        this.#accounts.delete(id)
      })
    }
  }

  dispose() {
    for (const account of this.#accounts.values())
      account.subscription?.dispose()
    this.#accounts.clear()
  }
}
