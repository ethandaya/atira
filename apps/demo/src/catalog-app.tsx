import { darkTheme, lightTheme } from '@atiraui/foundations/themes'
import { colors, radii, space, type } from '@atiraui/foundations/tokens.stylex'
import {
  CodeBlock,
  Message,
  PermissionRequest,
  Response,
} from '@atiraui/components'
import { Button } from '@atiraui/primitives'
import * as stylex from '@stylexjs/stylex'
import { Search } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { Playground as EmbeddedPlayground } from './app'
import { CatalogPreview } from './catalog'
import { catalog, type CatalogEntry } from './catalog-definition'
import { ComponentGallery as FullGallery } from './component-gallery'

type Theme = 'light' | 'dark'
type CatalogView = 'detail' | 'explorer' | 'overview' | 'playground'
let pendingScrollBehavior: ScrollBehavior = 'auto'
let pendingMainFocus = false

const navigationGroups = [
  {
    id: 'gallery-primitives',
    items: [
      'Button',
      'IconButton',
      'TextField',
      'ComposerField',
      'Disclosure',
      'Dialog',
      'Status',
      'Progress',
      'Spinner',
      'Shimmer',
      'VisuallyHidden',
    ],
    label: 'Foundations',
  },
  {
    id: 'gallery-conversation',
    items: [
      'Thread',
      'Message + Response',
      'Markdown',
      'Loader',
      'Reasoning',
      'Actions',
      'Suggestions',
      'InlineCitation',
      'Composer',
    ],
    label: 'Conversation',
  },
  {
    id: 'gallery-agents',
    items: [
      'ActivitySummary',
      'ToolActivity',
      'TaskTool',
      'ActivityList',
      'PermissionRequest',
      'Outcome',
    ],
    label: 'Agent workflows',
  },
  {
    id: 'gallery-compositions',
    items: [
      'Turn and message parts',
      'PermissionPrompt',
      'QuestionRequest',
      'TodoDock and RevertDock',
      'QueueList',
      'ChatComposer',
    ],
    label: 'Full compositions',
  },
  {
    id: 'gallery-output',
    items: ['Plan', 'CodeBlock', 'Diff', 'CitationList', 'Artifact'],
    label: 'Structured output',
  },
] as const

function componentAnchor(name: string) {
  return `component-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`
}

export function CatalogApp() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  const location = useSyncExternalStore(
    subscribeToLocation,
    currentLocation,
    currentLocation,
  )
  const { entry, pageName, view } = resolveCatalogRoute(
    window.location.pathname,
  )

  useEffect(() => {
    document.title = `${pageName} — Atira`
  }, [pageName])

  useEffect(() => {
    document.addEventListener('click', navigate)
    return () => document.removeEventListener('click', navigate)
  }, [])

  useEffect(() => {
    if (pendingMainFocus) {
      pendingMainFocus = false
      document.getElementById('catalog-content')?.focus({ preventScroll: true })
    }
    if (!window.location.hash) {
      window.scrollTo({ top: 0 })
      return
    }
    const behavior = pendingScrollBehavior
    pendingScrollBehavior = 'auto'
    scrollToHash(behavior)
  }, [location])

  return (
    <div data-theme={theme} {...catalogShellProps(view, theme)}>
      <a href="#catalog-content" {...stylex.props(styles.skip)}>
        Skip to content
      </a>
      <DocsSidebar
        activeView={view}
        onThemeChange={() =>
          setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
        }
        theme={theme}
      />
      <main
        id="catalog-content"
        tabIndex={-1}
        aria-label={pageName}
        {...catalogMainProps(view)}
      >
        <CatalogPage entry={entry} theme={theme} view={view} />
      </main>
    </div>
  )
}

