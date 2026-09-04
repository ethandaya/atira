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
  motion,
  radii,
  shadows,
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
  VisuallyHidden,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { Check, Circle, CircleDot, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
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
  const [localSubmission, setLocalSubmission] = useState<{
    decision: PermissionDecision
    requestId: string
  }>()
  const localDecision =
    localSubmission?.requestId === request.id
      ? localSubmission.decision
      : undefined
  const pending = request.state.status === 'pending'
  const submitting =
    request.state.status === 'submitting' || localDecision !== undefined
  const failed = request.state.status === 'failed'
  const actionable = (pending || failed) && localDecision === undefined
  const activeDecision =
    'decision' in request.state ? request.state.decision : localDecision

  useEffect(() => {
    if (request.state.status === 'failed') setLocalSubmission(undefined)
  }, [request.id, request.state.status])

  function decide(decision: PermissionDecision) {
    if (!actionable) return
    setLocalSubmission({ decision, requestId: request.id })
    onDecision?.(decision)
  }

  return (
    <section
      aria-busy={submitting || undefined}
      aria-labelledby={titleId}
      data-consequence={request.consequence}
      data-origin-session-id={request.origin.sessionId}
      data-permission-id={request.id}
      data-slot="permission-prompt"
      data-state={request.state.status}
      {...stylex.props(styles.request, styles.permissionRequest)}
    >
      <div {...stylex.props(styles.requestCopy, styles.permissionCopy)}>
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

      <div {...stylex.props(styles.requestFooter, styles.permissionFooter)}>
        <VisuallyHidden role="status">
          {permissionStatus(request)}
        </VisuallyHidden>
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
                onClick={() => decide('reject')}
                size="compact"
                variant="quiet"
              >
                Reject
              </Button>
            )}
            {availableDecisions.includes('always') && (
              <Button
                aria-label="Always allow"
                disabled={submitting}
                focusableWhenDisabled={submitting && activeDecision === 'always'}
                onClick={() => decide('always')}
                size="compact"
                variant="outline"
              >
                Always
              </Button>
            )}
            {availableDecisions.includes('once') && (
              <Button
                aria-label="Allow once"
                disabled={submitting}
                focusableWhenDisabled={submitting && activeDecision === 'once'}
                onClick={() => decide('once')}
                size="compact"
                variant="primary"
              >
                Allow
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [submittingRequestId, setSubmittingRequestId] = useState<string>()
  const submittingLocally = submittingRequestId === request.id
  const submitting =
    request.state.status === 'submitting' || submittingLocally
  const actionable =
    (request.state.status === 'pending' || request.state.status === 'failed') &&
    !submittingLocally
  const activeQuestion = request.questions[questionIndex]
  const isLastQuestion = questionIndex >= request.questions.length - 1

  useEffect(() => {
    if (request.state.status === 'failed') setSubmittingRequestId(undefined)
  }, [request.id, request.state.status])

  function updateValue(
    key: string,
    value: string | readonly string[],
    errorKey = key,
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    if (errors[errorKey]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[errorKey]
        return next
      })
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actionable) return

    const questionsToValidate = isLastQuestion
      ? request.questions
      : activeQuestion
        ? [activeQuestion]
        : []
    const nextErrors = validateQuestionValues(questionsToValidate, values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstQuestion = request.questions.find(
        (question) => nextErrors[question.id],
      )
      if (firstQuestion) {
        const nextIndex = request.questions.indexOf(firstQuestion)
        if (nextIndex !== questionIndex) setQuestionIndex(nextIndex)
        focusQuestion(event.currentTarget, firstQuestion.id)
      }
      return
    }

    if (!isLastQuestion) {
      const nextIndex = questionIndex + 1
      const nextQuestion = request.questions[nextIndex]
      setErrors({})
      setQuestionIndex(nextIndex)
      if (nextQuestion) focusQuestion(event.currentTarget, nextQuestion.id)
      return
    }

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
    setSubmittingRequestId(request.id)
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
        <div {...stylex.props(styles.requestHeading)}>
          <div {...stylex.props(styles.requestHeadingCopy)}>
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
          </div>
          {request.questions.length > 1 && (
            <span
              aria-label={`Question ${questionIndex + 1} of ${request.questions.length}`}
              {...stylex.props(styles.questionProgress)}
            >
              {questionIndex + 1} / {request.questions.length}
            </span>
          )}
        </div>
        <div {...stylex.props(styles.questions)}>
          {activeQuestion && (
            <QuestionControl
              actionable={actionable}
              error={errors[activeQuestion.id]}
              question={activeQuestion}
              updateValue={updateValue}
              values={values}
            />
          )}
        </div>
      </div>

      {request.state.status === 'failed' && (
        <p role="alert" {...stylex.props(styles.error)}>
          {request.state.error.message}
        </p>
      )}

      <div {...stylex.props(styles.requestFooter)}>
        <VisuallyHidden role="status">
          {questionStatus(request)}
        </VisuallyHidden>
        {(actionable || submitting) && (
          <div {...stylex.props(styles.actions)}>
            {questionIndex > 0 && (
              <Button
                disabled={!actionable}
                onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
                size="compact"
                variant="quiet"
              >
                Back
              </Button>
            )}
            <Button
              disabled={!actionable}
              onClick={() => {
                if (!actionable) return
                setSubmittingRequestId(request.id)
                onReject?.()
              }}
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
              {isLastQuestion ? 'Submit answer' : 'Next'}
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}

function QuestionControl({
  actionable,
  error,
  question,
  updateValue,
  values,
}: {
  actionable: boolean
  error: string | undefined
  question: QuestionRequestView['questions'][number]
  updateValue: (
    key: string,
    value: string | readonly string[],
    errorKey?: string,
  ) => void
  values: Readonly<Record<string, string | readonly string[]>>
}) {
  if (question.type === 'text') {
    return (
      <div data-question-id={question.id}>
        <TextareaField
          description={error}
          disabled={!actionable}
          invalid={error !== undefined}
          label={question.label}
          maxLength={question.maxLength}
          onValueChange={(value) => updateValue(question.id, value)}
          required={question.required}
          rows={question.multiline ? 3 : 1}
          value={stringValue(values[question.id])}
        />
      </div>
    )
  }

  const selected = arrayValue(values[question.id])
  return (
    <div data-question-id={question.id} {...stylex.props(styles.choiceQuestion)}>
      {question.type === 'single-choice' ? (
        <RadioGroup
          disabled={!actionable}
          label={question.label}
          name={question.id}
          onValueChange={(value) => updateValue(question.id, [value])}
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
                updateValue(
                  question.id,
                  checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
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
            updateValue(customKey(question.id), value, question.id)
          }
          rows={1}
          value={stringValue(values[customKey(question.id)])}
        />
      )}
      {error && (
        <p role="alert" {...stylex.props(styles.fieldError)}>
          {error}
        </p>
      )}
    </div>
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
                  ? <Check size={16} strokeWidth={2} />
                  : item.state === 'in-progress'
                    ? <CircleDot size={16} strokeWidth={1.75} />
                    : item.state === 'cancelled'
                      ? <X size={16} strokeWidth={1.75} />
                      : <Circle size={16} strokeWidth={1.75} />}
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
  onRedo?: (reverted: RevertedPrompt) => void
  onRestore: (reverted: RevertedPrompt) => void
  reverted: RevertedPrompt
}

export function RevertDock({
  onDismiss,
  onRedo,
  onRestore,
  reverted,
}: RevertDockProps) {
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
        {onRedo && (
          <Button
            onClick={() => onRedo(reverted)}
            size="compact"
            variant="quiet"
          >
            Redo
          </Button>
        )}
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

export type QuestionAnswerSummaryProps = {
  request: QuestionRequestView
}

export function QuestionAnswerSummary({ request }: QuestionAnswerSummaryProps) {
  if (
    request.state.status !== 'resolved' ||
    request.state.decision.type !== 'answer'
  ) {
    return null
  }

  const answers = new Map(
    request.state.decision.response.answers.map((answer) => [
      answer.questionId,
      answer,
    ]),
  )

  return (
    <section
      aria-label="Submitted answers"
      data-question-request-id={request.id}
      data-slot="question-answer-summary"
      {...stylex.props(styles.answerSummary)}
    >
      <p {...stylex.props(styles.dockTitle)}>Answers submitted</p>
      <dl {...stylex.props(styles.answerList)}>
        {request.questions.map((question) => {
          const answer = answers.get(question.id)
          if (!answer) return null
          return (
            <div key={question.id} {...stylex.props(styles.answerItem)}>
              <dt {...stylex.props(styles.answerLabel)}>{question.label}</dt>
              <dd {...stylex.props(styles.answerValue)}>
                {questionAnswerLabel(question, answer)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

export type RequestRegionProps = {
  children: ReactNode
  draftRevision?: number
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
  draftRevision,
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
  const capturedRevision = useRef<number | undefined>(undefined)
  const restoreComposerFocus = useRef(false)
  const focusOwner = useRef<'composer' | 'request' | undefined>(undefined)

  useLayoutEffect(() => {
    const region = regionRef.current
    const previous = previousRequest.current

    if (active && active.id !== previousRequest.current) {
      const focusedComposer = document.activeElement?.closest(
        '[data-slot="chat-composer"]',
      )
      const focusedRequest = document.activeElement?.closest(
        '[data-slot="permission-prompt"], [data-slot="question-request"]',
      )
      if (!previous && (focusedComposer || focusOwner.current === 'composer')) {
        capturedRevision.current = draftRevision
        restoreComposerFocus.current = true
      }
      if (
        focusedComposer ||
        focusedRequest ||
        focusOwner.current === 'composer' ||
        focusOwner.current === 'request'
      ) {
        region
          ?.querySelector<HTMLElement>('[data-request-heading]')
          ?.focus({ preventScroll: true })
      }
    }

    if (!active && previous) {
      const revisionUnchanged =
        capturedRevision.current === undefined ||
        draftRevision === capturedRevision.current
      if (
        restoreComposerFocus.current &&
        focusOwner.current === 'request' &&
        revisionUnchanged
      ) {
        region
          ?.querySelector<HTMLTextAreaElement>(
            '[data-slot="chat-composer"] textarea',
          )
          ?.focus({ preventScroll: true })
      }
      restoreComposerFocus.current = false
      capturedRevision.current = undefined
    }

    previousRequest.current = active?.id
  }, [active, draftRevision])

  return (
    <div
      ref={regionRef}
      data-slot="request-region"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focusOwner.current = undefined
        }
      }}
      onFocusCapture={(event) => {
        focusOwner.current = event.target.closest('[data-slot="chat-composer"]')
          ? 'composer'
          : 'request'
      }}
      {...stylex.props(styles.region)}
    >
      {todos && <TodoDock todos={todos} />}
      {active ? (
        <div data-slot="request-stage" {...stylex.props(styles.requestStage)}>
          <div aria-hidden="true" inert {...stylex.props(styles.reservedComposer)}>
            {children}
          </div>
          <div data-slot="active-request-layer" {...stylex.props(styles.requestLayer)}>
            {active.type === 'permission' ? (
              <PermissionPrompt
                key={active.id}
                {...(permissionDecisions === undefined
                  ? {}
                  : { availableDecisions: permissionDecisions })}
                onDecision={(decision) => onPermissionDecision(active, decision)}
                request={active}
              />
            ) : (
              <QuestionRequest
                key={active.id}
                onAnswer={(response) => onQuestionAnswer(active, response)}
                onReject={() => onQuestionReject(active)}
                request={active}
              />
            )}
          </div>
        </div>
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

function validateQuestionValues(
  questions: QuestionRequestView['questions'],
  values: Readonly<Record<string, string | readonly string[]>>,
) {
  const errors: Record<string, string> = {}
  for (const question of questions) {
    if (!question.required) continue
    if (question.type === 'text') {
      if (!stringValue(values[question.id]).trim()) {
        errors[question.id] = 'Enter an answer.'
      }
      continue
    }
    const hasChoice = arrayValue(values[question.id]).length > 0
    const hasCustom =
      question.allowCustom &&
      stringValue(values[customKey(question.id)]).trim().length > 0
    if (!hasChoice && !hasCustom) {
      errors[question.id] = 'Choose at least one answer.'
    }
  }
  return errors
}

function focusQuestion(form: HTMLFormElement, questionId: string) {
  function focus() {
    const field = Array.from(
      form.querySelectorAll<HTMLElement>('[data-question-id]'),
    ).find((element) => element.dataset.questionId === questionId)
    const control = field?.querySelector<HTMLElement>(
      'textarea, [role="radio"], [role="checkbox"]',
    )
    control?.focus()
    return control !== undefined && control !== null
  }

  if (!focus()) requestAnimationFrame(focus)
}

function questionAnswerLabel(
  question: QuestionRequestView['questions'][number],
  answer: QuestionAnswer,
) {
  if (question.type === 'text') {
    return answer.type === 'text' ? answer.value : 'No answer'
  }
  if (answer.type !== 'choice') return 'No answer'

  const labels = answer.optionIds.map(
    (optionId) =>
      question.options.find((option) => option.id === optionId)?.label ?? optionId,
  )
  if (answer.customValue) labels.push(answer.customValue)
  return labels.join(', ') || 'No answer'
}

const requestEnter = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(0.25rem) scale(0.995)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
})

const styles = stylex.create({
  region: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    inlineSize: '100%',
  },
  requestStage: {
    inlineSize: '100%',
    position: 'relative',
  },
  reservedComposer: {
    pointerEvents: 'none',
    userSelect: 'none',
    visibility: 'hidden',
  },
  requestLayer: {
    insetBlockEnd: 0,
    insetInline: 0,
    maxBlockSize: 'min(70dvh, 32rem)',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    position: 'absolute',
    zIndex: 1,
  },
  request: {
    animationDuration: {
      default: motion.durationEnter,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    animationName: {
      default: requestEnter,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationTimingFunction: motion.easingEnter,
    backgroundColor: colors.surfaceRaised,
    borderColor: 'transparent',
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: shadows.raised,
    boxSizing: 'border-box',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    gap: space.x2,
    inlineSize: '100%',
    padding: {
      default: space.x3,
      '@media (min-width: 40rem)': space.x4,
    },
  },
  permissionRequest: {
    '@media (min-width: 40rem)': {
      alignItems: 'center',
      columnGap: space.x4,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
    },
  },
  requestCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  requestHeading: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: space.x4,
    justifyContent: 'space-between',
  },
  requestHeadingCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    minInlineSize: 0,
  },
  permissionCopy: {
    '@media (min-width: 40rem)': {
      gridColumn: 1,
      gridRow: 1,
    },
  },
  title: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
    outline: 'none',
  },
  origin: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  effect: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.inset,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    marginBlock: space.x1,
    overflowWrap: 'anywhere',
    paddingBlock: space.x2,
    paddingInline: space.x3,
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
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 40rem)': 'row',
    },
    gap: space.x2,
    justifyContent: 'space-between',
  },
  permissionFooter: {
    '@media (min-width: 40rem)': {
      gridColumn: 2,
      gridRow: 1,
    },
  },
  error: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    '@media (min-width: 40rem)': {
      gridColumn: '1 / -1',
    },
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
    justifyContent: 'flex-end',
  },
  questionProgress: {
    color: colors.textMuted,
    flexShrink: 0,
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: type.lineCompact,
  },
  questions: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    paddingBlockStart: space.x3,
  },
  choiceQuestion: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
  },
  answerSummary: {
    borderBlockColor: colors.border,
    borderBlockStyle: 'solid',
    borderBlockWidth: '1px',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    gap: space.x2,
    inlineSize: '100%',
    paddingBlock: space.x3,
  },
  answerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
    margin: 0,
  },
  answerItem: {
    display: 'grid',
    gap: space.x1,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 40rem)': 'minmax(8rem, 0.35fr) minmax(0, 1fr)',
    },
  },
  answerLabel: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
  },
  answerValue: {
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  fieldError: {
    color: colors.danger,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
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
    blockSize: '1rem',
    color: colors.textMuted,
    display: 'inline-flex',
    inlineSize: '1rem',
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
