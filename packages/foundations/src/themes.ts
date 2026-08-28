import * as stylex from '@stylexjs/stylex'

import { colors } from './tokens.stylex'

export const lightTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.975 0.004 260)',
  surface: 'oklch(0.995 0.002 260)',
  surfaceMuted: 'oklch(0.955 0.006 260)',
  text: 'oklch(0.205 0.012 260)',
  textMuted: 'oklch(0.49 0.014 260)',
  border: 'oklch(0.885 0.008 260)',
  borderStrong: 'oklch(0.79 0.012 260)',
  accent: 'oklch(0.49 0.19 264)',
  accentHover: 'oklch(0.445 0.19 264)',
  accentPressed: 'oklch(0.405 0.18 264)',
  onAccent: 'oklch(0.985 0.002 260)',
  danger: 'oklch(0.51 0.19 25)',
  dangerHover: 'oklch(0.46 0.19 25)',
  dangerPressed: 'oklch(0.415 0.18 25)',
  onDanger: 'oklch(0.985 0.002 25)',
  focus: 'oklch(0.62 0.18 255)',
})

export const darkTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.165 0.008 260)',
  surface: 'oklch(0.205 0.01 260)',
  surfaceMuted: 'oklch(0.255 0.012 260)',
  text: 'oklch(0.94 0.006 260)',
  textMuted: 'oklch(0.7 0.012 260)',
  border: 'oklch(0.31 0.012 260)',
  borderStrong: 'oklch(0.43 0.014 260)',
  accent: 'oklch(0.76 0.13 264)',
  accentHover: 'oklch(0.81 0.12 264)',
  accentPressed: 'oklch(0.7 0.14 264)',
  onAccent: 'oklch(0.17 0.015 264)',
  danger: 'oklch(0.73 0.14 25)',
  dangerHover: 'oklch(0.78 0.13 25)',
  dangerPressed: 'oklch(0.67 0.15 25)',
  onDanger: 'oklch(0.18 0.015 25)',
  focus: 'oklch(0.78 0.13 250)',
})