function resolveCatalogRoute(pathname: string): {
  entry: CatalogEntry | undefined
  pageName: string
  view: CatalogView
} {
  const [, firstSegment, component] = pathname.split('/')
  const entry = catalog.find((item) => item.id === component)
  if (entry) return { entry, pageName: entry.name, view: 'detail' }
  if (firstSegment === 'playground')
    return { entry, pageName: 'Playground', view: 'playground' }
  if (firstSegment === 'components')
    return { entry, pageName: 'Components', view: 'explorer' }
  return { entry, pageName: 'Overview', view: 'overview' }
}

function catalogShellProps(view: CatalogView, theme: Theme) {
  return stylex.props(
    theme === 'dark' ? darkTheme : lightTheme,
    styles.shell,
    view === 'playground' && styles.playgroundShell,
    themeStyles[theme],
  )
}

function catalogMainProps(view: CatalogView) {
  return stylex.props(
    styles.main,
    view === 'overview' && styles.overviewMain,
    view === 'playground' && styles.playgroundMain,
  )
}

function CatalogPage({
  entry,
  theme,
  view,
}: {
  entry: CatalogEntry | undefined
  theme: Theme
  view: CatalogView
}) {
  if (entry) return <Detail entry={entry} />
  if (view === 'playground') return <PlaygroundPage theme={theme} />
  if (view === 'explorer') return <ExplorerPage />
  return <OverviewPage />
}

function DocsSidebar({
  activeView,
  onThemeChange,
  theme,
}: {
  activeView: string
  onThemeChange: () => void
  theme: Theme
}) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return navigationGroups
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.toLowerCase().includes(normalized),
        ),
      }))
      .filter(
        (group) =>
          group.label.toLowerCase().includes(normalized) ||
          group.items.length > 0,
      )
  }, [query])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return (
    <aside {...stylex.props(styles.sidebar)}>
      <a href="/" {...stylex.props(styles.wordmark)}>
        Atira
      </a>
      <label {...stylex.props(styles.search)}>
        <Search aria-hidden="true" size={17} strokeWidth={1.75} />
        <span {...stylex.props(styles.visuallyHidden)}>Search components</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Search"
          onChange={(event) => setQuery(event.target.value)}
          {...stylex.props(styles.searchInput)}
        />
        <kbd {...stylex.props(styles.shortcut)}>⌘K</kbd>
      </label>
      <nav aria-label="Documentation" {...stylex.props(styles.sidebarNav)}>
        {[
          ['Overview', '/', 'overview'],
          ['Playground', '/playground', 'playground'],
          ['Components', '/components', 'explorer'],
        ].map(([label, href, itemView]) => (
          <a
            key={itemView}
            href={href}
            aria-current={
              activeView === itemView ||
              (activeView === 'detail' && itemView === 'explorer')
                ? 'page'
                : undefined
            }
            {...stylex.props(
              styles.sidebarLink,
              (activeView === itemView ||
                (activeView === 'detail' && itemView === 'explorer')) &&
                styles.sidebarLinkActive,
            )}
          >
            {label}
          </a>
        ))}
        <div {...stylex.props(styles.sidebarGroups)}>
          {filteredGroups.map((group) => (
            <section key={group.id} {...stylex.props(styles.sidebarGroup)}>
              <a
                href={`/components#${group.id}`}
                {...stylex.props(styles.groupLink)}
              >
                {group.label}
              </a>
              {group.items.map((item) => (
                <a
                  key={item}
                  href={`/components#${componentAnchor(item)}`}
                  {...stylex.props(styles.componentLink)}
                >
                  {item}
                </a>
              ))}
            </section>
          ))}
        </div>
      </nav>
      <div {...stylex.props(styles.sidebarFooter)}>
        <Button variant="quiet" onClick={onThemeChange}>
          {theme === 'dark' ? 'Light' : 'Dark'} theme
        </Button>
      </div>
    </aside>
  )
}

