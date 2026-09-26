import type { RunStream } from './run-stream.ts'
import type { DefaultAgent, Thinking, Turn as AgentTurn } from 'nanocodex'

export type TurnControl = {
  abortController: AbortController
  cancelRequested: boolean
  turn?: AgentTurn
}

type ConversationTurn = {
  completed?: boolean
  id: string
  input: string
  stream?: RunStream
}

export type ProviderSession = {
  agent?: Promise<DefaultAgent>
  model?: string
  thinking?: Thinking
}

export type Conversation = ProviderSession & {
  active?: TurnControl
  lastTurn?: ConversationTurn
  lastUsed: number
}

type ConversationRequest = {
  input: string
  key: string
  model: string
  resume: boolean
  retry: boolean
  thinking?: string | undefined
  turnId: string
}

type ConversationServiceOptions = {
  createSession: (request: ConversationRequest) => ProviderSession
  disposeSession: (session: Conversation) => Promise<void>
  maxAge?: number
  maxSessions?: number
  now?: () => number
}

type ActiveConversation = Conversation & {
  active: TurnControl
  lastTurn: ConversationTurn
}

type Acquisition =
  | { kind: 'replay'; replay: RunStream; session: Conversation }
  | { control: TurnControl; kind: 'active'; session: ActiveConversation }

export class ConversationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class ConversationService {
  #sessions = new Map<string, Conversation>()
  #locks = new Map<string, Promise<void>>()
  createSession: ConversationServiceOptions['createSession']
  disposeSession: ConversationServiceOptions['disposeSession']
  maxAge: number
  maxSessions: number
  now: () => number

  constructor({
    createSession,
    disposeSession,
    maxAge = 30 * 60 * 1000,
    maxSessions = 20,
    now = Date.now,
  }: ConversationServiceOptions) {
    this.createSession = createSession
    this.disposeSession = disposeSession
    this.maxAge = maxAge
    this.maxSessions = maxSessions
    this.now = now
  }

  attach(key: string, turnId: string) {
    const session = this.#sessions.get(key)
    if (!session?.lastTurn?.stream || session.lastTurn.id !== turnId)
      return undefined
    session.lastUsed = this.now()
    return session.lastTurn.stream
  }

  // The reservation exists before the caller can begin asynchronous provider work.
  async acquire(request: ConversationRequest): Promise<Acquisition> {
    return this.#locked(request.key, async () => {
      let session = this.#sessions.get(request.key)
      if (request.resume && !session) {
        throw new ConversationError(
          'This conversation’s runtime context has expired. Its transcript is saved, but you need to start a new conversation.',
          409,
        )
      }
      if (!session) {
        if (this.#sessions.size >= this.maxSessions) {
          throw new ConversationError(
            'The demo is at its session limit. Try again shortly.',
            503,
          )
        }
        const created = {
          ...this.createSession(request),
          lastUsed: this.now(),
        }
        this.#sessions.set(request.key, created)
        session = created
      }
      if (session.active)
        throw new ConversationError(
          'Wait for the current response to finish.',
          409,
        )
      if (session.model !== request.model) {
        throw new ConversationError(
          'Start a new conversation to use a different model.',
          409,
        )
      }

      const previous = session.lastTurn
      if (
        (request.retry && previous?.id !== request.turnId) ||
        (previous?.id === request.turnId && previous.input !== request.input)
      ) {
        throw new ConversationError(
          'Only the latest response can be retried with its original prompt.',
          409,
        )
      }
      if (previous?.id === request.turnId && previous.completed) {
        if (!previous.stream)
          throw new ConversationError(
            'This response is no longer available for replay.',
            409,
          )
        session.lastUsed = this.now()
        return { kind: 'replay', replay: previous.stream, session }
      }
      session.lastTurn = {
        id: request.turnId,
        input: request.input,
      }
      const control: TurnControl = {
        cancelRequested: false,
        abortController: new AbortController(),
      }
      session.active = control
      session.lastUsed = this.now()
      return {
        control,
        kind: 'active',
        session: session as ActiveConversation,
      }
    })
  }

  complete(session: Conversation, control: TurnControl) {
    if (session.active === control && session.lastTurn)
      session.lastTurn.completed = true
  }

  release(session: Conversation, control: TurnControl) {
    if (session.active === control) delete session.active
    session.lastUsed = this.now()
  }

  async cancel(key: string, turnId: string) {
    const session = this.#sessions.get(key)
    const active = session?.active
    if (!active || session.lastTurn?.id !== turnId) return false
    active.cancelRequested = true
    active.abortController.abort()
    if (active.turn) await active.turn.cancel().catch(() => {})
    return true
  }

  async reset(key: string) {
    await this.#locked(key, async () => {
      const session = this.#sessions.get(key)
      this.#sessions.delete(key)
      if (session) await this.disposeSession(session)
    })
  }

  async prune() {
    const cutoff = this.now() - this.maxAge
    await Promise.all(
      [...this.#sessions.keys()].map((key) =>
        this.#locked(key, async () => {
          const session = this.#sessions.get(key)
          if (!session || session.active || session.lastUsed >= cutoff) return
          this.#sessions.delete(key)
          await this.disposeSession(session)
        }),
      ),
    )
  }

  async resetAccount(accountId: string) {
    await Promise.all(
      [...this.#sessions.keys()]
        .filter((key) => key === accountId || key.startsWith(`${accountId}:`))
        .map((key) => this.reset(key)),
    )
  }

  async dispose() {
    await Promise.allSettled(
      [...this.#sessions.keys()].map((key) => this.reset(key)),
    )
  }

  async #locked<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(key) ?? Promise.resolve()
    let unlock = () => {}
    const current = new Promise<void>((resolve) => {
      unlock = resolve
    })
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
