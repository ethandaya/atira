import * as stylex from '@stylexjs/stylex'
import type { CSSProperties } from 'react'

/**
 * Styling escape hatches shared by public DOM-backed components.
 * StyleX styles are resolved after component defaults and variants. Ordinary
 * classes are retained, and caller inline styles are applied last.
 */
export type StyleProps = {
  className?: string
  style?: CSSProperties
  xstyle?: stylex.StyleXStyles
}

export function resolveStyleProps(
  defaults: stylex.StyleXStyles,
  xstyle: stylex.StyleXStyles | undefined,
  className: string | undefined,
  style: CSSProperties | undefined,
): { className: string | undefined; style: CSSProperties } {
  const resolved = stylex.props(defaults, xstyle)
  return {
    className: [resolved.className, className].filter(Boolean).join(' ') || undefined,
    style: { ...resolved.style, ...style },
  }
}
