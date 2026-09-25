import { ToolActivity } from '@pretty-amped/components'

export function ToolActivityExample({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <ToolActivity
      defaultOpen={!compact}
      id="catalog-tool"
      state={{ status: 'succeeded' }}
      summary="Registry updated"
      tool="write_file"
    >
      <code>2 files changed</code>
    </ToolActivity>
  )
}
