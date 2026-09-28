import { Message, Response } from '@atiraui/components'
import * as stylex from '@stylexjs/stylex'

export function MessageExample() {
  return (
    <ol {...stylex.props(styles.list)}>
      <Message actor="assistant" label="Assistant response">
        <Response status="complete">
          Components keep presentation separate from runtime state.
        </Response>
      </Message>
    </ol>
  )
}

const styles = stylex.create({
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
})
