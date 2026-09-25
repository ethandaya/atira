import { CodeBlock } from '@pretty-amped/components'
import { TextareaField } from '@pretty-amped/primitives'
import { useState } from 'react'

const initialCode = "export function greet(name: string) {\n  return `Hello, ${name}`\n}"

export function CodeBlockExample({ compact = false }: { compact?: boolean }) {
  const [code, setCode] = useState(initialCode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
      {!compact && (
        <TextareaField
          label="Example code"
          value={code}
          onValueChange={setCode}
          style={{ fontFamily: 'monospace', minHeight: '7rem' }}
        />
      )}
      <CodeBlock filename="activity.tsx" language="tsx" code={code} />
    </div>
  )
}
