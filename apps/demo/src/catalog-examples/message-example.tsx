import { Message, Response } from '@pretty-amped/components'

export function MessageExample() {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      <Message actor="assistant" label="Assistant response">
        <Response status="complete">
          Components keep presentation separate from runtime state.
        </Response>
      </Message>
    </ol>
  )
}
