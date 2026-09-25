import { Button } from '@atira/primitives'
import { colors, space, type } from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import { authStatusSchema } from '../chat-contract.mjs'
import type { NanocodexChatStore } from './nanocodex-store'

type AuthStatus = z.infer<typeof authStatusSchema>

function useSigninLifecycle(store: NanocodexChatStore) {
  const [status, setStatus] = useState<AuthStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const manualController = useRef<AbortController>(null)

  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect, react-doctor/no-set-state-after-await-in-effect -- This abortable status request publishes only after initialization and a cancellation check.
  useEffect(() => {
    const controller = new AbortController()
    void requestStatus('GET', controller.signal)
      .then(async (next) => {
        await store.initialize()
        controller.signal.throwIfAborted()
        setStatus(next)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not check ChatGPT sign-in. Try again.')
      })
    return () => controller.abort()
  }, [store])

  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect -- This effect owns and aborts device-code polling; its signal guards state and conversation reset after awaited work.
  useEffect(() => {
    if (status?.state !== 'pending' || error || busy) return
    const controller = new AbortController()
    const timer = window.setTimeout(
      () => {
        void requestStatus('GET', controller.signal)
          .then(async (next) => {
            if (next.state === 'authenticated') {
              await store.initialize()
              controller.signal.throwIfAborted()
              setStatus(next)
              store.newConversation()
              return
            }
            setStatus(next)
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setError('Could not check sign-in. Try again.')
          })
      },
      Math.max(1_000, status.pollAfterMs),
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [status, store, error, busy])

  useEffect(
    () => () => {
      manualController.current?.abort()
      manualController.current = null
    },
    [],
  )

  async function change(method: 'POST' | 'DELETE' | 'GET') {
    manualController.current?.abort()
    const controller = new AbortController()
    manualController.current = controller
    setBusy(true)
    setError('')
    try {
      const next = await requestStatus(method, controller.signal)
      if (method === 'DELETE' || next.state === 'authenticated') {
        await store.initialize()
        controller.signal.throwIfAborted()
        setStatus(next)
        store.newConversation()
      } else {
        setStatus(next)
      }
    } catch {
      if (!controller.signal.aborted)
        setError('ChatGPT sign-in could not be updated. Try again.')
    } finally {
      if (manualController.current === controller) {
        manualController.current = null
        // react-doctor-disable-next-line react-doctor/no-loading-flag-reset-outside-finally -- This is inside finally; an obsolete request must not unlock a newer one.
        setBusy(false)
      }
    }
  }

  return { status, busy, error, change }
}

export function ChatGptSignin({
  store,
  disabled,
}: {
  store: NanocodexChatStore
  disabled: boolean
}) {
  const { status, busy, error, change } = useSigninLifecycle(store)

  return (
    <section aria-label="ChatGPT sign-in" {...stylex.props(styles.root)}>
      <SigninControl
        status={status}
        busy={busy}
        disabled={disabled}
        error={error}
        change={change}
      />
      {status?.state === 'expired' && (
        <span role="status">Sign-in expired. Start again.</span>
      )}
      {error && (
        <>
          <span role="alert">{error}</span>
          <Button
            variant="quiet"
            disabled={busy || disabled}
            onClick={() => void change('GET')}
          >
            Retry sign-in status
          </Button>
        </>
      )}
    </section>
  )
}

function SigninControl({
  status,
  busy,
  disabled,
  error,
  change,
}: {
  status: AuthStatus | undefined
  busy: boolean
  disabled: boolean
  error: string
  change: (method: 'POST' | 'DELETE' | 'GET') => Promise<void>
}) {
  if (status?.state === 'pending') {
    return (
      <>
        <p {...stylex.props(styles.copy)} role="status">
          Enter <strong>{status.userCode}</strong> at{' '}
          <a
            href={status.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            ChatGPT sign-in
          </a>
          . Waiting for approval…
        </p>
        <Button
          variant="quiet"
          disabled={busy || disabled}
          onClick={() => void change('DELETE')}
        >
          Cancel sign-in
        </Button>
      </>
    )
  }

  const method = status?.state === 'authenticated' ? 'DELETE' : 'POST'
  let label = 'Sign in with ChatGPT'
  if (busy) label = 'Updating sign-in…'
  else if (!status && !error) label = 'Checking sign-in…'
  else if (status?.state === 'authenticated') label = 'Sign out of ChatGPT'

  return (
    <Button
      variant="quiet"
      disabled={busy || disabled || (!status && !error)}
      onClick={() => void change(method)}
    >
      {label}
    </Button>
  )
}

async function requestStatus(method: string, signal?: AbortSignal) {
  const response = await fetch('/api/auth/chatgpt', {
    method,
    ...(signal ? { signal } : {}),
  })
  if (!response.ok) throw new Error('Sign-in request failed')
  const status = authStatusSchema.parse(await response.json())
  signal?.throwIfAborted()
  return status
}

const styles = stylex.create({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    justifyContent: 'center',
    paddingBlock: space.x2,
    paddingInline: space.x4,
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
  },
  copy: { margin: 0 },
})
