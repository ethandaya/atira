import { colors, space, type } from '@atira/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'

export const appStyles = stylex.create({
  app: {
    backgroundColor: colors.canvas,
    blockSize: '100dvh',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: type.family,
    minBlockSize: '30rem',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.canvas,
    flexShrink: 0,
  },
  headerInner: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    gap: space.x2,
    inlineSize: '100%',
    justifyContent: 'space-between',
    marginInline: 'auto',
    maxInlineSize: '52rem',
    minBlockSize: '3rem',
    paddingInline: space.x4,
  },
  reviewHeader: {
    flexWrap: 'wrap',
    paddingBlock: space.x2,
  },
  identity: {
    alignItems: 'baseline',
    display: {
      default: 'none',
      '@media (min-width: 36rem)': 'flex',
    },
    gap: space.x2,
    minInlineSize: 0,
  },
  title: {
    fontSize: type.sizeBody,
    fontWeight: type.weightStrong,
    lineHeight: type.lineCompact,
    margin: 0,
  },
  product: {
    color: colors.textMuted,
    display: {
      default: 'none',
      '@media (min-width: 40rem)': 'inline',
    },
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
  },
  headerActions: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: space.x1,
  },
  workspace: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minBlockSize: 0,
  },
  emptyState: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x4,
    inlineSize: '100%',
    marginInline: 'auto',
    maxInlineSize: '40rem',
    textAlign: 'center',
  },
  emptyCopy: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: space.x2,
  },
  emptyTitle: {
    fontSize: type.sizeHeading,
    fontWeight: type.weightStrong,
    lineHeight: type.lineHeading,
    margin: 0,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: type.sizeBody,
    lineHeight: type.lineBody,
    margin: 0,
    maxInlineSize: '58ch',
  },
  runtimeMeta: {
    color: colors.textMuted,
    display: 'block',
    fontSize: type.sizeCaption,
    lineHeight: type.lineCompact,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  runtimeError: {
    color: colors.danger,
  },
})

export const themeStyles = stylex.create({
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
})
