import { Button } from '@pretty-amped/primitives'
import { colors, space, type } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useEffect, useState } from 'react'
import type { z } from 'zod'

import { authStatusSchema } from '../chat-contract.mjs'
import type { NanocodexChatStore } from './nanocodex-store'

type AuthStatus = z.infer<typeof authStatusSchema>

export function ChatGptSignin({
  store,
  disabled,
}: {
  store: NanocodexChatStore
  disabled: boolean
}) {
  const [status, setStatus] = useState<AuthStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void requestStatus('GET', controller.signal)
      .then(async (next) => {
        setStatus(next)
        await store.initialize()
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not check ChatGPT sign-in. Try again.')
      })
    return () => controller.abort()
  }, [store])

  useEffect(() => {
    if (status?.state !== 'pending' || error || busy) return
    const controller = new AbortController()
    const timer = window.setTimeout(
      () => {
        void requestStatus('GET', controller.signal)
          .then(async (next) => {
            setStatus(next)
            if (next.state === 'authenticated') {
              await store.initialize()
              store.newConversation()
            }
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

  async function change(method: 'POST' | 'DELETE' | 'GET') {
    setBusy(true)
    setError('')
    try {
      const next = await requestStatus(method)
      setStatus(next)
      if (method === 'DELETE' || next.state === 'authenticated') {
        await store.initialize()
        store.newConversation()
      }
    } catch {
      setError('ChatGPT sign-in could not be updated. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="ChatGPT sign-in" {...stylex.props(styles.root)}>
      {status?.state === 'pending' ? (
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
      ) : (
        <Button
          variant="quiet"
          disabled={busy || disabled || (!status && !error)}
          onClick={() =>
            void change(status?.state === 'authenticated' ? 'DELETE' : 'POST')
          }
        >
          {busy
            ? 'Updating sign-in…'
            : !status && !error
              ? 'Checking sign-in…'
              : status?.state === 'authenticated'
                ? 'Sign out of ChatGPT'
                : 'Sign in with ChatGPT'}
        </Button>
      )}
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
