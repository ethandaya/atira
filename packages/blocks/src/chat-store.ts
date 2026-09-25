import type { ChatStore } from '@atira/foundations/chat'
import { useSyncExternalStore } from 'react'

export function useChatStore(store: ChatStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
}
