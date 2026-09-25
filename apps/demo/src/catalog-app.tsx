import { darkTheme, lightTheme } from '@pretty-amped/foundations/themes'
import { colors, space, type } from '@pretty-amped/foundations/tokens.stylex'
import { Button } from '@pretty-amped/primitives'
import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense, useEffect, useState } from 'react'

import { catalog, CatalogPreview, type CatalogEntry } from './catalog'

type Theme = 'light' | 'dark'
const FullGallery = lazy(() => import('./component-gallery').then((module) => ({ default: module.ComponentGallery })))

export function CatalogApp() {
  const [theme, setTheme] = useState<Theme>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const component = new URLSearchParams(window.location.search).get('component')
  const entry = catalog.find((item) => item.id === component)
  const pageName = entry?.name ?? 'Components'

  useEffect(() => {
    document.title = `${pageName} — Pretty Amped`
  }, [pageName])

  return (
    <div data-theme={theme} {...stylex.props(theme === 'dark' ? darkTheme : lightTheme, styles.shell, themeStyles[theme])}>
      <a href="#catalog-content" {...stylex.props(styles.skip)}>Skip to content</a>
      <header {...stylex.props(styles.header)}>
        <a href="/" {...stylex.props(styles.wordmark)}>Pretty Amped</a>
        <nav aria-label="Demo views" {...stylex.props(styles.actions)}>
          <a href="/?view=playground" {...stylex.props(styles.link)}>Live playground</a>
          <Button variant="quiet" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'} theme
          </Button>
        </nav>
      </header>
      <main id="catalog-content" tabIndex={-1} aria-label={pageName}>
        {entry ? <Detail entry={entry} /> : (
          <Suspense fallback={<p {...stylex.props(styles.loading)}>Loading examples…</p>}>
            <FullGallery />
          </Suspense>
        )}
      </main>
    </div>
  )
}

function Detail({ entry }: { entry: CatalogEntry }) {
  return (
    <article {...stylex.props(styles.detail)}>
      <header>
        <h1 {...stylex.props(styles.hero)}>{entry.name}</h1>
        <p {...stylex.props(styles.lede)}>{entry.description}</p>
      </header>
      <section aria-labelledby="preview-heading" {...stylex.props(styles.detailSection)}>
        <h2 id="preview-heading" {...stylex.props(styles.sectionTitle)}>Preview</h2>
        <CatalogPreview id={entry.id} showSource />
      </section>
      <section aria-label="Component guidance" {...stylex.props(styles.docs)}>
        <div>
          <h2 {...stylex.props(styles.sectionTitle)}>Props and customization</h2>
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
  shell: { backgroundColor: colors.canvas, color: colors.text, fontFamily: type.family, minBlockSize: '100dvh' },
  skip: { backgroundColor: colors.surfaceRaised, color: colors.text, insetBlockStart: space.x4, insetInlineStart: space.x4, padding: space.x3, position: 'fixed', transform: { default: 'translateY(-200%)', ':focus': 'translateY(0)' }, zIndex: 100 },
  header: { alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: space.x2, marginInline: 'auto', maxInlineSize: '68rem', minBlockSize: '3.5rem', paddingInline: { default: space.x4, '@media (min-width: 48rem)': space.x6 } },
  wordmark: { alignItems: 'center', color: colors.text, display: 'inline-flex', fontSize: type.sizeBody, fontWeight: type.weightStrong, minBlockSize: '2.75rem', textDecoration: 'none' },
  actions: { alignItems: 'center', display: 'flex', gap: space.x2 },
  link: { alignItems: 'center', color: colors.text, display: 'inline-flex', fontSize: type.sizeCaption, minBlockSize: '2.75rem', textDecoration: 'none' },
  detail: { marginInline: 'auto', maxInlineSize: '62rem', padding: { default: '3.5rem 1.25rem 5rem', '@media (min-width: 50.01rem)': '5.5rem 3.5rem 7rem' } },
  hero: { fontSize: 'clamp(2.5rem, 5vw, 4.75rem)', letterSpacing: '-0.055em', lineHeight: 0.98, margin: 0, textWrap: 'balance' },
  lede: { color: colors.textMuted, fontSize: '1.125rem', lineHeight: 1.55, marginBlock: '1.5rem 0', maxInlineSize: '58ch' },
  sectionTitle: { fontSize: type.sizeInput, margin: 0 },
  detailSection: { marginBlockStart: '4rem' },
  docs: { borderBlockStartColor: colors.border, borderBlockStartStyle: 'solid', borderBlockStartWidth: '1px', display: 'grid', gap: '3rem', gridTemplateColumns: { default: '1fr', '@media (min-width: 42rem)': '1fr 1fr' }, marginBlockStart: '4rem', paddingBlockStart: space.x8 },
  body: { color: colors.textMuted, lineHeight: 1.6 },
  loading: { padding: '4rem' },
})
const themeStyles = stylex.create({
  light: {
    colorScheme: 'light',
    '--example-shadow': '0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04)',
  },
  dark: {
    colorScheme: 'dark',
    '--example-shadow': '0 0 0 1px oklch(1 0 0 / 0.12)',
  },
})
