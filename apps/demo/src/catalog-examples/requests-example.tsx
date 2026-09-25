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

export function RequestsExample({ compact = false }: { compact?: boolean }) {
  const [permission, setPermission] = useState<PermissionRequestState>({
    status: 'pending',
  })
  const [request, setRequest] = useState(() => createQuestion(0))
  const version = useRef(0)

  if (compact) {
    return (
      <PermissionRequest
        consequence="external"
        effect="Create a draft issue."
        id="catalog-permission-card"
        state={{ status: 'resolved', decision: 'approved' }}
        title="External action"
      />
    )
  }

  const answer = (response: QuestionResponse) => {
    setRequest((current) => ({
      ...current,
      state: { status: 'resolved', decision: { type: 'answer', response } },
    }))
  }
  const dismiss = () =>
    setRequest((current) => ({
      ...current,
      state: { status: 'resolved', decision: { type: 'reject' } },
    }))
  const reset = () => {
    version.current += 1
    setPermission({ status: 'pending' })
    setRequest(createQuestion(version.current))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 0,
      }}
    >
      {permission.status === 'pending' ? (
        <PermissionRequest
          consequence="external"
          effect="Create a draft issue in the connected project."
          id="catalog-permission"
          onApprove={() =>
            setPermission({ status: 'resolved', decision: 'approved' })
          }
          onReject={() =>
            setPermission({ status: 'resolved', decision: 'rejected' })
          }
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
      <QuestionRequest request={request} onAnswer={answer} onReject={dismiss} />
      {(permission.status !== 'pending' ||
        request.state.status !== 'pending') && (
        <Button
          onClick={reset}
          variant="quiet"
          style={{ alignSelf: 'flex-start' }}
        >
          Reset requests
        </Button>
      )}
    </div>
  )
}
