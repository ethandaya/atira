import {
  Action,
  Actions,
  ActivityList,
  ActivitySummary,
  Artifact,
  CitationList,
  ChatComposer,
  CodeBlock,
  Composer,
  Diff,
  InlineCitation,
  Loader,
  Markdown,
  Message,
  Outcome,
  PermissionPrompt,
  PermissionRequest,
  Plan,
  PromptHistory,
  Reasoning,
  Response,
  QuestionRequest,
  QueueList,
  RevertDock,
  Suggestion,
  Suggestions,
  TaskTool,
  Thread,
  TodoDock,
  ToolActivity,
  Turn,
  type PermissionRequestState,
} from '@atira/components'
import type {
  ChatCapabilities,
  ChatTurn,
  ComposerDraft,
  PermissionRequestView,
  QuestionRequestView,
  QueuedPrompt,
  RevertedPrompt,
  TodoListView,
  ToolPart,
} from '@atira/foundations/chat'
import { colors, radii, space, type } from '@atira/foundations/tokens.stylex'
import {
  Button,
  ComposerField,
  Dialog,
  Disclosure,
  IconButton,
  Progress,
  Shimmer,
  Spinner,
  Status,
  TextField,
  VisuallyHidden,
} from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'
import {
  Copy as CopyIcon,
  Minus as MinusIcon,
  Plus as PlusIcon,
  RotateCcw as RetryIcon,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function ComponentGallery() {
  return (
    <section aria-label="Component gallery">
      <nav
        aria-label="Component categories"
        {...stylex.props(styles.categoryNav)}
      >
        <div {...stylex.props(styles.categoryNavInner)}>
          <a href="#gallery-primitives" {...stylex.props(styles.categoryLink)}>
            Foundations
          </a>
          <a
            href="#gallery-conversation"
            {...stylex.props(styles.categoryLink)}
          >
            Conversation
          </a>
          <a href="#gallery-agents" {...stylex.props(styles.categoryLink)}>
            Agent workflows
          </a>
          <a
            href="#gallery-compositions"
            {...stylex.props(styles.categoryLink)}
          >
            Full compositions
          </a>
          <a href="#gallery-output" {...stylex.props(styles.categoryLink)}>
            Structured output
          </a>
        </div>
      </nav>
      <div {...stylex.props(styles.content)}>
        <section
          aria-labelledby="library-heading"
          {...stylex.props(styles.introduction)}
        >
          <h1 id="library-heading" {...stylex.props(styles.libraryTitle)}>
            Build agent interfaces with React and StyleX.
          </h1>
          <p {...stylex.props(styles.libraryDescription)}>
            Composable controls, streaming responses, and agent workflows. You
            own the runtime; Atira handles the interface.
          </p>
          <p {...stylex.props(styles.groupDescription)}>
            Explore working examples below, or{' '}
            <a href="/?view=playground" {...stylex.props(styles.inlineLink)}>
              try the live playground
            </a>{' '}
            with your configured runtime. Component examples work without
            provider credentials.
          </p>
        </section>
        <FoundationExamples />
        <ConversationExamples />
        <AgentExamples />
        <SessionExamples />
        <OutputExamples />
      </div>
    </section>
  )
}

function FoundationExamples() {
  const [textFieldValue, setTextFieldValue] = useState('')
  const [composerFieldValue, setComposerFieldValue] = useState('')
  const [buttonResult, setButtonResult] = useState('No button pressed.')
  const [iconButtonResult, setIconButtonResult] = useState(
    'No icon button pressed.',
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogResult, setDialogResult] = useState(
    'Dialog has not been opened.',
  )

  return (
    <section
      aria-labelledby="primitives-heading"
      id="gallery-primitives"
      {...stylex.props(styles.group)}
    >
      <GroupHeading
        id="primitives-heading"
        title="Foundations and primitives"
        description="Owned React primitives with Base UI behavior and StyleX styling."
      />

      <div {...stylex.props(styles.grid)}>
        <ComponentSample
          title="Button"
          description="Visual hierarchy, disabled behavior, focus, and touch sizing."
        >
          <div {...stylex.props(styles.controls)}>
            {(
              [
                ['Primary', 'primary'],
                ['Secondary', 'secondary'],
                ['Outline', 'outline'],
                ['Quiet', 'quiet'],
                ['Danger', 'danger'],
              ] as const
            ).map(([label, variant]) => (
              <Button
                key={variant}
                onClick={() => setButtonResult(`${label} button pressed.`)}
                variant={variant}
              >
                {label}
              </Button>
            ))}
          </div>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {buttonResult}
          </p>
        </ComponentSample>

        <ComponentSample
          title="IconButton"
          description="A square button with a required accessible label."
        >
          <div {...stylex.props(styles.controls)}>
            <IconButton
              aria-label="Add item"
              onClick={() => setIconButtonResult('Add item pressed.')}
            >
              <PlusIcon size={20} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              aria-label="Remove item"
              onClick={() => setIconButtonResult('Remove item pressed.')}
              variant="outline"
            >
              <MinusIcon size={20} strokeWidth={1.75} />
            </IconButton>
          </div>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {iconButtonResult}
          </p>
        </ComponentSample>

        <ComponentSample
          title="TextField"
          description="A labeled, controlled single-line field."
        >
          <TextField
            description="The label and description remain associated with the control."
            label="Component name"
            onValueChange={setTextFieldValue}
            placeholder="Message"
            value={textFieldValue}
          />
        </ComponentSample>

        <ComponentSample
          title="ComposerField"
          description="A multiline field with mobile-safe text sizing."
        >
          <ComposerField
            description="The label and description remain associated with the control."
            label="Instruction"
            onValueChange={setComposerFieldValue}
            placeholder="Describe the change…"
            rows={3}
            value={composerFieldValue}
          />
        </ComponentSample>

        <ComponentSample
          title="Disclosure"
          description="Keyboard-accessible progressive disclosure."
        >
          <div {...stylex.props(styles.borderedPreview)}>
            <Disclosure summary="Implementation details">
              State and relationships remain explicit while secondary evidence
              stays out of the primary reading flow.
            </Disclosure>
          </div>
        </ComponentSample>

        <ComponentSample
          title="Dialog"
          description="A modal surface with focus management and Escape handling."
        >
          <Dialog
            actions={
              <Button
                onClick={() => {
                  setDialogResult('Dialog action confirmed.')
                  setDialogOpen(false)
                }}
                size="compact"
                variant="primary"
              >
                Confirm
              </Button>
            }
            description="Focus stays inside this dialog until it closes."
            headingLevel={4}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (open) setDialogResult('Dialog opened.')
            }}
            open={dialogOpen}
            title="Review component behavior"
            trigger="Open dialog"
          >
            <p {...stylex.props(styles.note)}>
              Press Escape or use Close to return focus to the trigger.
            </p>
          </Dialog>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {dialogResult}
          </p>
        </ComponentSample>

        <ComponentSample
          title="Status"
          description="Compact semantic state text with neutral and danger tones."
        >
          <div {...stylex.props(styles.controls)}>
            <Status>Ready</Status>
            <Status tone="danger">Failed</Status>
          </div>
        </ComponentSample>

        <ComponentSample
          title="Progress"
          description="Determinate and indeterminate progress with reduced motion."
        >
          <div {...stylex.props(styles.stack)}>
            <Progress label="Indexing files" value={64} valueLabel="64%" />
            <Progress
              label="Preparing preview"
              value={null}
              valueLabel="Working"
            />
          </div>
        </ComponentSample>

        <ComponentSample
          title="Spinner"
          description="A radial activity mark that becomes static under reduced motion."
        >
          <div {...stylex.props(styles.controls)}>
            <Spinner aria-label="Small loading indicator" size="small" />
            <Spinner aria-label="Regular loading indicator" />
            <Spinner aria-label="Large loading indicator" size="large" />
          </div>
        </ComponentSample>

        <ComponentSample
          title="Shimmer"
          description="Text-level streaming feedback with a readable static fallback."
        >
          <p {...stylex.props(styles.note)}>
            <Shimmer>Preparing the response…</Shimmer>
          </p>
        </ComponentSample>

        <ComponentSample
          title="VisuallyHidden"
          description="Adds screen-reader copy without changing visual layout."
        >
          <p {...stylex.props(styles.note)}>
            This helper has no visible output.
            <VisuallyHidden>
              VisuallyHidden is mounted after the visible sentence.
            </VisuallyHidden>
          </p>
        </ComponentSample>
      </div>
    </section>
  )
}

