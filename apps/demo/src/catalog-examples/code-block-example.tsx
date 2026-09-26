import { CodeBlock } from '@atira/components'
import { TextareaField } from '@atira/primitives'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'

const initialCode =
  'export function greet(name: string) {\n  return `Hello, ${name}`\n}'

export function CodeBlockExample() {
  const [code, setCode] = useState(initialCode)

  return (
    <div {...stylex.props(styles.stack)}>
      <TextareaField
        label="Example code"
        value={code}
        onValueChange={setCode}
        {...stylex.props(styles.codeInput)}
      />
      <CodeBlock filename="activity.tsx" language="tsx" code={code} />
    </div>
  )
}

const styles = stylex.create({
  codeInput: {
    fontFamily: 'monospace',
    minHeight: '7rem',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  },
})
