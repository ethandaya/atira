import {
  PermissionRequest,
  QuestionRequest,
  type PermissionRequestState,
} from '@atira/components'
import type {
  QuestionRequestView,
  QuestionResponse,
} from '@atira/foundations/chat'
import { Button } from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'

function createQuestion(version: number): QuestionRequestView {
  return {
    id: `catalog-question-${version}`,
    order: 0,
    origin: { label: 'Design review', sessionId: 'catalog' },
    questions: [
      {
        allowCustom: false,
        id: 'density',
        label: 'Choose an interface density',
        required: true,
        type: 'single-choice',
        options: [
          {
            id: 'calm',
            label: 'Calm',
            description: 'More room between turns.',
          },
          {
            id: 'compact',
            label: 'Compact',
            description: 'More context on screen.',
          },
        ],
      },
    ],
    state: { status: 'pending' },
    type: 'question',
  }
}

export function RequestsExample() {
  const [permission, setPermission] = useState<PermissionRequestState>({
    status: 'pending',
  })
  const [request, setRequest] = useState(() => createQuestion(0))
  const version = useRef(0)
  const permissionRef = useRef<HTMLDivElement>(null)
  const questionRef = useRef<HTMLDivElement>(null)

  const answer = (response: QuestionResponse) => {
    setRequest((current) => ({
      ...current,
      state: { status: 'resolved', decision: { type: 'answer', response } },
    }))
    focusHeading(questionRef)
  }
  const dismiss = () => {
    setRequest((current) => ({
      ...current,
      state: { status: 'resolved', decision: { type: 'reject' } },
    }))
    focusHeading(questionRef)
  }
  const reset = () => {
    version.current += 1
    setPermission({ status: 'pending' })
    setRequest(createQuestion(version.current))
    requestAnimationFrame(() =>
      permissionRef.current?.querySelector('button')?.focus(),
    )
  }

  return (
    <div {...stylex.props(styles.stack)}>
      <div ref={permissionRef}>
        {permission.status === 'pending' ? (
          <PermissionRequest
            consequence="external"
            effect="Create a draft issue in the connected project."
            id="catalog-permission"
            onApprove={() => {
              setPermission({ status: 'resolved', decision: 'approved' })
              focusHeading(permissionRef)
            }}
            onReject={() => {
              setPermission({ status: 'resolved', decision: 'rejected' })
              focusHeading(permissionRef)
            }}
            state={permission}
            title="Allow this external action?"
          />
        ) : (
          <PermissionRequest
            consequence="external"
            effect="Create a draft issue in the connected project."
            id="catalog-permission"
            state={permission}
            title="Allow this external action?"
          />
        )}
      </div>
      <div ref={questionRef}>
        <QuestionRequest
          request={request}
          onAnswer={answer}
          onReject={dismiss}
        />
      </div>
      {(permission.status !== 'pending' ||
        request.state.status !== 'pending') && (
        <Button onClick={reset} variant="quiet" {...stylex.props(styles.reset)}>
          Reset requests
        </Button>
      )}
    </div>
  )
}

function focusHeading(container: { current: HTMLDivElement | null }) {
  requestAnimationFrame(() => {
    const heading = container.current?.querySelector('h1, h2, h3, h4, h5, h6')
    if (!(heading instanceof HTMLElement)) return
    heading.tabIndex = -1
    heading.focus()
  })
}

const styles = stylex.create({
  reset: {
    alignSelf: 'flex-start',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  },
})