const exampleResponse =
  'Components own accessible presentation and named actions; adapters own runtime behavior.'

function ConversationExamples() {
  const [composerValue, setComposerValue] = useState('')
  const [composerResult, setComposerResult] = useState('No message submitted.')
  const [actionResult, setActionResult] = useState(
    'No message action selected.',
  )
  const [suggestionResult, setSuggestionResult] = useState(
    'No suggestion selected.',
  )

  function submitComposer(value: string) {
    setComposerResult(`Submitted: ${value}`)
    setComposerValue('')
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(exampleResponse)
      setActionResult('Response copied.')
    } catch {
      setActionResult(
        'Could not copy the response. Select the text to copy it manually.',
      )
    }
  }

  return (
    <section
      aria-labelledby="conversation-heading"
      id="gallery-conversation"
      {...stylex.props(styles.group)}
    >
      <GroupHeading
        id="conversation-heading"
        title="Conversation"
        description="Controlled conversation anatomy without runtime ownership."
      />

      <div {...stylex.props(styles.grid)}>
        <ComponentSample
          title="Thread"
          description="A semantic message list with an explicit empty state."
        >
          <Thread label="Empty thread preview" empty="No messages yet." />
        </ComponentSample>

        <ComponentSample
          title="Message + Response"
          description="Actor-aware message alignment and response lifecycle."
        >
          <Thread label="Message and response preview">
            <Message actor="user">Summarize the component boundary.</Message>
            <Message actor="assistant">
              <Response status="complete">{exampleResponse}</Response>
            </Message>
            <Message actor="system">
              Runtime state remains outside the component layer.
            </Message>
          </Thread>
        </ComponentSample>

        <ComponentSample
          title="Markdown"
          description="Streaming-safe GFM with source-owned StyleX renderers."
          wide
        >
          <Markdown status="complete">{`## Response structure

- Semantic headings and lists
- Safe [external links](https://stylexjs.com/)
- Inline \`code\` and fenced code

\`\`\`tsx
<Response status="streaming">...</Response>
\`\`\`

| State | Meaning |
| --- | --- |
| streaming | More content is expected |
| complete | The response is final |`}</Markdown>
        </ComponentSample>

        <ComponentSample
          title="Loader"
          description="Named pending, streaming, and complete states—not motion alone."
        >
          <div {...stylex.props(styles.stack)}>
            <Loader state={{ status: 'pending' }} />
            <Loader
              label="Writing component styles"
              state={{ status: 'streaming' }}
            />
            <Loader state={{ status: 'complete' }} />
          </div>
        </ComponentSample>

        <ComponentSample
          title="Reasoning"
          description="Controlled disclosure for active and completed reasoning."
        >
          <div {...stylex.props(styles.stack)}>
            <Reasoning state={{ status: 'thinking' }}>
              Comparing the requested behavior with the existing component
              contracts.
            </Reasoning>
            <Reasoning
              defaultOpen
              state={{ duration: '8 seconds', status: 'complete' }}
            >
              The loading layer belongs below protocol adapters and above visual
              primitives.
            </Reasoning>
          </div>
        </ComponentSample>

        <ComponentSample
          title="Actions"
          description="A labelled toolbar of compact, named message actions."
        >
          <Actions>
            <Action label="Copy response" onClick={copyResponse}>
              <CopyIcon size={16} strokeWidth={1.75} />
            </Action>
            <Action
              label="Regenerate response"
              onClick={() => setActionResult('Regenerate requested.')}
            >
              <RetryIcon size={16} strokeWidth={1.75} />
            </Action>
          </Actions>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {actionResult}
          </p>
        </ComponentSample>

        <ComponentSample
          title="Suggestions"
          description="Horizontally scrollable prompts with a semantic select event."
          wide
        >
          <Suggestions>
            {[
              'Make it more concise',
              'Show the component API',
              'Explain the accessibility behavior',
            ].map((suggestion) => (
              <Suggestion
                key={suggestion}
                onSelect={(value) => setSuggestionResult(`Selected: ${value}`)}
                value={suggestion}
              />
            ))}
          </Suggestions>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {suggestionResult}
          </p>
        </ComponentSample>

        <ComponentSample
          title="InlineCitation"
          description="Compact in-flow provenance with explicit link availability."
        >
          <p {...stylex.props(styles.note)}>
            StyleX provides static, typed styles with runtime theme variables
            <InlineCitation
              citation={{
                href: 'https://linear.app/now/styling-linear-for-the-future-stylex',
                id: 'gallery-inline-linear',
                source: 'Linear',
                title: 'Styling Linear for the future',
              }}
            />
            .
          </p>
        </ComponentSample>

        <ComponentSample
          title="Composer"
          description="Controlled multiline input with explicit submit behavior."
          wide
        >
          <Composer
            onSubmit={submitComposer}
            onValueChange={setComposerValue}
            value={composerValue}
          />
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {composerResult}
          </p>
        </ComponentSample>
      </div>
    </section>
  )
}

