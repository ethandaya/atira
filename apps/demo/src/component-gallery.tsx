import * as stylex from '@stylexjs/stylex'

import { AgentExamples } from './component-gallery/agent-examples'
import { ConversationExamples } from './component-gallery/conversation-examples'
import { FoundationExamples } from './component-gallery/foundation-examples'
import { galleryStyles } from './component-gallery/gallery-styles.stylex'
import { OutputExamples } from './component-gallery/output-examples'
import { SessionExamples } from './component-gallery/session-examples'

export function ComponentGallery() {
  return (
    <section id="explorer" aria-label="Component gallery">
      <div {...stylex.props(galleryStyles.content)}>
        <FoundationExamples />
        <ConversationExamples />
        <AgentExamples />
        <SessionExamples />
        <OutputExamples />
      </div>
    </section>
  )
}
