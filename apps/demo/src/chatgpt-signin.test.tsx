// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSyncExternalStore } from 'react'

vi.mock('@stylexjs/stylex', () => ({
  create: <Styles,>(styles: Styles) => styles,
  createTheme: () => ({}),
  defineVars: <Vars,>(variables: Vars) => variables,
  firstThatWorks: (...values: string[]) => values[0],
  keyframes: () => '',
  props: () => ({}),
}))

import { useChatGptSignin } from './chatgpt-signin'
import { createDraft, NanocodexChatStore } from './nanocodex-store'
import {
  controlledStreamResponse,
  installAnimationFrameStub,
  runtimeResponse,
} from './nanocodex-store.test-fixtures'

beforeEach(() => {
  installAnimationFrameStub()
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      addEventListener() {}
      close() {}
      postMessage() {}
      removeEventListener() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('publishes authenticated status while a restored response is still running', async () => {
  let saved: string | null = null
  const storage = {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value
    },
  }
  const originalStream = controlledStreamResponse()
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (url) =>
      url === '/api/runtime' ? runtimeResponse() : originalStream.response,
    ),
  )
  const original = new NanocodexChatStore(storage)
  await original.initialize()
  const request = original.submit(createDraft('Keep running'), 'send')
  await vi.waitFor(() =>
    expect(original.getSnapshot().activity.status).toBe('busy'),
  )
  original.persist()
  original.dispose()
  originalStream.close()
  await request

  const replayStream = controlledStreamResponse()
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (url) => {
      if (url === '/api/auth/chatgpt')
        return Response.json({ state: 'authenticated' })
      if (url === '/api/runtime') return runtimeResponse()
      return replayStream.response
    }),
  )
  const restored = new NanocodexChatStore(storage)

  function StatusProbe() {
    const signin = useChatGptSignin(restored)
    const snapshot = useSyncExternalStore(
      restored.subscribe,
      restored.getSnapshot,
      restored.getSnapshot,
    )
    return (
      <>
        <span>{signin.status?.state}</span>
        <span>{snapshot.activity.status}</span>
        <span>
          {snapshot.capabilities.canStop ? 'can stop' : 'cannot stop'}
        </span>
      </>
    )
  }

  render(<StatusProbe />)
  await waitFor(() => expect(screen.getByText('authenticated')).not.toBeNull())
  expect(screen.getByText('busy')).not.toBeNull()
  expect(screen.getByText('can stop')).not.toBeNull()

  restored.dispose()
  replayStream.close()
})