function AgentExamples() {
  const [activityListOpen, setActivityListOpen] = useState(true)
  const [permissionState, setPermissionState] =
    useState<PermissionRequestState>({ status: 'pending' })

  return (
    <section
      aria-labelledby="agent-heading"
      id="gallery-agents"
      {...stylex.props(styles.group)}
    >
      <GroupHeading
        id="agent-heading"
        title="Agent workflows"
        description="Legible progress, tool evidence, permission, and outcomes."
      />

      <div {...stylex.props(styles.grid)}>
        <ComponentSample
          title="ActivitySummary"
          description="Stable identifiers and named progress states."
        >
          <div {...stylex.props(styles.stack)}>
            <ActivitySummary
              id="gallery-running"
              label="Reading component sources"
              state={{ status: 'running' }}
            />
            <ActivitySummary
              detail="Waiting for a decision before writing files."
              id="gallery-waiting"
              label="Preparing changes"
              state={{ status: 'waiting' }}
            />
            <ActivitySummary
              id="gallery-failed"
              label="Production build"
              state={{ status: 'failed' }}
            />
          </div>
        </ComponentSample>

        <ComponentSample
          title="ToolActivity"
          description="Collapsible evidence with explicit tool and status metadata."
        >
          <ToolActivity
            defaultOpen
            id="gallery-tool"
            state={{ status: 'succeeded' }}
            summary="Registry updated"
            tool="write_file"
          >
            <code {...stylex.props(styles.code)}>2 files changed</code>
          </ToolActivity>
        </ComponentSample>

        <ComponentSample
          title="TaskTool"
          description="Delegated work with agent identity, child provenance, and terminal state."
        >
          <div {...stylex.props(styles.stack)}>
            <TaskTool part={galleryRunningSubagent} />
            <TaskTool defaultOpen part={galleryCompletedSubagent} />
          </div>
        </ComponentSample>

        <ComponentSample
          title="ActivityList"
          description="A controlled chronological disclosure for tool evidence."
        >
          <ActivityList
            id="gallery-activity-list"
            label="Recent activity"
            mode="disclosed"
            onOpenChange={setActivityListOpen}
            open={activityListOpen}
          >
            <ActivitySummary
              id="gallery-list-read"
              label="Read component contracts"
              state={{ status: 'succeeded' }}
            />
            <ToolActivity
              id="gallery-list-build"
              state={{ status: 'running' }}
              summary="Building the demo"
              tool="pnpm"
            />
          </ActivityList>
        </ComponentSample>

        <ComponentSample
          title="PermissionRequest"
          description="A controlled approval boundary with focus-safe resolution."
          wide
        >
          {permissionState.status === 'pending' ? (
            <PermissionRequest
              consequence="external"
              effect="Create a draft issue in the connected project."
              headingLevel={4}
              id="gallery-permission"
              onApprove={() =>
                setPermissionState({
                  status: 'resolved',
                  decision: 'approved',
                })
              }
              onReject={() =>
                setPermissionState({
                  status: 'resolved',
                  decision: 'rejected',
                })
              }
              state={permissionState}
              title="Allow this external action?"
            />
          ) : (
            <>
              <PermissionRequest
                consequence="external"
                effect="Create a draft issue in the connected project."
                headingLevel={4}
                id="gallery-permission"
                state={permissionState}
                title="Allow this external action?"
              />
              <div {...stylex.props(styles.resetAction)}>
                <Button
                  onClick={() => setPermissionState({ status: 'pending' })}
                  size="compact"
                  variant="quiet"
                >
                  Reset example
                </Button>
              </div>
            </>
          )}
        </ComponentSample>

        <ComponentSample
          title="Outcome"
          description="Terminal work states with reviewable supporting detail."
          wide
        >
          <div {...stylex.props(styles.stack)}>
            <Outcome
              headingLevel={4}
              id="gallery-reviewable"
              state={{ status: 'reviewable' }}
              title="Components ready for review"
            >
              Typechecking and the production build completed successfully.
            </Outcome>
            <Outcome
              headingLevel={4}
              id="gallery-failed-outcome"
              state={{ status: 'failed' }}
              title="Build failed"
            >
              Resolve the reported type error, then run the check again.
            </Outcome>
          </div>
        </ComponentSample>
      </div>
    </section>
  )
}

