import * as stylex from '@stylexjs/stylex'

import { colors } from './tokens.stylex'

export const lightTheme = stylex.createTheme(colors, {
  canvas: 'oklch(1 0 0)',
  surface: 'oklch(1 0 0)',
  surfaceMuted: 'oklch(0.97 0 0)',
  text: 'oklch(0.145 0 0)',
  textMuted: 'oklch(0.52 0 0)',
  border: 'oklch(0 0 0 / 0.08)',
  borderStrong: 'oklch(0 0 0 / 0.14)',
  accent: 'oklch(0.205 0 0)',
  accentHover: 'oklch(0.32 0 0)',
  accentPressed: 'oklch(0.26 0 0)',
  onAccent: 'oklch(0.985 0 0)',
  danger: 'oklch(0.52 0.22 27.325)',
  dangerSurface: 'oklch(0.52 0.22 27.325 / 0.1)',
  dangerSurfaceHover: 'oklch(0.52 0.22 27.325 / 0.15)',
  success: 'oklch(0.43 0.11 145)',
  successSurface: 'oklch(0.43 0.11 145 / 0.1)',
  warning: 'oklch(0.5 0.12 75)',
  warningSurface: 'oklch(0.5 0.12 75 / 0.1)',
  focus: 'oklch(0.708 0 0 / 0.5)',
})

export const darkTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.145 0 0)',
  surface: 'oklch(0.205 0 0)',
  surfaceMuted: 'oklch(0.269 0 0)',
  text: 'oklch(0.985 0 0)',
  textMuted: 'oklch(0.708 0 0)',
  border: 'oklch(0.29 0 0)',
  borderStrong: 'oklch(0.36 0 0)',
  accent: 'oklch(0.922 0 0)',
  accentHover: 'oklch(0.82 0 0)',
  accentPressed: 'oklch(0.88 0 0)',
  onAccent: 'oklch(0.205 0 0)',
  danger: 'oklch(0.704 0.191 22.216)',
  dangerSurface: 'oklch(0.704 0.191 22.216 / 0.2)',
  dangerSurfaceHover: 'oklch(0.704 0.191 22.216 / 0.3)',
  success: 'oklch(0.75 0.12 145)',
  successSurface: 'oklch(0.75 0.12 145 / 0.16)',
  warning: 'oklch(0.78 0.12 75)',
  warningSurface: 'oklch(0.78 0.12 75 / 0.16)',
  focus: 'oklch(0.556 0 0 / 0.5)',
})
