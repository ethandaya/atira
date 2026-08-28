import * as stylex from '@stylexjs/stylex'

import { colors } from './tokens.stylex'

export const lightTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.985 0.003 260)',
  surface: 'oklch(0.998 0.001 260)',
  surfaceMuted: 'oklch(0.96 0.004 260)',
  text: 'oklch(0.205 0.01 260)',
  textMuted: 'oklch(0.5 0.012 260)',
  border: 'oklch(0.9 0.006 260)',
  borderStrong: 'oklch(0.82 0.009 260)',
  accent: 'oklch(0.235 0.012 260)',
  accentHover: 'oklch(0.29 0.014 260)',
  accentPressed: 'oklch(0.34 0.014 260)',
  onAccent: 'oklch(0.985 0.002 260)',
  danger: 'oklch(0.51 0.19 25)',
  dangerHover: 'oklch(0.46 0.19 25)',
  dangerPressed: 'oklch(0.415 0.18 25)',
  onDanger: 'oklch(0.985 0.002 25)',
  focus: 'oklch(0.64 0.16 255)',
})

export const darkTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.165 0.006 260)',
  surface: 'oklch(0.205 0.008 260)',
  surfaceMuted: 'oklch(0.255 0.01 260)',
  text: 'oklch(0.94 0.005 260)',
  textMuted: 'oklch(0.69 0.01 260)',
  border: 'oklch(0.3 0.01 260)',
  borderStrong: 'oklch(0.42 0.012 260)',
  accent: 'oklch(0.94 0.005 260)',
  accentHover: 'oklch(0.88 0.008 260)',
  accentPressed: 'oklch(0.82 0.01 260)',
  onAccent: 'oklch(0.19 0.01 260)',
  danger: 'oklch(0.73 0.14 25)',
  dangerHover: 'oklch(0.78 0.13 25)',
  dangerPressed: 'oklch(0.67 0.15 25)',
  onDanger: 'oklch(0.18 0.015 25)',
  focus: 'oklch(0.76 0.12 250)',
})
