import {
  Action,
  Actions,
  InlineCitation,
  Loader,
  Markdown,
  Suggestion,
  Suggestions,
  Thread,
} from '@atira/components'
import * as stylex from '@stylexjs/stylex'
import { Copy as CopyIcon } from 'lucide-react'
import { useState } from 'react'

import { CatalogPreview } from '../catalog'
import { ComponentSample, GroupHeading } from './gallery-layout'
import { galleryStyles } from './gallery-styles.stylex'

const exampleResponse =
  'Components own accessible presentation and named actions; adapters own runtime behavior.'

export function ConversationExamples() {
  return (
    <section
      aria-labelledby="conversation-heading"
      id="gallery-conversation"
      {...stylex.props(galleryStyles.group)}
    >
      <GroupHeading
        id="conversation-heading"
        title="Conversation"
        description="Controlled conversation anatomy without runtime ownership."
      />

      <div {...stylex.props(galleryStyles.grid)}>
        <ComponentSample
          title="Thread"
          description="A semantic message list with an explicit empty state."
          apiNotes="Provide a label for the conversation region and empty copy when there are no messages."
        >
          <Thread label="Empty thread preview" empty="No messages yet." />
        </ComponentSample>

        <ComponentSample
          title="Message + Response"
          description="Actor-aware message alignment and response lifecycle."
          apiNotes="Message owns actor semantics; Response status controls streaming, complete, interrupted, and failed presentation."
        >
          <CatalogPreview id="message" />
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
          <div {...stylex.props(galleryStyles.stack)}>
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
          <CatalogPreview id="reasoning" />
        </ComponentSample>

        <ComponentSample
          title="Actions"
          description="A labelled toolbar of compact, named message actions."
        >
          <ActionsExample />
        </ComponentSample>

        <ComponentSample
          title="Suggestions"
          description="Horizontally scrollable prompts with a semantic select event."
          wide
        >
          <SuggestionsExample />
        </ComponentSample>

        <ComponentSample
          title="InlineCitation"
          description="Compact in-flow provenance with explicit link availability."
        >
          <p {...stylex.props(galleryStyles.note)}>
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
          apiNotes="Control value with onValueChange and handle submission with onSubmit."
          wide
        >
          <CatalogPreview id="composer" />
        </ComponentSample>
      </div>
    </section>
  )
}

function ActionsExample() {
  const [result, setResult] = useState('Copy the example response.')

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(exampleResponse)
      setResult('Response copied.')
    } catch {
      setResult('Copy failed. Select the response text instead.')
    }
  }

  return (
    <div {...stylex.props(galleryStyles.stack)}>
      <p {...stylex.props(galleryStyles.note)}>{exampleResponse}</p>
      <div {...stylex.props(galleryStyles.actionFeedback)}>
        <Actions>
          <Action label="Copy response" onClick={copyResponse}>
            <CopyIcon size={16} strokeWidth={1.75} />
          </Action>
        </Actions>
        <p role="status" {...stylex.props(galleryStyles.sampleStatus)}>
          {result}
        </p>
      </div>
    </div>
  )
}

function SuggestionsExample() {
  const [selected, setSelected] = useState('')
  return (
    <>
      <Suggestions>
        {[
          'Make it more concise',
          'Show the component API',
          'Explain the accessibility behavior',
        ].map((suggestion) => (
          <Suggestion
            key={suggestion}
            onSelect={setSelected}
            value={suggestion}
          />
        ))}
      </Suggestions>
      <p role="status" {...stylex.props(galleryStyles.sampleStatus)}>
        {selected ? `Selected: ${selected}` : 'Choose a suggested prompt.'}
      </p>
    </>
  )
}