function SessionExamples() {
  const [chatDraft, setChatDraft] = useState<ComposerDraft>(galleryDraft)
  const [queuedPrompts, setQueuedPrompts] =
    useState<readonly QueuedPrompt[]>(galleryQueue)
  const [chatResult, setChatResult] = useState('No chat action selected.')

  return (
    <section
      aria-labelledby="chat-heading"
      id="gallery-compositions"
      {...stylex.props(styles.group)}
    >
      <GroupHeading
        id="chat-heading"
        title="Full compositions"
        description="Protocol-neutral turn rendering, requests, session state, and structured input."
      />

      <div {...stylex.props(styles.grid)}>
        <ComponentSample
          title="Turn and message parts"
          description="One semantic turn with grouped context, specialized tools, reasoning, and Markdown."
          wide
        >
          <ol {...stylex.props(styles.turnPreview)}>
            <Turn turn={galleryTurn} />
          </ol>
        </ComponentSample>

        <ComponentSample
          title="PermissionPrompt"
          description="Exact once, always, and reject decisions with visible consequences."
          wide
        >
          <PermissionPrompt
            onDecision={(decision) =>
              setChatResult(`Permission decision: ${decision}`)
            }
            request={galleryPermission}
          />
        </ComponentSample>

        <ComponentSample
          title="QuestionRequest"
          description="Stable question and option IDs across choice and freeform answers."
          wide
        >
          <QuestionRequest
            onAnswer={(response) =>
              setChatResult(`Submitted ${response.answers.length} answers.`)
            }
            onReject={() => setChatResult('Question dismissed.')}
            request={galleryQuestion}
          />
        </ComponentSample>

        <ComponentSample
          title="TodoDock and RevertDock"
          description="Canonical session tasks and a recoverable reverted prompt."
          wide
        >
          <div {...stylex.props(styles.stack)}>
            <TodoDock defaultOpen todos={galleryTodos} />
            <RevertDock
              onDismiss={() => setChatResult('Reverted prompt dismissed.')}
              onRestore={(reverted) => {
                setChatDraft(reverted.draft)
                setChatResult('Reverted prompt restored to the composer.')
              }}
              reverted={galleryRevert}
            />
          </div>
        </ComponentSample>

        <ComponentSample
          title="QueueList"
          description="Queued and failed follow-ups remain editable and removable."
          wide
        >
          <QueueList
            items={queuedPrompts}
            onEdit={(item) => {
              setChatDraft(item.draft)
              setQueuedPrompts((items) =>
                items.filter((queued) => queued.id !== item.id),
              )
              setChatResult('Queued prompt restored for editing.')
            }}
            onRemove={(item) =>
              setQueuedPrompts((items) =>
                items.filter((queued) => queued.id !== item.id),
              )
            }
            onRetry={(item) =>
              setQueuedPrompts((items) =>
                items.map((queued) =>
                  queued.id === item.id
                    ? { id: queued.id, draft: queued.draft, state: 'queued' }
                    : queued,
                ),
              )
            }
          />
        </ComponentSample>

        <ComponentSample
          title="ChatComposer"
          description="Controlled structured draft with busy submission and shell capabilities."
          wide
        >
          <ChatComposer
            accept="image/*,.txt,.md"
            actions={
              <PromptHistory
                items={galleryPromptHistory}
                onRestore={(item) => {
                  setChatDraft({
                    ...item.draft,
                    revision: chatDraft.revision + 1,
                  })
                  setChatResult('Historical prompt restored.')
                }}
              />
            }
            activity={{ status: 'busy', turnId: galleryTurn.id }}
            capabilities={galleryCapabilities}
            commands={galleryCommands}
            draft={chatDraft}
            onDraftChange={setChatDraft}
            onFilesAdd={(files, source) => {
              setChatDraft((current) => ({
                ...current,
                attachments: [
                  ...current.attachments,
                  ...files.map((file) => ({
                    attachment: {
                      id: crypto.randomUUID(),
                      kind: file.type.startsWith('image/')
                        ? ('image' as const)
                        : ('file' as const),
                      mediaType: file.type,
                      name: file.name,
                      size: file.size,
                    },
                    sourceId: file.name,
                    state: 'ready' as const,
                  })),
                ],
                revision: current.revision + 1,
              }))
              setChatResult(`${files.length} attachment added by ${source}.`)
            }}
            onRemoveAttachment={(attachment) =>
              setChatDraft((current) => ({
                ...current,
                attachments: current.attachments.filter(
                  (item) => item.attachment.id !== attachment.attachment.id,
                ),
                revision: current.revision + 1,
              }))
            }
            onRemoveReference={(reference) =>
              setChatDraft((current) => ({
                ...current,
                revision: current.revision + 1,
                segments: current.segments.filter(
                  (segment) => segment.id !== reference.id,
                ),
              }))
            }
            onStop={() => setChatResult('Stop requested.')}
            onSubmit={(_draft, intent) =>
              setChatResult(`Composer intent: ${intent}`)
            }
            references={galleryReferences}
          />
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {chatResult}
          </p>
        </ComponentSample>
      </div>
    </section>
  )
}

