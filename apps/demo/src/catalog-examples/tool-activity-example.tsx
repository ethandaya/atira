import { ToolActivity } from '@atira/components'

export function ToolActivityExample() {
  return (
    <ToolActivity
      defaultOpen
      id="catalog-tool"
      state={{ status: 'succeeded' }}
      summary="Registry updated"
      tool="write_file"
    >
      <code>2 files changed</code>
    </ToolActivity>
  )
}
