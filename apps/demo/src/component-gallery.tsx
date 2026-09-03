import {
  Action,
  Actions,
  ActivityList,
  ActivitySummary,
  Artifact,
  CitationList,
  CodeBlock,
  Composer,
  Diff,
  InlineCitation,
  Loader,
  Markdown,
  Message,
  Outcome,
  PermissionRequest,
  Plan,
  Reasoning,
  Response,
  Suggestion,
  Suggestions,
  Thread,
  ToolActivity,
  type PermissionRequestState,
} from '@pretty-amped/components'
import {
  colors,
  radii,
  space,
  type,
} from '@pretty-amped/foundations/tokens.stylex'
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
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useId, useState, type ReactNode } from 'react'

export function ComponentGallery() {
  const [textFieldValue, setTextFieldValue] = useState('')
  const [composerFieldValue, setComposerFieldValue] = useState('')
  const [composerValue, setComposerValue] = useState('')
  const [composerResult, setComposerResult] = useState('No message submitted.')
  const [buttonResult, setButtonResult] = useState('No button pressed.')
  const [iconButtonResult, setIconButtonResult] = useState('No icon button pressed.')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogResult, setDialogResult] = useState('Dialog has not been opened.')
  const [activityListOpen, setActivityListOpen] = useState(false)
  const [artifactResult, setArtifactResult] = useState('No artifact opened.')
  const [actionResult, setActionResult] = useState(
    'No message action selected.',
  )
  const [suggestionResult, setSuggestionResult] = useState(
    'No suggestion selected.',
  )
  const [permissionState, setPermissionState] =
    useState<PermissionRequestState>({ status: 'pending' })

  function submitComposer(value: string) {
    setComposerResult(`Submitted: ${value}`)
    setComposerValue('')
  }

  return (
    <main aria-label="Component gallery" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.content)}>
        <section aria-labelledby="primitives-heading" {...stylex.props(styles.group)}>
          <GroupHeading
            id="primitives-heading"
            title="Primitives"
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
                  <PlusIcon />
                </IconButton>
                <IconButton
                  aria-label="Remove item"
                  onClick={() => setIconButtonResult('Remove item pressed.')}
                  variant="outline"
                >
                  <MinusIcon />
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
                actions={(
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
                )}
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
                <Progress label="Preparing preview" value={null} valueLabel="Working" />
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

        <section
          aria-labelledby="conversation-heading"
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
                  <Response status="complete">
                    Components own accessible presentation and named actions;
                    adapters own runtime behavior.
                  </Response>
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
                  The loading layer belongs below protocol adapters and above
                  visual primitives.
                </Reasoning>
              </div>
            </ComponentSample>

            <ComponentSample
              title="Actions"
              description="A labelled toolbar of compact, named message actions."
            >
              <Actions>
                <Action
                  label="Copy response"
                  onClick={() => setActionResult('Response copied.')}
                >
                  <CopyIcon />
                </Action>
                <Action
                  label="Regenerate response"
                  onClick={() => setActionResult('Regenerate requested.')}
                >
                  <RetryIcon />
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
                    onSelect={(value) =>
                      setSuggestionResult(`Selected: ${value}`)
                    }
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
                />.
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

        <section aria-labelledby="agent-heading" {...stylex.props(styles.group)}>
          <GroupHeading
            id="agent-heading"
            title="Agent state"
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
                summary="Updated the component registry"
                tool="write_file"
              >
                <code {...stylex.props(styles.code)}>2 files changed</code>
              </ToolActivity>
            </ComponentSample>

            <ComponentSample
              title="ActivityList"
              description="A controlled, chronological disclosure for tool evidence."
              wide
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
                      onClick={() =>
                        setPermissionState({ status: 'pending' })
                      }
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

        <section aria-labelledby="output-heading" {...stylex.props(styles.group)}>
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
                            content: '  const submitLabel = status === "submitting" ? "Sending…" : "Send"',
                            id: 'gallery-diff-addition-1',
                            kind: 'addition',
                            newLine: 19,
                          },
                          {
                            content: '  const submitDisabled = !canSubmit || status === "submitting"',
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
                    description: 'Why Linear adopted StyleX for long-lived product UI.',
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
      </div>
    </main>
  )
}

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
      <div {...stylex.props(styles.preview)}>{children}</div>
    </article>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" focusable="false">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" focusable="false">
      <path d="M4 10h12" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      focusable="false"
    >
      <rect
        x="7"
        y="7"
        width="9"
        height="9"
        rx="1.5"
        stroke="currentColor"
      />
      <path
        d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-7A1.5 1.5 0 0 0 3 5.5v7A1.5 1.5 0 0 0 4.5 14H7"
        stroke="currentColor"
      />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      focusable="false"
    >
      <path
        d="M15.25 7.25V3.5m0 0H11.5m3.75 0-2.1 2.1a6 6 0 1 0 1.45 6.15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const styles = stylex.create({
  root: {
    flex: 1,
    minBlockSize: 0,
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
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
  },
  groupHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
  },
  groupTitle: {
    fontSize: type.sizeTitle,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
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
    alignItems: 'start',
    display: 'grid',
    columnGap: space.x6,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 56rem)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: space.x8,
  },
  sample: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    minInlineSize: 0,
    paddingBlockStart: space.x4,
  },
  sampleWide: {
    '@media (min-width: 56rem)': {
      gridColumn: '1 / -1',
    },
  },
  sampleHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x1,
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
    flexDirection: 'column',
    gap: space.x3,
    minInlineSize: 0,
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.x2,
  },
  sampleStatus: {
    color: colors.textMuted,
    fontSize: type.sizeCaption,
    lineHeight: type.lineBody,
    margin: 0,
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
  code: {
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
  },
  resetAction: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
})