function OutputExamples() {
  const [artifactResult, setArtifactResult] = useState('No artifact opened.')

  return (
    <section
      aria-labelledby="output-heading"
      id="gallery-output"
      {...stylex.props(styles.group)}
    >
      <GroupHeading
        id="output-heading"
        title="Structured output"
        description="Typed plans, code, changes, provenance, and generated artifacts."
      />

      <div {...stylex.props(styles.grid)}>
        <ComponentSample
          title="Plan"
          description="Ordered work with explicit plan and step states."
          wide
        >
          <Plan
            headingLevel={4}
            id="gallery-plan"
            status="active"
            steps={[
              {
                detail: 'Mapped to the canonical catalog.',
                id: 'gallery-plan-contracts',
                status: 'complete',
                title: 'Define component contracts',
              },
              {
                detail: 'Translating the neutral baseline into StyleX.',
                id: 'gallery-plan-styles',
                status: 'active',
                title: 'Implement accessible components',
              },
              {
                id: 'gallery-plan-review',
                status: 'queued',
                title: 'Review representative states',
              },
            ]}
            title="Component parity"
          />
        </ComponentSample>

        <ComponentSample
          title="CodeBlock"
          description="Geist Mono code with wrapping, scrolling, and copy feedback."
          wide
        >
          <CodeBlock
            code={`export function ActivitySummary(props: ActivityProps) {\n  return <Activity {...props} />\n}\n\nconst componentBoundary = 'presentation remains protocol-neutral and runtime state stays outside the component';`}
            filename="activity-summary.tsx"
            language="tsx"
          />
        </ComponentSample>

        <ComponentSample
          title="Diff"
          description="Structured files, hunks, and lines with accessible labels."
          wide
        >
          <Diff
            files={[
              {
                additions: 2,
                deletions: 1,
                hunks: [
                  {
                    header: '@@ -18,3 +18,4 @@ export function Composer',
                    id: 'gallery-diff-hunk-composer',
                    lines: [
                      {
                        content: '  const canSubmit = value.trim().length > 0',
                        id: 'gallery-diff-context-1',
                        kind: 'context',
                        newLine: 18,
                        oldLine: 18,
                      },
                      {
                        content: '  const submitLabel = "Send"',
                        id: 'gallery-diff-deletion-1',
                        kind: 'deletion',
                        oldLine: 19,
                      },
                      {
                        content:
                          '  const submitLabel = status === "submitting" ? "Sending…" : "Send"',
                        id: 'gallery-diff-addition-1',
                        kind: 'addition',
                        newLine: 19,
                      },
                      {
                        content:
                          '  const submitDisabled = !canSubmit || status === "submitting"',
                        id: 'gallery-diff-addition-2',
                        kind: 'addition',
                        newLine: 20,
                      },
                    ],
                  },
                ],
                id: 'gallery-diff-composer',
                path: 'packages/components/src/composer.tsx',
                status: 'modified',
              },
              {
                additions: 24,
                defaultOpen: false,
                deletions: 0,
                hunks: [],
                id: 'gallery-diff-manifest',
                path: 'packages/components/src/composer.manifest.ts',
                status: 'added',
              },
            ]}
            headingLevel={4}
            id="gallery-diff"
            title="Composer changes"
          />
        </ComponentSample>

        <ComponentSample
          title="CitationList"
          description="Source provenance with valid, unavailable, and invalid links."
        >
          <CitationList
            citations={[
              {
                description:
                  'Why Linear adopted StyleX for long-lived product UI.',
                href: 'https://linear.app/now/styling-linear-for-the-future-stylex',
                id: 'gallery-citation-linear',
                source: 'Linear',
                title: 'Styling Linear for the future',
              },
              {
                id: 'gallery-citation-notes',
                source: 'Research notes',
                title: 'Internal component boundary notes',
              },
              {
                href: 'ftp://example.com/component-notes',
                id: 'gallery-citation-invalid',
                title: 'Unsupported source URL',
              },
            ]}
            headingLevel={4}
            id="gallery-citations"
          />
        </ComponentSample>

        <ComponentSample
          title="Artifact"
          description="Protocol-neutral references with explicit availability and actions."
        >
          <div {...stylex.props(styles.stack)}>
            <Artifact
              description="A visual review capture from the component gallery."
              headingLevel={4}
              id="gallery-artifact-ready"
              kind="image"
              metadata={[
                { id: 'format', label: 'Format', value: 'PNG' },
                { id: 'size', label: 'Size', value: '1440×900' },
              ]}
              onOpen={() =>
                setArtifactResult('Open requested for component-gallery.png.')
              }
              state={{ status: 'ready' }}
              title="component-gallery.png"
            />
            <Artifact
              description="The runtime owns generation progress."
              headingLevel={4}
              id="gallery-artifact-generating"
              kind="result"
              state={{ status: 'generating' }}
              title="Accessibility report"
            />
          </div>
          <p role="status" {...stylex.props(styles.sampleStatus)}>
            {artifactResult}
          </p>
        </ComponentSample>
      </div>
    </section>
  )
}

