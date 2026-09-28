import { Composer } from '@atiraui/components'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'

export function ComposerExample() {
  const [value, setValue] = useState('Review the component boundary.')
  const [submitted, setSubmitted] = useState('')

  return (
    <div {...stylex.props(styles.stack)}>
      <Composer
        value={value}
        onValueChange={setValue}
        onSubmit={(message) => {
          setSubmitted(message)
          setValue('')
        }}
      />
      <p role="status" {...stylex.props(styles.status)}>
        {submitted
          ? `Submitted: ${submitted}`
          : 'Ctrl+Enter or Cmd+Enter submits. Enter adds a line.'}
      </p>
    </div>
  )
}

const styles = stylex.create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  },
  status: {
    margin: 0,
  },
})
