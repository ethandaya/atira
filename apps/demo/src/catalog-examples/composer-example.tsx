import { Composer } from '@pretty-amped/components'
import { useState } from 'react'

export function ComposerExample({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState('Review the component boundary.')
  const [submitted, setSubmitted] = useState('')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 0,
      }}
    >
      <Composer
        value={value}
        onValueChange={setValue}
        onSubmit={(message) => {
          setSubmitted(message)
          setValue('')
        }}
      />
      {!compact && (
        <p role="status" style={{ margin: 0 }}>
          {submitted
            ? `Submitted: ${submitted}`
            : 'Ctrl+Enter or Cmd+Enter submits. Enter adds a line.'}
        </p>
      )}
    </div>
  )
}
