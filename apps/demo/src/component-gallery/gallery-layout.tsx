import * as stylex from '@stylexjs/stylex'
import { useId, type ReactNode } from 'react'

import { galleryStyles } from './gallery-styles.stylex'

type GroupHeadingProps = {
  description: string
  id: string
  title: string
}

export function GroupHeading({ description, id, title }: GroupHeadingProps) {
  return (
    <div {...stylex.props(galleryStyles.groupHeading)}>
      <h2 id={id} tabIndex={-1} {...stylex.props(galleryStyles.groupTitle)}>
        {title}
      </h2>
      <p {...stylex.props(galleryStyles.groupDescription)}>{description}</p>
    </div>
  )
}

type ComponentSampleProps = {
  anchor?: string
  apiNotes?: ReactNode
  children: ReactNode
  description: string
  title: string
  wide?: boolean
}

export function ComponentSample({
  anchor,
  apiNotes,
  children,
  description,
  title,
  wide = false,
}: ComponentSampleProps) {
  const titleId = useId()

  return (
    <article
      id={anchor ?? componentAnchor(title)}
      aria-labelledby={titleId}
      tabIndex={-1}
      {...stylex.props(galleryStyles.sample)}
    >
      <div
        data-slot="component-docs"
        {...stylex.props(galleryStyles.sampleHeading)}
      >
        <h3 id={titleId} {...stylex.props(galleryStyles.sampleTitle)}>
          {title}
        </h3>
        <p {...stylex.props(galleryStyles.sampleDescription)}>{description}</p>
        {apiNotes && (
          <p {...stylex.props(galleryStyles.apiNotes)}>
            <span {...stylex.props(galleryStyles.apiLabel)}>API</span>
            {apiNotes}
          </p>
        )}
      </div>
      <div
        data-slot="component-preview"
        {...stylex.props(
          galleryStyles.preview,
          wide && galleryStyles.previewWide,
        )}
      >
        {children}
      </div>
    </article>
  )
}

function componentAnchor(name: string) {
  return `component-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
}
