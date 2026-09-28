import {
  ActivityList,
  ActivitySummary,
  Outcome,
  TaskTool,
  ToolActivity,
} from '@atiraui/components'
import type { ToolPart } from '@atiraui/foundations/chat'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'

import { CatalogPreview } from '../catalog'
import { ComponentSample, GroupHeading } from './gallery-layout'
import { galleryStyles } from './gallery-styles.stylex'

export function AgentExamples() {
  return (
    <section
      aria-labelledby="agent-heading"
      id="gallery-agents"
      {...stylex.props(galleryStyles.group)}
    >
      <GroupHeading
        id="agent-heading"
        title="Agent workflows"
        description="Legible progress, tool evidence, permission, and outcomes."
      />

      <div {...stylex.props(galleryStyles.grid)}>
        <ComponentSample
          title="ActivitySummary"
          description="Stable identifiers and named progress states."
        >
          <div {...stylex.props(galleryStyles.stack)}>
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
          <CatalogPreview id="tool-activity" />
        </ComponentSample>

        <ComponentSample
          title="TaskTool"
          description="Delegated work with agent identity, child provenance, and terminal state."
        >
          <div {...stylex.props(galleryStyles.stack)}>
            <TaskTool part={galleryRunningSubagent} />
            <TaskTool defaultOpen part={galleryCompletedSubagent} />
          </div>
        </ComponentSample>

        <ComponentSample
          title="ActivityList"
          description="A controlled chronological disclosure for tool evidence."
          apiNotes="Keep open state controlled when the runtime or surrounding layout owns disclosure state."
        >
          <ActivityListExample />
        </ComponentSample>

        <ComponentSample
          anchor="component-permissionrequest"
          title="Permission and question requests"
          description="Controlled decision boundaries with visible resolution."
          apiNotes="Pending permissions require decision handlers; keep request, question, and option IDs stable for runtime reconciliation."
          wide
        >
          <CatalogPreview id="requests" />
        </ComponentSample>

        <ComponentSample
          title="Outcome"
          description="Terminal work states with reviewable supporting detail."
          wide
        >
          <div {...stylex.props(galleryStyles.stack)}>
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

function ActivityListExample() {
  const [open, setOpen] = useState(true)
  return (
    <ActivityList
      id="gallery-activity-list"
      label="Recent activity"
      mode="disclosed"
      onOpenChange={setOpen}
      open={open}
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
  )
}

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
    startedAt: 1_000,
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