const galleryDraft: ComposerDraft = {
  agent: { id: 'build', label: 'Build' },
  attachments: [],
  mode: 'prompt',
  model: { label: 'Nanocodex', modelId: 'nanocodex', providerId: 'nanocodex' },
  revision: 0,
  segments: [
    {
      id: 'gallery-draft-text',
      text: 'Continue the interface audit.',
      type: 'text',
    },
  ],
  selection: {
    anchor: { offset: 29, segmentId: 'gallery-draft-text' },
    focus: { offset: 29, segmentId: 'gallery-draft-text' },
  },
}

const galleryCapabilities: ChatCapabilities = {
  agents: [
    { id: 'build', label: 'Build' },
    { id: 'plan', label: 'Plan' },
  ],
  busySubmission: ['queue'],
  canAttach: true,
  canStop: true,
  canSubmit: true,
  canUseShell: true,
  models: [
    { label: 'Nanocodex', modelId: 'nanocodex', providerId: 'nanocodex' },
  ],
  permissionDecisions: ['once', 'always', 'reject'],
  referenceTypes: ['file', 'range', 'resource', 'agent'],
  variants: [
    { id: 'balanced', label: 'Balanced' },
    { id: 'fast', label: 'Fast' },
  ],
}

const galleryCommands = [
  {
    description: 'Condense earlier context before continuing.',
    id: 'compact',
    label: 'Compact context',
    value: '/compact',
  },
  {
    description: 'Start a design-focused review.',
    id: 'review',
    label: 'Review interface',
    value: '/review',
  },
] as const

const galleryReferences = [
  {
    description: 'Turn and message presentation.',
    id: 'turn-source',
    label: 'turn.tsx',
    referenceType: 'file',
    value: 'packages/components/src/turn.tsx',
  },
  {
    description: 'Canonical chat contracts.',
    id: 'chat-contracts',
    label: 'chat.ts',
    referenceType: 'file',
    value: 'packages/foundations/src/chat.ts',
  },
] as const

const galleryPromptHistory = [
  {
    draft: galleryDraft,
    id: 'history-audit',
    label: 'Continue the interface audit',
  },
] as const

const galleryRunningSubagent: ToolPart = {
  callId: 'gallery-subagent-running-call',
  id: 'gallery-subagent-running',
  presentation: {
    activity: {
      detail: 'Comparing transcript density across recent AI interfaces',
      summary: 'Searching references',
      tool: 'search_web',
    },
    agent: { id: 'research', label: 'Research agent' },
    childSessionId: 'gallery-child-running',
    description: 'Compare transcript density patterns',
    kind: 'task',
  },
  state: {
    input: { description: 'Compare transcript density patterns' },
    startedAt: Date.now(),
    status: 'running',
  },
  toolName: 'run_subagent',
  type: 'tool',
}

