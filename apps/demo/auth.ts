import {
  ChatGptSubscription,
  createMemoryChatGptSubscriptionStore,
  Transport,
  type ChatGptLoginStatus,
  type ChatGptSubscriptionHandle,
} from 'nanocodex/node'
import { ConversationError } from './conversations.ts'

export type Account = {
  clientKey?: string
  createdAt: number
  lastUsed: number
  pending: number
  retireWhenIdle?: boolean
  state: ChatGptLoginStatus
  subscription?: ChatGptSubscriptionHandle
  tail: Promise<unknown>
}

type DemoAuthOptions = {
  fetch?: typeof globalThis.fetch
  now?: () => number
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
  now: () => number
  reset: DemoAuthOptions['reset']

  constructor({ reset, fetch, now = Date.now }: DemoAuthOptions) {
    this.reset = reset
    this.now = now
    this.fetch =
      fetch ??
      ((input, init) =>
        globalThis.fetch(input, {
          ...init,
          signal: AbortSignal.timeout(15_000),
        }))
  }

  run<T>(
    id: string,
    operation: (account: Account) => Promise<T>,
    clientKey?: string,
  ): Promise<T> {
    let account = this.#accounts.get(id)
    if (!account) {
      if (this.#accounts.size >= 100)
        throw new ConversationError(
          'The demo is at its session limit. Try again shortly.',
          503,
        )
      account = {
        ...(clientKey ? { clientKey } : {}),
        createdAt: this.now(),
        state: { state: 'signed_out' },
        pending: 0,
        lastUsed: this.now(),
        tail: Promise.resolve(),
      }
      this.#accounts.set(id, account)
    }
    const current = account
    current.pending++
    const result = current.tail.then(() => operation(current))
    const settled = result.finally(() => {
      current.pending--
      current.lastUsed = this.now()
      if (
        current.pending === 0 &&
        current.retireWhenIdle &&
        this.#accounts.get(id) === current
      ) {
        this.#accounts.delete(id)
      }
    })
    current.tail = settled.catch(() => {})
    return settled
  }

  async change(
    id: string,
    action: 'start' | 'status' | 'logout',
    clientKey?: string,
  ) {
    if (action === 'start') await this.prune()
    if (
      action === 'start' &&
      !this.#accounts.has(id) &&
      clientKey &&
      this.#pendingForClient(clientKey) >= 3
    ) {
      throw new ConversationError(
        'Too many sign-in attempts. Try again shortly.',
        429,
      )
    }
    if (action !== 'start' && !this.#accounts.has(id)) {
      if (action === 'logout') await this.reset(id)
      return { state: 'signed_out' } as const
    }

    return this.run(
      id,
      async (account) => {
        if (action === 'start') {
          if (
            account.state.state === 'pending' ||
            account.state.state === 'authenticated'
          )
            return account.state
          if (clientKey && this.#pendingForClient(clientKey, account) >= 3) {
            throw new ConversationError(
              'Too many sign-in attempts. Try again shortly.',
              429,
            )
          }
          if (clientKey) account.clientKey = clientKey
          else delete account.clientKey
          account.createdAt = this.now()
          account.retireWhenIdle = false
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
          account.retireWhenIdle = true
        } else if (account.subscription) {
          const status = await account.subscription.status()
          if (status.state !== account.state.state) await this.reset(id)
          account.state = status
        }
        return account.state
      },
      action === 'start' ? clientKey : undefined,
    )
  }

  isAuthenticated(id: string) {
    return this.#accounts.get(id)?.state.state === 'authenticated'
  }

  has(id: string) {
    return this.#accounts.has(id)
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
      const expired =
        account.state.state === 'authenticated'
          ? account.lastUsed <= this.now() - 60 * 60 * 1000
          : account.createdAt <= this.now() - 15 * 60 * 1000
      if (account.pending || !expired) continue
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Bound teardown concurrency and recheck eligibility after each reset.
      await this.run(id, async (current) => {
        await this.reset(id)
        await current.subscription?.logout()
        current.subscription?.dispose()
        delete current.subscription
        current.state = { state: 'signed_out' }
        current.retireWhenIdle = true
      })
    }
  }

  #pendingForClient(clientKey: string, excluded?: Account) {
    let pending = 0
    for (const account of this.#accounts.values()) {
      if (
        account !== excluded &&
        account.clientKey === clientKey &&
        account.state.state !== 'authenticated' &&
        !account.retireWhenIdle
      ) {
        pending++
      }
    }
    return pending
  }

  dispose() {
    for (const account of this.#accounts.values())
      account.subscription?.dispose()
    this.#accounts.clear()
  }
}
