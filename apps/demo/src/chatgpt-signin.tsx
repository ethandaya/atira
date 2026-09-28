import { colors, space, type } from '@atiraui/foundations/tokens.stylex'
import { Button, Dialog, Status, VisuallyHidden } from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  CircleCheck,
  CircleUserRound,
  Clock3,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { z } from 'zod'

import { authStatusSchema } from '../chat-contract.ts'
import type { NanocodexChatStore } from './nanocodex-store'

type AuthStatus = z.infer<typeof authStatusSchema>
const authChannelName = 'atira:chatgpt-auth'

export function useChatGptSignin(store: NanocodexChatStore) {
  const [status, setStatus] = useState<AuthStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const statusRef = useRef<AuthStatus | undefined>(undefined)
  const manualController = useRef<AbortController>(null)
  const refreshController = useRef<AbortController>(null)
  const updateStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect, react-doctor/no-set-state-after-await-in-effect -- This abortable request publishes server-owned state before refreshing an authenticated runtime.
  useEffect(() => {
    const controller = new AbortController()
    void requestStatus('GET', controller.signal)
      .then(async (next) => {
        controller.signal.throwIfAborted()
        updateStatus(next)
        if (next.state === 'authenticated') await store.initialize()
        controller.signal.throwIfAborted()
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not check ChatGPT sign-in. Try again.')
      })
    return () => controller.abort()
  }, [store, updateStatus])

  // Re-read the server-owned session when another tab changes it or this tab returns to the foreground.
  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect -- Browser lifecycle events invalidate the local status snapshot.
  useEffect(() => {
    const channel = new BroadcastChannel(authChannelName)

    function refresh() {
      if (manualController.current || statusRef.current?.state === 'pending')
        return
      refreshController.current?.abort()
      const controller = new AbortController()
      refreshController.current = controller
      void requestStatus('GET', controller.signal)
        .then(async (next) => {
          if (next.state !== 'authenticated') updateStatus(next)
          await store.initialize()
          controller.signal.throwIfAborted()
          updateStatus(next)
          setError('')
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('Could not check ChatGPT sign-in. Try again.')
        })
    }

    function refreshVisible() {
      if (document.visibilityState === 'visible') refresh()
    }

    channel.addEventListener('message', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      refreshController.current?.abort()
      refreshController.current = null
      channel.close()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [store, updateStatus])

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
              updateStatus(next)
              store.newConversation()
              return
            }
            updateStatus(next)
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
  }, [status, store, error, busy, updateStatus])

  useEffect(
    () => () => {
      manualController.current?.abort()
      manualController.current = null
      refreshController.current?.abort()
      refreshController.current = null
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
      if (method === 'DELETE') {
        updateStatus(next)
        broadcastAuthChange()
        await store.initialize()
        controller.signal.throwIfAborted()
        store.newConversation()
      } else if (next.state === 'authenticated') {
        await store.initialize()
        controller.signal.throwIfAborted()
        updateStatus(next)
        store.newConversation()
        if (method === 'POST') broadcastAuthChange()
      } else {
        updateStatus(next)
        if (method === 'POST') broadcastAuthChange()
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
  disabled,
  signin,
}: {
  disabled: boolean
  signin: ReturnType<typeof useChatGptSignin>
}) {
  const { status, busy, error, change } = signin
  const presentation = signinPresentation(status, error)

  const actions = (
    <SigninActions
      busy={busy}
      change={change}
      disabled={disabled}
      error={error}
      status={status}
    />
  )

  return (
    <Dialog
      actions={actions}
      closeLabel="Done"
      description={presentation.description}
      title={presentation.title}
      trigger={
        <span {...stylex.props(styles.trigger)}>
          <span aria-hidden="true" {...stylex.props(styles.triggerIcon)}>
            {presentation.triggerIcon}
          </span>
          <span>{presentation.triggerLabel}</span>
          <VisuallyHidden> ChatGPT</VisuallyHidden>
        </span>
      }
    >
      <SigninBody error={error} status={status} />
    </Dialog>
  )
}

function signinPresentation(status: AuthStatus | undefined, error: string) {
  let presentation: {
    description: string
    title: string
    triggerIcon: ReactNode
    triggerLabel: string
  }
  if (status?.state === 'pending') {
    presentation = {
      description: 'Enter the device code in ChatGPT, then return here.',
      title: 'Finish signing in',
      triggerIcon: <Clock3 size={16} strokeWidth={1.75} />,
      triggerLabel: 'Pending',
    }
  } else if (status?.state === 'authenticated') {
    presentation = {
      description: 'This browser session can use the Nanocodex runtime.',
      title: 'ChatGPT connected',
      triggerIcon: <CircleCheck size={16} strokeWidth={1.75} />,
      triggerLabel: 'Connected',
    }
  } else {
    presentation = {
      description: 'Connect ChatGPT to use the Nanocodex runtime.',
      title: 'ChatGPT sign-in',
      triggerIcon: <CircleUserRound size={16} strokeWidth={1.75} />,
      triggerLabel: status ? 'Sign in' : 'Checking',
    }
  }
  if (!error) return presentation
  return {
    ...presentation,
    description: 'ChatGPT sign-in could not be updated.',
    triggerIcon: <TriangleAlert size={16} strokeWidth={1.75} />,
    triggerLabel: 'Sign-in error',
  }
}

function SigninActions({
  busy,
  change,
  disabled,
  error,
  status,
}: {
  busy: boolean
  change: (method: 'POST' | 'DELETE' | 'GET') => Promise<void>
  disabled: boolean
  error: string
  status: AuthStatus | undefined
}) {
  const actionDisabled = busy || disabled
  if (status?.state === 'pending') {
    return (
      <PendingSigninActions
        busy={busy}
        change={change}
        disabled={actionDisabled}
        error={error}
      />
    )
  }
  if (status?.state === 'authenticated') {
    return (
      <Button
        disabled={actionDisabled}
        onClick={() => void change('DELETE')}
        size="compact"
        variant="danger"
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
    )
  }
  if (!status && !error) return null
  return (
    <Button
      disabled={actionDisabled}
      onClick={() => void change('POST')}
      size="compact"
      variant="primary"
    >
      {busy ? 'Starting…' : error ? 'Try again' : 'Continue with ChatGPT'}
    </Button>
  )
}

function PendingSigninActions({
  busy,
  change,
  disabled,
  error,
}: {
  busy: boolean
  change: (method: 'POST' | 'DELETE' | 'GET') => Promise<void>
  disabled: boolean
  error: string
}) {
  return (
    <>
      {error ? (
        <Button
          disabled={disabled}
          onClick={() => void change('GET')}
          size="compact"
          variant="primary"
        >
          {busy ? 'Checking…' : 'Retry sign-in status'}
        </Button>
      ) : null}
      <Button
        disabled={disabled}
        onClick={() => void change('DELETE')}
        size="compact"
        variant="quiet"
      >
        Cancel sign-in
      </Button>
    </>
  )
}

function SigninBody({
  error,
  status,
}: {
  error: string
  status: AuthStatus | undefined
}) {
  return (
    <div {...stylex.props(styles.body)}>
      {error ? (
        <Status role="alert" tone="danger">
          {error}
        </Status>
      ) : null}
      <SigninStatus error={error} status={status} />
    </div>
  )
}

function SigninStatus({
  error,
  status,
}: {
  error: string
  status: AuthStatus | undefined
}) {
  if (status?.state === 'pending') {
    return (
      <>
        <span {...stylex.props(styles.code)}>{status.userCode}</span>
        <p {...stylex.props(styles.copy)} role="status">
          Open{' '}
          <a
            href={status.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.link)}
          >
            ChatGPT device sign-in
          </a>{' '}
          and enter this code. Waiting for approval…
        </p>
      </>
    )
  }
  if (status?.state === 'authenticated') return <Status>Connected</Status>
  if (status?.state === 'expired')
    return <Status tone="danger">Sign-in expired. Start again.</Status>
  if (status && !error) {
    return (
      <p {...stylex.props(styles.copy)}>
        ChatGPT credentials stay in server memory for this browser session.
      </p>
    )
  }
  if (!error) return <Status>Checking sign-in…</Status>
  return null
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

function broadcastAuthChange() {
  const channel = new BroadcastChannel(authChannelName)
  channel.postMessage('changed')
  channel.close()
}

const styles = stylex.create({
  trigger: {
    alignItems: 'center',
    display: 'flex',
    gap: space.x2,
  },
  triggerIcon: { alignItems: 'center', display: 'inline-flex' },
  body: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
  },
  code: {
    backgroundColor: colors.surfaceInset,
    borderRadius: '0.5rem',
    color: colors.text,
    fontFamily: type.familyMono,
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    letterSpacing: '0.08em',
    padding: `${space.x3} ${space.x4}`,
  },
  copy: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  link: {
    color: colors.text,
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
})
