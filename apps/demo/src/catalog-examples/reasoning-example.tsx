import { Reasoning } from '@atira/components'

export function ReasoningExample({ compact = false }: { compact?: boolean }) {
  return (
    <Reasoning
      defaultOpen={!compact}
      state={{ duration: '8 seconds', status: 'complete' }}
    >
      The component boundary is explicit and testable.
    </Reasoning>
  )
}
