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
} from '@atiraui/primitives'
import { colors, radii } from '@atiraui/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { Minus as MinusIcon, Plus as PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { ComponentSample, GroupHeading } from './gallery-layout'
import { galleryStyles } from './gallery-styles.stylex'

export function FoundationExamples() {
  return (
    <section
      aria-labelledby="primitives-heading"
      id="gallery-primitives"
      {...stylex.props(galleryStyles.group)}
    >
      <GroupHeading
        id="primitives-heading"
        title="Foundations and primitives"
        description="Owned React primitives with Base UI behavior and StyleX styling."
      />

      <div {...stylex.props(galleryStyles.grid)}>
        <ComponentSample
          title="Button"
          description="Visual hierarchy, disabled behavior, focus, and touch sizing."
          apiNotes="Choose a variant for hierarchy; native button attributes pass through."
        >
          <ButtonExample />
        </ComponentSample>

        <ComponentSample
          title="IconButton"
          description="A square button with a required accessible label."
          apiNotes="aria-label is required because icon children do not name the action."
        >
          <IconButtonExample />
        </ComponentSample>

        <ComponentSample
          title="TextField"
          description="A labeled, controlled single-line field."
        >
          <TextFieldExample />
        </ComponentSample>

        <ComponentSample
          title="ComposerField"
          description="A multiline field with mobile-safe text sizing."
        >
          <ComposerFieldExample />
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
          apiNotes="Use open and onOpenChange for controlled flows; focus returns to the trigger on close."
        >
          <DialogExample />
        </ComponentSample>

        <ComponentSample
          title="Status"
          description="Compact semantic state text with neutral and danger tones."
        >
          <div {...stylex.props(galleryStyles.controls)}>
            <Status>Ready</Status>
            <Status tone="danger">Failed</Status>
          </div>
        </ComponentSample>

        <ComponentSample
          title="Progress"
          description="Determinate and indeterminate progress with reduced motion."
          apiNotes="Pass a numeric value for determinate progress or null when completion is unknown."
        >
          <div {...stylex.props(galleryStyles.stack)}>
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
          <div {...stylex.props(galleryStyles.controls)}>
            <Spinner aria-label="Small loading indicator" size="small" />
            <Spinner aria-label="Regular loading indicator" />
            <Spinner aria-label="Large loading indicator" size="large" />
          </div>
        </ComponentSample>

        <ComponentSample
          title="Shimmer"
          description="Text-level streaming feedback with a readable static fallback."
        >
          <p {...stylex.props(galleryStyles.note)}>
            <Shimmer>Preparing the response…</Shimmer>
          </p>
        </ComponentSample>

        <ComponentSample
          title="VisuallyHidden"
          description="Adds screen-reader copy without changing visual layout."
        >
          <p {...stylex.props(galleryStyles.note)}>
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

const styles = stylex.create({
  borderedPreview: {
    borderColor: colors.border,
    borderRadius: radii.surface,
    borderStyle: 'solid',
    borderWidth: '1px',
    overflow: 'hidden',
  },
})

function ButtonExample() {
  const [selected, setSelected] = useState('No action selected')
  return (
    <div {...stylex.props(galleryStyles.stack)}>
      <div {...stylex.props(galleryStyles.controls)}>
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
            onClick={() => setSelected(`${label} action selected`)}
            variant={variant}
          >
            {label}
          </Button>
        ))}
      </div>
      <p role="status" {...stylex.props(galleryStyles.sampleStatus)}>
        {selected}
      </p>
    </div>
  )
}

function IconButtonExample() {
  const [count, setCount] = useState(0)
  return (
    <div {...stylex.props(galleryStyles.stack)}>
      <div {...stylex.props(galleryStyles.controls)}>
        <IconButton aria-label="Add item" onClick={() => setCount(count + 1)}>
          <PlusIcon size={20} strokeWidth={1.75} />
        </IconButton>
        <IconButton
          aria-label="Remove item"
          disabled={count === 0}
          onClick={() => setCount(count - 1)}
          variant="outline"
        >
          <MinusIcon size={20} strokeWidth={1.75} />
        </IconButton>
      </div>
      <p role="status" {...stylex.props(galleryStyles.sampleStatus)}>
        {count} {count === 1 ? 'item' : 'items'}
      </p>
    </div>
  )
}

function TextFieldExample() {
  const [value, setValue] = useState('')
  return (
    <TextField
      description="The label and description remain associated with the control."
      label="Component name"
      onValueChange={setValue}
      placeholder="Message"
      value={value}
    />
  )
}

function ComposerFieldExample() {
  const [value, setValue] = useState('')
  return (
    <ComposerField
      description="The label and description remain associated with the control."
      label="Instruction"
      onValueChange={setValue}
      placeholder="Describe the change…"
      rows={3}
      value={value}
    />
  )
}

function DialogExample() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      actions={
        <Button onClick={() => setOpen(false)} size="compact" variant="primary">
          Confirm
        </Button>
      }
      description="Focus stays inside this dialog until it closes."
      headingLevel={4}
      onOpenChange={setOpen}
      open={open}
      title="Review component behavior"
      trigger="Open dialog"
    >
      <p {...stylex.props(galleryStyles.note)}>
        Press Escape or use Close to return focus to the trigger.
      </p>
    </Dialog>
  )
}
