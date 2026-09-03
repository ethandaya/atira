import type {
  ChatRequest,
  PermissionDecision,
  PermissionRequestView,
  QuestionAnswer,
  QuestionRequestView,
  QuestionResponse,
  RevertedPrompt,
  TodoListView,
} from '@pretty-amped/foundations/chat'
import { selectActiveRequest } from '@pretty-amped/foundations/chat-invariants'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
import {
  Button,
  CheckboxField,
  Disclosure,
  RadioGroup,
  RadioOption,
  TextareaField,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

export type PermissionPromptProps = {
  availableDecisions?: readonly PermissionDecision[]
  onDecision?: (decision: PermissionDecision) => void
  request: PermissionRequestView
}

export function PermissionPrompt({
  availableDecisions = ['once', 'always', 'reject'],
  onDecision,
  request,
}: PermissionPromptProps) {
  const titleId = useId()
  const pending = request.state.status === 'pending'
  const submitting = request.state.status === 'submitting'
  const failed = request.state.status === 'failed'
  const actionable = pending || failed
  const activeDecision =
    'decision' in request.state ? request.state.decision : undefined

  return (
    <section
      aria-busy={submitting || undefined}
      aria-labelledby={titleId}
      data-consequence={request.consequence}
      data-origin-session-id={request.origin.sessionId}
      data-permission-id={request.id}
      data-slot="permission-prompt"
      data-state={request.state.status}
      {...stylex.props(styles.request)}
    >
      <div {...stylex.props(styles.requestCopy)}>
        <h2
          id={titleId}
          data-request-heading
          tabIndex={-1}
          {...stylex.props(styles.title)}
        >
          {request.title}
        </h2>
        {request.origin.label && (
          <p {...stylex.props(styles.origin)}>{request.origin.label}</p>
        )}
        <p {...stylex.props(styles.effect)}>{request.effect}</p>
        <p {...stylex.props(styles.supporting)}>
          {consequenceLabel(request.consequence)}
          {request.scope ? ` ${request.scope}` : ''}
        </p>
      </div>

      {request.state.status === 'failed' && (
        <p role="alert" {...stylex.props(styles.error)}>
          {request.state.error.message}
        </p>
      )}

      <div {...stylex.props(styles.requestFooter)}>
        <p role="status" {...stylex.props(styles.status)}>
          {permissionStatus(request)}
        </p>
        {(actionable || submitting) && (
          <div
            role="group"
            aria-label="Permission decision"
            {...stylex.props(styles.actions)}
          >
            {availableDecisions.includes('reject') && (
              <Button
                disabled={submitting}
                focusableWhenDisabled={submitting && activeDecision === 'reject'}
                onClick={() => onDecision?.('reject')}
                size="compact"
                variant="quiet"
              >
                {submitting && activeDecision === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            )}
            {availableDecisions.includes('always') && (
              <Button
                disabled={submitting}
                focusableWhenDisabled={submitting && activeDecision === 'always'}
                onClick={() => onDecision?.('always')}
                size="compact"
                variant="outline"
              >
                {submitting && activeDecision === 'always'
                  ? 'Allowing…'
                  : 'Always allow'}
              </Button>
            )}
            {availableDecisions.includes('once') && (
              <Button
                disabled={submitting}
                focusableWhenDisabled={submitting && activeDecision === 'once'}
                onClick={() => onDecision?.('once')}
                size="compact"
                variant="primary"
              >
                {submitting && activeDecision === 'once'
                  ? 'Allowing…'
                  : 'Allow once'}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export type QuestionRequestProps = {
  onAnswer?: (response: QuestionResponse) => void
  onReject?: () => void
  request: QuestionRequestView
}

export function QuestionRequest({
  onAnswer,
  onReject,
  request,
}: QuestionRequestProps) {
  const titleId = useId()
  const [values, setValues] = useState<
    Record<string, string | readonly string[]>
  >({})
  const submitting = request.state.status === 'submitting'
  const actionable = request.state.status === 'pending'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actionable) return

    const answers: QuestionAnswer[] = request.questions.map((question) => {
      if (question.type === 'text') {
        return {
          questionId: question.id,
          type: 'text',
          value: stringValue(values[question.id]),
        }
      }

      const customValue = stringValue(values[customKey(question.id)]).trim()
      return {
        ...(customValue ? { customValue } : {}),
        optionIds: arrayValue(values[question.id]),
        questionId: question.id,
        type: 'choice',
      }
    })
    onAnswer?.({ answers })
  }

  return (
    <form
      aria-busy={submitting || undefined}
      aria-labelledby={titleId}
      data-origin-session-id={request.origin.sessionId}
      data-question-request-id={request.id}
      data-slot="question-request"
      data-state={request.state.status}
      onSubmit={submit}
      {...stylex.props(styles.request)}
    >
      <div {...stylex.props(styles.requestCopy)}>
        <h2
          id={titleId}
          data-request-heading
          tabIndex={-1}
          {...stylex.props(styles.title)}
        >
          A question needs your input
        </h2>
        {request.origin.label && (
          <p {...stylex.props(styles.origin)}>{request.origin.label}</p>
        )}
        <div {...stylex.props(styles.questions)}>
          {request.questions.map((question) => {
            if (question.type === 'text') {
              return (
                <TextareaField
                  disabled={!actionable}
                  key={question.id}
                  label={question.label}
                  maxLength={question.maxLength}
                  onValueChange={(value) =>
                    setValues((current) => ({ ...current, [question.id]: value }))
                  }
                  required={question.required}
                  rows={question.multiline ? 3 : 1}
                  value={stringValue(values[question.id])}
                />
              )
            }

            const selected = arrayValue(values[question.id])
            return (
              <div key={question.id} {...stylex.props(styles.choiceQuestion)}>
                {question.type === 'single-choice' ? (
                  <RadioGroup
                    disabled={!actionable}
                    label={question.label}
                    name={question.id}
                    onValueChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [question.id]: [value],
                      }))
                    }
                    required={question.required}
                    value={selected[0]}
                  >
                    {question.options.map((option) => (
                      <RadioOption
                        description={option.description}
                        key={option.id}
                        label={option.label}
                        value={option.id}
                      />
                    ))}
                  </RadioGroup>
                ) : (
                  <fieldset {...stylex.props(styles.fieldset)}>
                    <legend {...stylex.props(styles.legend)}>{question.label}</legend>
                    {question.options.map((option) => (
                      <CheckboxField
                        checked={selected.includes(option.id)}
                        description={option.description}
                        disabled={!actionable}
                        key={option.id}
                        label={option.label}
                        onCheckedChange={(checked) =>
                          setValues((current) => ({
                            ...current,
                            [question.id]: checked
                              ? [...selected, option.id]
                              : selected.filter((id) => id !== option.id),
                          }))
                        }
                        value={option.id}
                      />
                    ))}
                  </fieldset>
                )}
                {question.allowCustom && (
                  <TextareaField
                    disabled={!actionable}
                    label="Other answer"
                    onValueChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [customKey(question.id)]: value,
                      }))
                    }
                    rows={1}
                    value={stringValue(values[customKey(question.id)])}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {request.state.status === 'failed' && (
        <p role="alert" {...stylex.props(styles.error)}>
          {request.state.error.message}
        </p>
      )}

      <div {...stylex.props(styles.requestFooter)}>
        <p role="status" {...stylex.props(styles.status)}>
          {questionStatus(request)}
        </p>
        {(actionable || submitting) && (
          <div {...stylex.props(styles.actions)}>
            <Button
              disabled={!actionable}
              onClick={onReject}
              size="compact"
              variant="quiet"
            >
              Dismiss
            </Button>
            <Button
              disabled={!actionable}
              focusableWhenDisabled={submitting}
              size="compact"
              type="submit"
              variant="primary"
            >
              {submitting ? 'Submitting…' : 'Submit answer'}
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}

export type TodoDockProps = {
  defaultOpen?: boolean
  todos: TodoListView
}

export function TodoDock({ defaultOpen, todos }: TodoDockProps) {
  const complete = todos.items.filter((item) => item.state === 'complete').length

  return (
    <aside
      aria-label="Session tasks"
      data-slot="todo-dock"
      data-state={todos.state}
      data-todo-list-id={todos.id}
      {...stylex.props(styles.dock)}
    >
      <Disclosure
        defaultOpen={defaultOpen ?? todos.state === 'active'}
        summary={`${complete} of ${todos.items.length} tasks complete`}
        variant="plain"
      >
        <ol {...stylex.props(styles.todoList)}>
          {todos.items.map((item) => (
            <li
              data-slot="todo-item"
              data-state={item.state}
              data-todo-id={item.id}
              key={item.id}
              {...stylex.props(styles.todoItem)}
            >
              <span aria-hidden="true" {...stylex.props(styles.todoMark)}>
                {item.state === 'complete'
                  ? '✓'
                  : item.state === 'in-progress'
                    ? '→'
                    : item.state === 'cancelled'
                      ? '×'
                      : '·'}
              </span>
              <span>{item.title}</span>
            </li>
          ))}
        </ol>
      </Disclosure>
    </aside>
  )
}

export type RevertDockProps = {
  onDismiss: () => void
  onRestore: (reverted: RevertedPrompt) => void
  reverted: RevertedPrompt
}

export function RevertDock({ onDismiss, onRestore, reverted }: RevertDockProps) {
  return (
    <section
      aria-label="Reverted prompt"
      data-revert-id={reverted.id}
      data-slot="revert-dock"
      {...stylex.props(styles.dock, styles.revert)}
    >
      <div>
        <p {...stylex.props(styles.dockTitle)}>Prompt reverted</p>
        <p {...stylex.props(styles.supporting)}>Restore it to edit and resubmit.</p>
      </div>
      <div {...stylex.props(styles.actions)}>
        <Button onClick={onDismiss} size="compact" variant="quiet">
          Dismiss
        </Button>
        <Button
          onClick={() => onRestore(reverted)}
          size="compact"
          variant="outline"
        >
          Edit prompt
        </Button>
      </div>
    </section>
  )
}

export type RequestRegionProps = {
  children: ReactNode
  onPermissionDecision: (request: PermissionRequestView, decision: PermissionDecision) => void
  onQuestionAnswer: (request: QuestionRequestView, response: QuestionResponse) => void
  onQuestionReject: (request: QuestionRequestView) => void
  permissionDecisions?: readonly PermissionDecision[]
  requests: readonly ChatRequest[]
  reverted?: ReactNode
  todos?: TodoListView
}

export function RequestRegion({
  children,
  onPermissionDecision,
  onQuestionAnswer,
  onQuestionReject,
  permissionDecisions,
  requests,
  reverted,
  todos,
}: RequestRegionProps) {
  const active = selectActiveRequest(requests)
  const regionRef = useRef<HTMLDivElement>(null)
  const previousRequest = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (active && active.id !== previousRequest.current) {
      const focusedComposer = document.activeElement?.closest('[data-slot="chat-composer"]')
      if (focusedComposer) {
        regionRef.current
          ?.querySelector<HTMLElement>('[data-request-heading]')
          ?.focus({ preventScroll: true })
      }
    }
    previousRequest.current = active?.id
  }, [active])

  return (
    <div ref={regionRef} data-slot="request-region" {...stylex.props(styles.region)}>
      {todos && <TodoDock todos={todos} />}
      {active?.type === 'permission' ? (
        <PermissionPrompt
          {...(permissionDecisions === undefined
            ? {}
            : { availableDecisions: permissionDecisions })}
          onDecision={(decision) => onPermissionDecision(active, decision)}
          request={active}
        />
      ) : active?.type === 'question' ? (
        <QuestionRequest
          key={active.id}
          onAnswer={(response) => onQuestionAnswer(active, response)}
          onReject={() => onQuestionReject(active)}
          request={active}
        />
      ) : reverted ? (
        reverted
      ) : (
        children
      )}
    </div>
  )
}

function permissionStatus(request: PermissionRequestView) {
  switch (request.state.status) {
    case 'pending':
      return 'Waiting for your decision.'
    case 'submitting':
      return `Submitting ${request.state.decision}.`
    case 'failed':
      return 'The decision was not sent.'
    case 'resolved':
      return request.state.decision === 'reject'
        ? 'Permission rejected.'
        : 'Permission allowed.'
    case 'expired':
      return 'This request expired.'
  }
}

function questionStatus(request: QuestionRequestView) {
  switch (request.state.status) {
    case 'pending':
      return 'Waiting for your answer.'
    case 'submitting':
      return 'Submitting your answer.'
    case 'failed':
      return 'The answer was not sent.'
    case 'resolved':
      return request.state.decision.type === 'reject'
        ? 'Question dismissed.'
        : 'Answer submitted.'
    case 'expired':
      return 'This question expired.'
  }
}

function consequenceLabel(value: PermissionRequestView['consequence']) {
  if (value === 'destructive') return 'This action may be destructive.'
  if (value === 'external') return 'This action affects an external system.'
  return 'This action can be reversed.'
}

function customKey(questionId: string) {
  return `${questionId}:custom`
}

function stringValue(value: string | readonly string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

function arrayValue(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value : []
}

const styles = stylex.create({
  region: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
  },
  request: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    inlineSize: '100%',
    overflow: 'hidden',
  },
  requestCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    padding: space.x4,
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.focus,
    },
    outlineOffset: '3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
  },
  origin: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  effect: {
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  supporting: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  requestFooter: {
    alignItems: {
      default: 'stretch',
      '@media (min-width: 40rem)': 'center',
    },
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: space.x3,
    justifyContent: 'space-between',
    paddingBlock: space.x3,
    paddingInline: space.x4,
  },
  status: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    paddingBlock: space.x2,
    paddingInline: space.x4,
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    justifyContent: 'flex-end',
  },
  questions: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x5,
    paddingBlockStart: space.x2,
  },
  choiceQuestion: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
  },
  fieldset: {
    borderWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    margin: 0,
    padding: 0,
  },
  legend: {
    fontSize: type.sizeBody,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    marginBlockEnd: space.x2,
  },
  dock: {
    borderBlockColor: colors.border,
    borderBlockStyle: 'solid',
    borderBlockWidth: '1px',
    color: colors.text,
    fontFamily: type.family,
    inlineSize: '100%',
  },
  todoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  todoItem: {
    color: colors.textMuted,
    display: 'grid',
    fontSize: type.sizeSmall,
    gap: space.x2,
    gridTemplateColumns: '1rem minmax(0, 1fr)',
    lineHeight: type.lineBody,
  },
  todoMark: {
    color: colors.textMuted,
    fontFamily: type.familyMono,
    textAlign: 'center',
  },
  revert: {
    alignItems: {
      default: 'stretch',
      '@media (min-width: 40rem)': 'center',
    },
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: space.x3,
    justifyContent: 'space-between',
    paddingBlock: space.x3,
  },
  dockTitle: {
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineBody,
    margin: 0,
  },
})