const galleryCompletedSubagent: ToolPart = {
  callId: 'gallery-subagent-complete-call',
  id: 'gallery-subagent-complete',
  presentation: {
    agent: { id: 'review', label: 'Review agent' },
    childSessionId: 'gallery-child-complete',
    description: 'Review the activity hierarchy',
    kind: 'task',
    transcript: {
      reasoning:
        'I reviewed the active and terminal layouts at both breakpoints.',
      result:
        '**The hierarchy is sound.** One state owner remains visible throughout.',
      steps: [
        {
          id: 'gallery-child-inspect',
          input: 'activity hierarchy',
          output: 'ToolActivity, Reasoning, ActivityList',
          status: 'succeeded',
          summary: 'Searched component catalog',
          tool: 'inspect_component_catalog',
        },
      ],
    },
  },
  state: {
    endedAt: 1_200,
    input: { description: 'Review the activity hierarchy' },
    output: 'The active state has one visible owner.',
    status: 'succeeded',
  },
  toolName: 'run_subagent',
  type: 'tool',
}

const galleryTurn: ChatTurn = {
  agent: { id: 'build', label: 'Build' },
  assistant: [
    {
      createdAt: 1_100,
      delivery: { status: 'confirmed' },
      id: 'gallery-chat-assistant',
      parts: [
        {
          endedAt: 1_180,
          id: 'gallery-chat-reasoning',
          startedAt: 1_120,
          state: { status: 'complete' },
          text: 'I checked the component boundary before changing the interface.',
          type: 'reasoning',
        },
        {
          callId: 'gallery-read-call',
          id: 'gallery-read-tool',
          presentation: {
            kind: 'context',
            operation: 'read',
            target: 'packages/components/src/turn.tsx',
          },
          state: {
            endedAt: 1_220,
            input: { filePath: 'packages/components/src/turn.tsx' },
            output: 'Turn component source',
            status: 'succeeded',
          },
          toolName: 'read',
          type: 'tool',
        },
        {
          callId: 'gallery-grep-call',
          id: 'gallery-grep-tool',
          presentation: {
            kind: 'context',
            operation: 'grep',
            target: 'data-slot="turn"',
          },
          state: {
            endedAt: 1_240,
            input: { query: 'data-slot="turn"' },
            output: '1 match',
            status: 'succeeded',
          },
          toolName: 'grep',
          type: 'tool',
        },
        {
          callId: 'gallery-shell-call',
          id: 'gallery-shell-tool',
          presentation: {
            command: 'pnpm typecheck',
            durationMs: 120,
            exitCode: 0,
            kind: 'shell',
            outputTruncated: false,
            workingDirectory: '/workspace',
          },
          state: {
            endedAt: 1_320,
            input: { command: 'pnpm typecheck' },
            output: 'All packages passed.',
            status: 'succeeded',
          },
          toolName: 'shell',
          type: 'tool',
        },
        {
          callId: 'gallery-custom-call',
          id: 'gallery-custom-tool',
          presentation: { kind: 'generic' },
          state: {
            endedAt: 1_340,
            error: {
              kind: 'tool',
              message: 'The optional preview was unavailable.',
              retryable: true,
            },
            input: { target: 'preview' },
            status: 'failed',
          },
          toolName: 'custom_preview',
          type: 'tool',
        },
        {
          id: 'gallery-chat-text',
          markdown:
            'The chat layer now keeps **runtime state outside presentation** and renders unknown tools without dropping evidence.',
          state: { status: 'complete' },
          type: 'text',
        },
      ],
      role: 'assistant',
      turnId: 'gallery-chat-turn',
    },
  ],
  id: 'gallery-chat-turn',
  model: { label: 'Nanocodex', modelId: 'nanocodex', providerId: 'nanocodex' },
  state: { endedAt: 1_400, startedAt: 1_100, status: 'complete' },
  user: {
    createdAt: 1_000,
    delivery: { status: 'confirmed' },
    id: 'gallery-chat-user',
    parts: [
      {
        id: 'gallery-chat-user-text',
        markdown: 'Audit the chat component boundary and verify the build.',
        state: { status: 'complete' },
        type: 'text',
      },
    ],
    role: 'user',
    turnId: 'gallery-chat-turn',
  },
}

const galleryPermission: PermissionRequestView = {
  consequence: 'external',
  effect: 'Fetch https://example.com/design-system',
  id: 'gallery-chat-permission',
  order: 0,
  origin: { label: 'Main session', sessionId: 'gallery-session' },
  scope: 'This can be remembered for this project.',
  state: { status: 'pending' },
  title: 'Use the network?',
  type: 'permission',
}

const galleryQuestion: QuestionRequestView = {
  id: 'gallery-chat-question',
  order: 1,
  origin: { label: 'Design review', sessionId: 'gallery-session' },
  questions: [
    {
      allowCustom: true,
      id: 'gallery-density',
      label: 'Choose an interface density',
      options: [
        { description: 'More room between turns.', id: 'calm', label: 'Calm' },
        {
          description: 'More context on screen.',
          id: 'compact',
          label: 'Compact',
        },
      ],
      required: true,
      type: 'single-choice',
    },
    {
      id: 'gallery-notes',
      label: 'Anything else to preserve?',
      multiline: true,
      required: false,
      type: 'text',
    },
  ],
  state: { status: 'pending' },
  type: 'question',
}

const galleryTodos: TodoListView = {
  id: 'gallery-chat-todos',
  items: [
    { id: 'contracts', state: 'complete', title: 'Define contracts' },
    { id: 'events', state: 'in-progress', title: 'Reconcile event stream' },
    { id: 'review', state: 'pending', title: 'Review mobile layout' },
  ],
  state: 'active',
}

