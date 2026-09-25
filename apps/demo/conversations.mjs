// @ts-check

/** @typedef {{cancelRequested: boolean, abortController: AbortController, turn?: {cancel: () => Promise<unknown>, dispose: () => void} | undefined}} TurnControl */
/** @typedef {{id: string, input: string, completed?: boolean, stream?: import('./run-stream.mjs').RunStream}} Turn */
/** @typedef {{agent?: Promise<import('nanocodex').DefaultAgent>, model?: string, thinking?: import('nanocodex').Thinking}} ProviderSession */
/** @typedef {ProviderSession & {lastUsed: number, lastTurn?: Turn, active?: TurnControl | undefined}} Conversation */

export class ConversationError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export class ConversationService {
  /** @type {Map<string, Conversation>} */
  #sessions = new Map()
  /** @type {Map<string, Promise<void>>} */
  #locks = new Map()

  /**
   * @param {{
   *   createSession: (request: {key: string, model: string, thinking?: string}) => ProviderSession,
   *   disposeSession: (session: Conversation) => Promise<void>,
   *   maxAge?: number,
   *   maxSessions?: number,
   *   now?: () => number,
   * }} options
   */
  constructor({ createSession, disposeSession, maxAge = 30 * 60 * 1000, maxSessions = 20, now = Date.now }) {
    this.createSession = createSession
    this.disposeSession = disposeSession
    this.maxAge = maxAge
    this.maxSessions = maxSessions
    this.now = now
  }

  /** @param {string} key @param {string} turnId */
  attach(key, turnId) {
    const session = this.#sessions.get(key)
    if (!session?.lastTurn?.stream || session.lastTurn.id !== turnId) return undefined
    session.lastUsed = this.now()
    return session.lastTurn.stream
  }

  /**
   * Atomically selects the session and reserves its active turn. The
   * reservation exists before the caller can begin asynchronous provider work.
   * @param {{key: string, model: string, thinking?: string, resume: boolean, retry: boolean, turnId: string, input: string}} request
   */
  async acquire(request) {
    return this.#locked(request.key, async () => {
      let session = this.#sessions.get(request.key)
      if (request.resume && !session) {
        throw new ConversationError('This conversation’s runtime context has expired. Its transcript is saved, but you need to start a new conversation.', 409)
      }
      if (!session) {
        if (this.#sessions.size >= this.maxSessions) {
          throw new ConversationError('The demo is at its session limit. Try again shortly.', 503)
        }
        const created = { ...this.createSession(request), lastUsed: this.now() }
        this.#sessions.set(request.key, created)
        session = created
      }
      if (session.active) throw new ConversationError('Wait for the current response to finish.', 409)
      if (session.model !== request.model) {
        throw new ConversationError('Start a new conversation to use a different model.', 409)
      }

      const previous = session.lastTurn
      if ((request.retry && previous?.id !== request.turnId) ||
          (previous?.id === request.turnId && previous.input !== request.input)) {
        throw new ConversationError('Only the latest response can be retried with its original prompt.', 409)
      }
      if (previous?.id === request.turnId && previous.completed) {
        if (!previous.stream) throw new ConversationError('This response is no longer available for replay.', 409)
        session.lastUsed = this.now()
        return { replay: previous.stream, session }
      }
      session.lastTurn = {
        id: request.turnId,
        input: request.input,
      }
      const control = { cancelRequested: false, turn: undefined, abortController: new AbortController() }
      session.active = control
      session.lastUsed = this.now()
      return { control, session }
    })
  }

  /** @param {Conversation} session @param {TurnControl} control */
  complete(session, control) {
    if (session.active === control && session.lastTurn) session.lastTurn.completed = true
  }

  /** @param {Conversation} session @param {TurnControl} control */
  release(session, control) {
    if (session.active === control) session.active = undefined
    session.lastUsed = this.now()
  }

  /** @param {string} key @param {string} turnId */
  async cancel(key, turnId) {
    const session = this.#sessions.get(key)
    const active = session?.active
    if (!active || session.lastTurn?.id !== turnId) return false
    active.cancelRequested = true
    active.abortController.abort()
    if (active.turn) await active.turn.cancel().catch(() => {})
    return true
  }

  /** @param {string} key */
  async reset(key) {
    await this.#locked(key, async () => {
      const session = this.#sessions.get(key)
      this.#sessions.delete(key)
      if (session) await this.disposeSession(session)
    })
  }

  async prune() {
    const cutoff = this.now() - this.maxAge
    await Promise.all([...this.#sessions.keys()].map((key) => this.#locked(key, async () => {
      const session = this.#sessions.get(key)
      if (!session || session.active || session.lastUsed >= cutoff) return
      this.#sessions.delete(key)
      await this.disposeSession(session)
    })))
  }

  /** @param {string} accountId */
  async resetAccount(accountId) {
    await Promise.all([...this.#sessions.keys()]
      .filter(key => key === accountId || key.startsWith(`${accountId}:`))
      .map(key => this.reset(key)))
  }

  async dispose() {
    await Promise.allSettled([...this.#sessions.keys()].map((key) => this.reset(key)))
  }

  /** @template T @param {string} key @param {() => Promise<T>} operation @returns {Promise<T>} */
  async #locked(key, operation) {
    const previous = this.#locks.get(key) ?? Promise.resolve()
    let unlock = () => {}
    /** @type {Promise<void>} */
    const current = new Promise((resolve) => { unlock = () => resolve() })
    this.#locks.set(key, current)
    await previous
    try {
      return await operation()
    } finally {
      unlock()
      if (this.#locks.get(key) === current) this.#locks.delete(key)
    }
  }
}