function OverviewPage() {
  return (
    <div {...stylex.props(styles.page, styles.overviewPage)}>
      <PageHeader
        title="Build agent interfaces."
        description={
          <>
            React and StyleX components for streaming conversations, approvals,
            and agent workflows. Bring your own runtime, or try the{' '}
            <a
              href="https://github.com/gakonst/nanocodex"
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.pageDescriptionLink)}
            >
              Nanocodex
            </a>
            -powered ChatGPT{' '}
            <a href="/playground" {...stylex.props(styles.pageDescriptionLink)}>
              playground
            </a>
            .
          </>
        }
      />
      <section
        aria-labelledby="why-stylex-heading"
        {...stylex.props(styles.whyStylex)}
      >
        <div {...stylex.props(styles.whyStylexCopy)}>
          <h2 id="why-stylex-heading" {...stylex.props(styles.whyStylexTitle)}>
            Why StyleX
          </h2>
          <p {...stylex.props(styles.whyStylexDescription)}>
            Styles stay typed and close to components, then compile to static,
            deduplicated CSS. Composition is predictable without specificity
            fights, so component styling contracts remain clear as the system
            grows.
          </p>
        </div>
        <p {...stylex.props(styles.adopterReferences)}>
          Read{' '}
          <a
            href="https://linear.app/now/styling-linear-for-the-future-stylex"
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.adopterLink)}
          >
            Linear’s migration story
          </a>
          , then see its{' '}
          <a
            href="https://x.com/linear/status/2092965309992861994"
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.adopterLink)}
          >
            1,000-PR recap
          </a>{' '}
          on better defaults for people and agents.{' '}
          <a
            href="https://x.com/emilwidlund/status/2066804861325217948"
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.adopterLink)}
          >
            Polar’s migration
          </a>{' '}
          focuses on type-safe design decisions and moving beyond Tailwind.
        </p>
      </section>
      <section
        aria-labelledby="capabilities-heading"
        {...stylex.props(styles.overviewSection)}
      >
        <div {...stylex.props(styles.overviewSectionHeader)}>
          <h2
            id="capabilities-heading"
            {...stylex.props(styles.overviewSectionTitle)}
          >
            Components
          </h2>
          <a href="/components" {...stylex.props(styles.sectionLink)}>
            Browse all components
          </a>
        </div>
        <div {...stylex.props(styles.capabilities)}>
          <article
            {...stylex.props(styles.capability, styles.capabilityFeatured)}
          >
            <div {...stylex.props(styles.capabilityCopy)}>
              <h3 {...stylex.props(styles.overviewItemTitle)}>
                <a
                  href="/components#gallery-conversation"
                  {...stylex.props(styles.capabilityLink)}
                >
                  Conversation primitives
                </a>
              </h3>
            </div>
            <div {...stylex.props(styles.capabilityPreview)}>
              <ol {...stylex.props(styles.messagePreview)}>
                <Message actor="user">Audit this tool call.</Message>
                <Message actor="assistant" label="Assistant response">
                  <Response status="complete">
                    The request is ready for approval.
                  </Response>
                </Message>
              </ol>
            </div>
          </article>
          <article {...stylex.props(styles.capability)}>
            <div {...stylex.props(styles.capabilityCopy)}>
              <h3 {...stylex.props(styles.overviewItemTitle)}>
                <a
                  href="/components#gallery-agents"
                  {...stylex.props(styles.capabilityLink)}
                >
                  Agent workflow boundaries
                </a>
              </h3>
            </div>
            <div {...stylex.props(styles.capabilityPreview)}>
              <PermissionRequest
                consequence="external"
                effect="Create a draft issue."
                id="overview-permission"
                state={{ status: 'resolved', decision: 'approved' }}
                title="External action"
              />
            </div>
          </article>
          <article {...stylex.props(styles.capability)}>
            <div {...stylex.props(styles.capabilityCopy)}>
              <h3 {...stylex.props(styles.overviewItemTitle)}>
                <a
                  href="/components#gallery-output"
                  {...stylex.props(styles.capabilityLink)}
                >
                  Structured output
                </a>
              </h3>
            </div>
            <div {...stylex.props(styles.capabilityPreview)}>
              <CodeBlock
                code={'{\n  "status": "complete"\n}'}
                filename="result.json"
                language="json"
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}