const galleryRevert: RevertedPrompt = {
  draft: galleryDraft,
  id: 'gallery-reverted-prompt',
  turnId: galleryTurn.id,
}

const galleryQueue: readonly QueuedPrompt[] = [
  { draft: galleryDraft, id: 'gallery-queued', state: 'queued' },
  {
    draft: {
      ...galleryDraft,
      revision: 1,
      segments: [
        {
          id: 'gallery-retry-text',
          text: 'Retry the visual check.',
          type: 'text',
        },
      ],
      selection: {
        anchor: { offset: 23, segmentId: 'gallery-retry-text' },
        focus: { offset: 23, segmentId: 'gallery-retry-text' },
      },
    },
    error: {
      kind: 'connection',
      message: 'The runtime disconnected.',
      retryable: true,
    },
    id: 'gallery-queue-failed',
    state: 'failed',
  },
]

type GroupHeadingProps = {
  description: string
  id: string
  title: string
}

function GroupHeading({ description, id, title }: GroupHeadingProps) {
  return (
    <div {...stylex.props(styles.groupHeading)}>
      <h2 id={id} {...stylex.props(styles.groupTitle)}>
        {title}
      </h2>
      <p {...stylex.props(styles.groupDescription)}>{description}</p>
    </div>
  )
}

type ComponentSampleProps = {
  children: ReactNode
  description: string
  title: string
  wide?: boolean
}

function ComponentSample({
  children,
  description,
  title,
  wide = false,
}: ComponentSampleProps) {
  const titleId = useId()

  return (
    <article
      aria-labelledby={titleId}
      {...stylex.props(styles.sample, wide && styles.sampleWide)}
    >
      <div {...stylex.props(styles.sampleHeading)}>
        <h3 id={titleId} {...stylex.props(styles.sampleTitle)}>
          {title}
        </h3>
        <p {...stylex.props(styles.sampleDescription)}>{description}</p>
      </div>
      <div {...stylex.props(styles.preview, wide && styles.previewWide)}>
        {children}
      </div>
    </article>
  )
}

const styles = stylex.create({
  introduction: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    maxInlineSize: '48rem',
  },
  libraryTitle: {
    fontSize: { default: '1.75rem', '@media (min-width: 48rem)': '2.25rem' },
    fontWeight: type.weightStrong,
    lineHeight: '1.15',
    letterSpacing: '-0.035em',
    margin: 0,
    maxInlineSize: '24ch',
    textWrap: 'balance',
  },
  libraryDescription: {
    color: colors.textMuted,
    fontSize: type.sizeInput,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '58ch',
  },
  inlineLink: {
    color: colors.text,
    textUnderlineOffset: '3px',
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineOffset: '3px',
    outlineStyle: 'solid',
    outlineWidth: '3px',
  },
  categoryNav: {
    backgroundColor: colors.canvas,
    insetBlockStart: 0,
    position: 'sticky',
    zIndex: 10,
  },
  categoryNavInner: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x1,
    marginInline: 'auto',
    maxInlineSize: '68rem',
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  categoryLink: {
    alignItems: 'center',
    borderRadius: radii.control,
    color: colors.textMuted,
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: type.sizeSmall,
    lineHeight: type.lineCompact,
    minBlockSize: {
      default: '2.25rem',
      '@media (hover: none)': '2.75rem',
    },
    outlineColor: { default: 'transparent', ':focus-visible': colors.focus },
    outlineStyle: 'solid',
    outlineWidth: '3px',
    paddingInline: space.x2,
    textDecoration: 'none',
    touchAction: 'manipulation',
    backgroundColor: {
      default: 'transparent',
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3rem',
    marginInline: 'auto',
    maxInlineSize: '68rem',
    paddingBlock: space.x8,
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x6,
    scrollMarginBlockStart: {
      default: '6.5rem',
      '@media (min-width: 48rem)': '3.5rem',
    },
  },
  groupHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  groupTitle: {
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    lineHeight: type.lineHeading,
    margin: 0,
  },
  groupDescription: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '65ch',
  },
  grid: {
    display: 'grid',
    columnGap: space.x4,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 56rem)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: space.x5,
  },
  sample: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.surface,
    boxShadow: 'var(--example-shadow)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    minBlockSize: '100%',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  sampleWide: {
    '@media (min-width: 56rem)': {
      gridColumn: '1 / -1',
    },
  },
  sampleHeading: {
    backgroundColor: colors.surfaceMuted,
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
    order: 2,
    paddingBlock: space.x3,
    paddingInline: space.x4,
  },
  sampleTitle: {
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  sampleDescription: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '65ch',
  },
  preview: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    gap: space.x3,
    justifyContent: 'flex-start',
    minBlockSize: '9.5rem',
    minInlineSize: 0,
    order: 1,
    padding: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x5,
    },
  },
  previewWide: {
    minBlockSize: '10rem',
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x1,
    justifyContent: 'center',
  },
  sampleStatus: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    margin: 0,
    textAlign: 'center',
  },
  borderedPreview: {
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    overflow: 'hidden',
  },
  note: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
  },
  turnPreview: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  code: {
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
  },
  resetAction: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
})
