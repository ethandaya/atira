import type { ChatSnapshot, ChatStore } from '@pretty-amped/foundations/chat'

export type Frame = { at: number; label: string; snapshot: ChatSnapshot }
export type Target = { slot: string; selector: string; text: string }
export type Note = { frame: number; target: Target; text: string }

export function frameLabel(snapshot: ChatSnapshot): string {
  const turn = snapshot.turns.at(-1)
  if (!turn) return 'Empty thread'
  if (snapshot.requests.some(request => request.state.status === 'pending')) return 'Awaiting input'
  if (turn.state.status !== 'running') return `Turn ${turn.state.status}`
  const part = turn.assistant.flatMap(message => message.parts).at(-1)
  if (!part) return 'Working'
  if (part.type === 'tool') {
    const task = part.presentation.kind === 'task' ? part.presentation : undefined
    return `${task ? task.agent?.label ?? 'Subagent' : part.toolName} · ${part.state.status === 'running' ? task?.activity?.summary ?? 'running' : part.state.status}`
  }
  if (part.type === 'text') return `Response · ${part.state.status}`
  if (part.type === 'reasoning') return `Thinking · ${part.state.status}`
  return part.type
}

// Keep lifecycle changes immediately; coalesce token updates, not transitions.
export function captureThread(store: ChatStore, append: (frame: Frame) => void) {
  let previous = store.getSnapshot()
  let lastAt = 0
  let signature = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const record = (snapshot: ChatSnapshot) => {
    clearTimeout(timer)
    lastAt = Date.now()
    append({ at: lastAt, label: frameLabel(snapshot), snapshot })
  }
  record(previous)
  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getSnapshot()
    // Typing a draft alone is not a thread transition.
    if (snapshot.turns === previous.turns && snapshot.requests === previous.requests &&
        snapshot.activity === previous.activity && snapshot.sessionId === previous.sessionId) return
    previous = snapshot
    const nextSignature = JSON.stringify([
      snapshot.sessionId, snapshot.activity, snapshot.requests,
      snapshot.turns.at(-1)?.assistant.map(message => message.parts.map(part => [
        part.id, 'state' in part ? part.state.status : '',
        part.type === 'tool' && part.presentation.kind === 'task' ? [
          part.presentation.activity,
          part.presentation.transcript?.steps.map(step => [step.id, step.status]),
          Boolean(part.presentation.transcript?.result),
        ] : null,
      ])), frameLabel(snapshot),
    ])
    clearTimeout(timer)
    if (nextSignature !== signature || Date.now() - lastAt >= 150) record(snapshot)
    else timer = setTimeout(() => record(store.getSnapshot()), 150 - (Date.now() - lastAt))
    signature = nextSignature
  })
  return () => { clearTimeout(timer); unsubscribe() }
}

// The replay store has no reference to the runtime. Even an accidental mutation
// cannot submit, stop, approve, retry, or change a real conversation.
export function playbackStore(initial: ChatSnapshot) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  const blocked = () => { throw new Error('Playback is read-only. Return to Live to interact.') }
  const store: ChatStore = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    answerQuestion: blocked, decidePermission: blocked, dismissReverted: blocked,
    dismissSubmissionError: blocked, editQueued: blocked, loadPrevious: blocked,
    reconnect: blocked, redoReverted: blocked, rejectQuestion: blocked,
    removeQueued: blocked, restoreReverted: blocked, retryQueued: blocked,
    retrySubmission: blocked, retryTurn: blocked, revert: blocked, stop: blocked,
    submit: blocked, updateDraft: blocked, updateQueue: blocked,
  }
  return { store, update(next: ChatSnapshot) { snapshot = next; listeners.forEach(listener => listener()) } }
}