function PlaygroundPage({ theme }: { theme: Theme }) {
  return (
    <div {...stylex.props(styles.page, styles.playgroundPage)}>
      <PageHeader
        title="Playground"
        description={
          <>
            Sign in with ChatGPT to try Atira’s agent interface. The playground
            is built on{' '}
            <a
              href="https://github.com/gakonst/nanocodex"
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.pageDescriptionLink)}
            >
              Nanocodex
            </a>
            .
          </>
        }
      />
      <section
        aria-label="Live playground"
        {...stylex.props(styles.preview, styles.playgroundPreview)}
      >
        <EmbeddedPlayground layout="page" theme={theme} />
      </section>
    </div>
  )
}

function ExplorerPage() {
  return (
    <div {...stylex.props(styles.page, styles.explorerPage)}>
      <PageHeader
        title="Components"
        description="Working examples for conversations, agent workflows, full compositions, and structured output."
      />
      <FullGallery />
    </div>
  )
}

function PageHeader({
  description,
  title,
}: {
  description: ReactNode
  title: ReactNode
}) {
  return (
    <header {...stylex.props(styles.pageHeader)}>
      <h1 {...stylex.props(styles.pageTitle)}>{title}</h1>
      <p {...stylex.props(styles.pageDescription)}>{description}</p>
    </header>
  )
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function currentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function scrollToHash(behavior: ScrollBehavior) {
  let id: string
  try {
    id = decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return
  }
  let frames = 0

  function scroll() {
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior, block: 'start' })
      const labelledBy =
        target.tagName === 'SECTION'
          ? target.getAttribute('aria-labelledby')
          : undefined
      const focusTarget = labelledBy
        ? document.getElementById(labelledBy)
        : target
      focusTarget?.focus({ preventScroll: true })
      return
    }
    if (frames++ < 60) requestAnimationFrame(scroll)
  }

  requestAnimationFrame(scroll)
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'
}

