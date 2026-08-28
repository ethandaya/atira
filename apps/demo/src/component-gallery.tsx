import {
  Activity,
  Composer,
  Message,
  Outcome,
  PermissionRequest,
  Response,
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
  Disclosure,
  TextareaField,
  VisuallyHidden,
} from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { useId, useState, type ReactNode } from 'react'

export function ComponentGallery() {
  const [textareaValue, setTextareaValue] = useState('')
  const [composerValue, setComposerValue] = useState('')
  const [composerResult, setComposerResult] = useState('No message submitted.')
  const [buttonResult, setButtonResult] = useState('No button pressed.')
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
              title="TextareaField"
              description="A labeled, controlled textarea with mobile-safe text sizing."
            >
              <TextareaField
                description="The label and description remain associated with the control."
                label="Instruction"
                onValueChange={setTextareaValue}
                placeholder="Describe the change…"
                rows={3}
                value={textareaValue}
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
              title="Activity"
              description="Stable identifiers and named progress states."
            >
              <div {...stylex.props(styles.stack)}>
                <Activity
                  id="gallery-running"
                  label="Reading component sources"
                  state={{ status: 'running' }}
                />
                <Activity
                  detail="Waiting for a decision before writing files."
                  id="gallery-waiting"
                  label="Preparing changes"
                  state={{ status: 'waiting' }}
                />
                <Activity
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
    gap: space.x8,
    marginInline: 'auto',
    maxInlineSize: '60rem',
    paddingBlock: space.x8,
    paddingInline: {
      default: space.x4,
      '@media (min-width: 48rem)': space.x6,
    },
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
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
    gap: space.x4,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 56rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  sample: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    minInlineSize: 0,
    padding: space.x4,
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
