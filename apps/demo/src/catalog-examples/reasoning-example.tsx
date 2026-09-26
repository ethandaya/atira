import { Reasoning } from '@atira/components'

export function ReasoningExample() {
  return (
    <Reasoning
      defaultOpen
      state={{ duration: '8 seconds', status: 'complete' }}
    >
      The component boundary is explicit and testable.
    </Reasoning>
  )
}