function navigate(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return

  const target = event.target
  if (!(target instanceof Element)) return
  const anchor = target.closest('a')
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return

  const url = new URL(anchor.href)
  if (url.origin !== window.location.origin) return
  if (
    url.pathname === window.location.pathname &&
    url.hash === '#catalog-content'
  )
    return
  if (
    url.pathname !== '/' &&
    url.pathname !== '/playground' &&
    url.pathname !== '/components' &&
    !url.pathname.startsWith('/components/')
  )
    return
  if (url.href === window.location.href) {
    event.preventDefault()
    if (url.hash) {
      scrollToHash(preferredScrollBehavior())
    }
    return
  }

  event.preventDefault()
  pendingScrollBehavior = url.hash ? preferredScrollBehavior() : 'auto'
  pendingMainFocus = !url.hash
  window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Detail({ entry }: { entry: CatalogEntry }) {
  return (
    <article {...stylex.props(styles.detail)}>
      <header>
        <h1 {...stylex.props(styles.hero)}>{entry.name}</h1>
        <p {...stylex.props(styles.lede)}>{entry.description}</p>
      </header>
      <section
        aria-labelledby="preview-heading"
        {...stylex.props(styles.detailSection)}
      >
        <h2 id="preview-heading" {...stylex.props(styles.sectionTitle)}>
          Preview
        </h2>
        <CatalogPreview id={entry.id} showSource />
      </section>
      <section aria-label="Component guidance" {...stylex.props(styles.docs)}>
        <div>
          <h2 {...stylex.props(styles.sectionTitle)}>
            Props and customization
          </h2>
          <p {...stylex.props(styles.body)}>{entry.props}</p>
        </div>
        <div>
          <h2 {...stylex.props(styles.sectionTitle)}>Accessibility</h2>
          <p {...stylex.props(styles.body)}>{entry.accessibility}</p>
        </div>
      </section>
    </article>
  )
}

const styles = stylex.create({
  shell: {
    backgroundColor: colors.canvas,
    color: colors.text,
    display: 'grid',
    fontFamily: type.family,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 50rem)': '15rem minmax(0, 1fr)',
    },
    minBlockSize: '100dvh',
  },
  playgroundShell: {
    blockSize: '100dvh',
    gridTemplateRows: {
      default: 'auto minmax(0, 1fr)',
      '@media (min-width: 50rem)': 'minmax(0, 1fr)',
    },
    minBlockSize: 0,
    overflow: 'hidden',
  },
  skip: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    insetBlockStart: space.x4,
    insetInlineStart: space.x4,
    padding: space.x3,
    position: 'fixed',
    transform: { default: 'translateY(-200%)', ':focus': 'translateY(0)' },
    zIndex: 100,
  },
  sidebar: {
    backgroundColor: colors.canvas,
    blockSize: { default: 'auto', '@media (min-width: 50rem)': '100dvh' },
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: {
      default: 'solid',
      '@media (min-width: 50rem)': 'none',
    },
    borderBlockEndWidth: { default: '1px', '@media (min-width: 50rem)': 0 },
    borderInlineEndColor: colors.border,
    borderInlineEndStyle: {
      default: 'none',
      '@media (min-width: 50rem)': 'solid',
    },
    borderInlineEndWidth: { default: 0, '@media (min-width: 50rem)': '1px' },
    display: 'flex',
    flexDirection: 'column',
    gap: { default: space.x4, '@media (min-width: 50rem)': space.x3 },
    insetBlockStart: 0,
    minInlineSize: 0,
    overflow: { default: 'visible', '@media (min-width: 50rem)': 'hidden' },
    padding: space.x4,
    position: { default: 'relative', '@media (min-width: 50rem)': 'sticky' },
    zIndex: 30,
  },
  wordmark: {
    alignItems: 'center',
    color: colors.text,
    display: 'inline-flex',
    fontFamily: type.familyMono,
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    letterSpacing: '-0.04em',
    minBlockSize: { default: '2.75rem', '@media (min-width: 50rem)': '2.5rem' },
    textDecoration: 'none',
  },
  search: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    boxShadow: '0 0 0 1px color-mix(in oklch, currentColor 8%, transparent)',
    color: colors.textMuted,
    display: { default: 'none', '@media (min-width: 50rem)': 'inline-flex' },
    gap: space.x2,
    inlineSize: '100%',
    minBlockSize: '2.5rem',
    paddingInline: space.x3,
  },
  searchInput: {
    appearance: 'none',
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.text,
    flex: 1,
    fontSize: '1rem',
    inlineSize: '100%',
    minInlineSize: 0,
    outlineColor: {
      default: 'transparent',
      ':focus-visible': colors.borderStrong,
    },
    outlineOffset: '3px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    padding: 0,
  },
  shortcut: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    color: colors.textMuted,
    fontFamily: type.family,
    fontSize: type.sizeCaption,
    padding: '0.125rem 0.375rem',
    whiteSpace: 'nowrap',
  },
  visuallyHidden: {
    blockSize: '1px',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    inlineSize: '1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
  sidebarNav: {
    display: 'flex',
    flex: 1,
    flexDirection: { default: 'row', '@media (min-width: 50rem)': 'column' },
    gap: space.x1,
    minBlockSize: 0,
    overflow: {
      default: 'auto hidden',
      '@media (min-width: 50rem)': 'hidden auto',
    },
  },
  sidebarLink: {
    alignItems: 'center',
    backgroundColor: {
      default: 'transparent',
      ':focus-visible': colors.surfaceHover,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
    borderRadius: radii.control,
    color: colors.textMuted,
    display: 'flex',
    flexShrink: 0,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    minBlockSize: {
      default: '2.75rem',
      '@media (min-width: 50rem)': '2.25rem',
    },
    outlineStyle: 'none',
    paddingInline: space.x3,
    textDecoration: 'none',
    transitionDuration: '140ms',
    transitionProperty: 'background-color, color',
    transitionTimingFunction: 'ease-out',
  },
  sidebarLinkActive: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  sidebarGroups: {
    display: { default: 'none', '@media (min-width: 50rem)': 'flex' },
    flexDirection: 'column',
    gap: space.x2,
    paddingBlock: space.x2,
  },
  sidebarGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  groupLink: {
    alignItems: 'center',
    backgroundColor: {
      default: 'transparent',
      ':focus-visible': colors.surfaceHover,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
    borderRadius: radii.control,
    color: colors.text,
    display: 'flex',
    fontFamily: type.familyMono,
    fontSize: type.sizeCaption,
    fontWeight: type.weightMedium,
    minBlockSize: '2rem',
    outlineStyle: 'none',
    paddingInline: space.x2,
    textDecoration: 'none',
    transitionDuration: '140ms',
    transitionProperty: 'background-color, color',
    transitionTimingFunction: 'ease-out',
  },
  componentLink: {
    alignItems: 'center',
    backgroundColor: {
      default: 'transparent',
      ':focus-visible': colors.surfaceHover,
      ':hover': {
        default: null,
        '@media (hover: hover) and (pointer: fine)': colors.surfaceHover,
      },
    },
    borderRadius: radii.control,
    color: colors.textMuted,
    display: 'flex',
    fontSize: type.sizeSmall,
    lineHeight: type.lineCompact,
    minBlockSize: '1.75rem',
    outlineStyle: 'none',
    paddingInlineEnd: space.x2,
    paddingInlineStart: space.x6,
    textDecoration: 'none',
    transitionDuration: '140ms',
    transitionProperty: 'background-color, color',
    transitionTimingFunction: 'ease-out',
  },
  sidebarFooter: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: {
      default: 'none',
      '@media (min-width: 50rem)': 'solid',
    },
    borderBlockStartWidth: { default: 0, '@media (min-width: 50rem)': '1px' },
    display: { default: 'none', '@media (min-width: 50rem)': 'block' },
    paddingBlockStart: space.x2,
  },
  main: {
    backgroundColor: colors.surfaceRaised,
    minInlineSize: 0,
  },
  overviewMain: {
    backgroundColor: colors.canvas,
    minBlockSize: 'calc(100dvh - 4.5rem)',
  },
  playgroundMain: {
    minBlockSize: 0,
    overflow: 'hidden',
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: { default: '2.5rem', '@media (min-width: 50rem)': '3.5rem' },
    marginInline: 'auto',
    maxInlineSize: '76rem',
    minInlineSize: 0,
    padding: {
      default: '2.5rem 1rem 5rem',
      '@media (min-width: 50rem)': '4.5rem 3.5rem 7rem',
    },
  },
  overviewPage: {
    gap: { default: space.x6, '@media (min-width: 50rem)': space.x8 },
    maxInlineSize: '52rem',
    padding: {
      default: '2.5rem 1rem 5rem',
      '@media (min-width: 50rem)': '3.5rem 3.5rem 5rem',
    },
  },
  explorerPage: {
    gap: space.x8,
    maxInlineSize: '82rem',
  },
  playgroundPage: {
    blockSize: '100%',
    boxSizing: 'border-box',
    gap: space.x6,
    padding: {
      default: '2rem 1rem 1rem',
      '@media (min-width: 50rem)': '2.5rem 2.5rem 1rem',
    },
  },
  pageHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
  },
  pageTitle: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: { default: '1.875rem', '@media (min-width: 50rem)': '2.25rem' },
    fontWeight: type.weightMedium,
    letterSpacing: '-0.035em',
    lineHeight: 1.1,
    margin: 0,
    textWrap: 'balance',
  },
  pageDescription: {
    color: colors.textMuted,
    fontSize: type.sizeInput,
    lineHeight: 1.5,
    margin: 0,
    maxInlineSize: '72ch',
  },
  pageDescriptionLink: {
    color: 'inherit',
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
  whyStylex: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x5,
  },
  whyStylexCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  whyStylexTitle: {
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    lineHeight: type.lineHeading,
    margin: 0,
  },
  whyStylexDescription: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '64ch',
  },
  adopterReferences: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '65ch',
  },
  adopterLink: {
    color: colors.text,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
  overviewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.x5,
  },
  overviewSectionHeader: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${space.x3} ${space.x6}`,
    justifyContent: 'space-between',
  },
  overviewSectionTitle: {
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    lineHeight: type.lineHeading,
    margin: 0,
  },
  overviewItemTitle: {
    fontSize: type.sizeInput,
    fontWeight: type.weightMedium,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  capabilities: {
    display: 'grid',
    gap: space.x3,
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 50rem)': 'repeat(2, minmax(0, 1fr))',
    },
  },
  capability: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    gap: space.x3,
    minInlineSize: 0,
    padding: space.x4,
    textDecoration: 'none',
  },
  capabilityFeatured: {
    alignItems: { default: 'stretch', '@media (min-width: 50rem)': 'center' },
    gridColumn: { default: 'auto', '@media (min-width: 50rem)': '1 / -1' },
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 50rem)': 'minmax(11rem, 0.7fr) minmax(0, 1.3fr)',
    },
    display: { default: 'flex', '@media (min-width: 50rem)': 'grid' },
    minBlockSize: { default: 'auto', '@media (min-width: 50rem)': '11rem' },
  },
  capabilityCopy: {
    minBlockSize: 'auto',
  },
  capabilityLink: {
    color: 'inherit',
    textDecoration: 'none',
    ':hover': {
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
  },
  capabilityPreview: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.surface,
    display: 'flex',
    flex: 1,
    inlineSize: '100%',
    minBlockSize: '7rem',
    minInlineSize: 0,
    overflow: 'hidden',
    padding: space.x4,
  },
  messagePreview: {
    inlineSize: '100%',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  sectionLink: {
    color: colors.textMuted,
    fontSize: type.sizeSmall,
    fontWeight: type.weightMedium,
    textDecoration: 'none',
    ':hover': {
      color: colors.text,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    boxShadow: 'var(--example-shadow)',
    minInlineSize: 0,
    overflow: 'hidden',
  },
  playgroundPreview: {
    flex: 1,
    minBlockSize: 0,
  },
  detail: {
    marginInline: 'auto',
    maxInlineSize: '62rem',
    padding: {
      default: '2.5rem 1rem 5rem',
      '@media (min-width: 50rem)': '6rem 3.5rem 7rem',
    },
  },
  hero: {
    fontSize: 'clamp(2.5rem, 5vw, 4.75rem)',
    letterSpacing: '-0.055em',
    lineHeight: 0.98,
    margin: 0,
    textWrap: 'balance',
  },
  lede: {
    color: colors.textMuted,
    fontSize: '1.125rem',
    lineHeight: 1.55,
    marginBlock: '1.5rem 0',
    maxInlineSize: '58ch',
  },
  sectionTitle: { fontSize: type.sizeInput, margin: 0 },
  detailSection: { marginBlockStart: '4rem' },
  docs: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
    display: 'grid',
    gap: '3rem',
    gridTemplateColumns: {
      default: '1fr',
      '@media (min-width: 42rem)': '1fr 1fr',
    },
    marginBlockStart: '4rem',
    paddingBlockStart: space.x8,
  },
  body: { color: colors.textMuted, lineHeight: 1.6 },
})
const themeStyles = stylex.create({
  light: {
    colorScheme: 'light',
    '--example-shadow':
      '0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04)',
  },
  dark: {
    colorScheme: 'dark',
    '--example-shadow': '0 0 0 1px oklch(1 0 0 / 0.12)',
  },
})
