import { Artifact, CitationList, Diff, Plan } from '@atiraui/components'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'

import { CatalogPreview } from '../catalog'
import { ComponentSample, GroupHeading } from './gallery-layout'
import { galleryStyles } from './gallery-styles.stylex'

export function OutputExamples() {
  return (
    <section
      aria-labelledby="output-heading"
      id="gallery-output"
      {...stylex.props(galleryStyles.group)}
    >
      <GroupHeading
        id="output-heading"
        title="Structured output"
        description="Typed plans, code, changes, provenance, and generated artifacts."
      />

      <div {...stylex.props(galleryStyles.grid)}>
        <ComponentSample
          title="Plan"
          description="Ordered work with explicit plan and step states."
          apiNotes="Use stable step IDs and explicit queued, active, complete, or failed states."
          wide
        >
          <Plan
            headingLevel={4}
            id="gallery-plan"
            status="active"
            steps={[
              {
                detail: 'Mapped to the canonical catalog.',
                id: 'gallery-plan-contracts',
                status: 'complete',
                title: 'Define component contracts',
              },
              {
                detail: 'Translating the neutral baseline into StyleX.',
                id: 'gallery-plan-styles',
                status: 'active',
                title: 'Implement accessible components',
              },
              {
                id: 'gallery-plan-review',
                status: 'queued',
                title: 'Review representative states',
              },
            ]}
            title="Component parity"
          />
        </ComponentSample>

        <ComponentSample
          title="CodeBlock"
          description="Geist Mono code with wrapping, scrolling, and copy feedback."
          wide
        >
          <CatalogPreview id="code-block" />
        </ComponentSample>

        <ComponentSample
          title="Diff"
          description="Structured files, hunks, and lines with accessible labels."
          apiNotes="Provide stable IDs for files, hunks, and lines; the component owns presentation, not diff parsing."
          wide
        >
          <Diff
            files={[
              {
                additions: 2,
                deletions: 1,
                hunks: [
                  {
                    header: '@@ -18,3 +18,4 @@ export function Composer',
                    id: 'gallery-diff-hunk-composer',
                    lines: [
                      {
                        content: '  const canSubmit = value.trim().length > 0',
                        id: 'gallery-diff-context-1',
                        kind: 'context',
                        newLine: 18,
                        oldLine: 18,
                      },
                      {
                        content: '  const submitLabel = "Send"',
                        id: 'gallery-diff-deletion-1',
                        kind: 'deletion',
                        oldLine: 19,
                      },
                      {
                        content:
                          '  const submitLabel = status === "submitting" ? "Sending…" : "Send"',
                        id: 'gallery-diff-addition-1',
                        kind: 'addition',
                        newLine: 19,
                      },
                      {
                        content:
                          '  const submitDisabled = !canSubmit || status === "submitting"',
                        id: 'gallery-diff-addition-2',
                        kind: 'addition',
                        newLine: 20,
                      },
                    ],
                  },
                ],
                id: 'gallery-diff-composer',
                path: 'packages/components/src/composer.tsx',
                status: 'modified',
              },
              {
                additions: 24,
                defaultOpen: false,
                deletions: 0,
                hunks: [],
                id: 'gallery-diff-manifest',
                path: 'packages/components/src/composer.manifest.ts',
                status: 'added',
              },
            ]}
            headingLevel={4}
            id="gallery-diff"
            title="Composer changes"
          />
        </ComponentSample>

        <ComponentSample
          title="CitationList"
          description="Source provenance with valid, unavailable, and invalid links."
        >
          <CitationList
            citations={[
              {
                description:
                  'Why Linear adopted StyleX for long-lived product UI.',
                href: 'https://linear.app/now/styling-linear-for-the-future-stylex',
                id: 'gallery-citation-linear',
                source: 'Linear',
                title: 'Styling Linear for the future',
              },
              {
                id: 'gallery-citation-notes',
                source: 'Research notes',
                title: 'Internal component boundary notes',
              },
              {
                href: 'ftp://example.com/component-notes',
                id: 'gallery-citation-invalid',
                title: 'Unsupported source URL',
              },
            ]}
            headingLevel={4}
            id="gallery-citations"
          />
        </ComponentSample>

        <ComponentSample
          title="Artifact"
          description="Protocol-neutral references with explicit availability and actions."
        >
          <ArtifactExample />
        </ComponentSample>
      </div>
    </section>
  )
}

function ArtifactExample() {
  const [opened, setOpened] = useState(false)
  return (
    <>
      <div {...stylex.props(galleryStyles.stack)}>
        <Artifact
          description="A visual review capture from the component gallery."
          headingLevel={4}
          id="gallery-artifact-ready"
          kind="image"
          metadata={[
            { id: 'format', label: 'Format', value: 'SVG' },
            { id: 'size', label: 'Size', value: '320×140' },
          ]}
          onOpen={() => setOpened((current) => !current)}
          openLabel={opened ? 'Hide artifact' : 'Open artifact'}
          state={{ status: 'ready' }}
          title="component-gallery.svg"
        />
        <Artifact
          description="The runtime owns generation progress."
          headingLevel={4}
          id="gallery-artifact-generating"
          kind="result"
          state={{ status: 'generating' }}
          title="Accessibility report"
        />
      </div>
      {opened && (
        <section
          aria-label="component-gallery.svg preview"
          {...stylex.props(galleryStyles.artifactPreview)}
        >
          <svg
            aria-labelledby="gallery-artifact-preview-title"
            role="img"
            viewBox="0 0 320 140"
            {...stylex.props(galleryStyles.artifactImage)}
          >
            <title id="gallery-artifact-preview-title">
              Miniature component gallery with button examples
            </title>
            <text x="16" y="27" {...stylex.props(galleryStyles.artifactTitle)}>
              Components
            </text>
            <line
              x1="16"
              x2="304"
              y1="42"
              y2="42"
              {...stylex.props(galleryStyles.artifactDivider)}
            />
            <rect
              x="16"
              y="60"
              width="288"
              height="64"
              rx="8"
              {...stylex.props(galleryStyles.artifactCard)}
            />
            <rect
              x="32"
              y="76"
              width="78"
              height="32"
              rx="6"
              {...stylex.props(galleryStyles.artifactPrimary)}
            />
            <text
              x="71"
              y="96"
              textAnchor="middle"
              {...stylex.props(galleryStyles.artifactPrimaryLabel)}
            >
              Primary
            </text>
            <rect
              x="122"
              y="76"
              width="92"
              height="32"
              rx="6"
              {...stylex.props(galleryStyles.artifactSecondary)}
            />
            <text
              x="168"
              y="96"
              textAnchor="middle"
              {...stylex.props(galleryStyles.artifactSecondaryLabel)}
            >
              Secondary
            </text>
          </svg>
        </section>
      )}
    </>
  )
}
