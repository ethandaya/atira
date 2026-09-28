import * as stylex from '@stylexjs/stylex'

import { chatAppearance, colors, radii, shadows } from './tokens.stylex'

export const lightTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.99 0.002 85)',
  surface: 'oklch(0.997 0.001 85)',
  surfaceRaised: 'oklch(1 0 0)',
  surfaceInset: 'oklch(0.98 0.002 85)',
  surfaceMuted: 'oklch(0.97 0.002 85)',
  surfaceHover: 'oklch(0.955 0.002 85)',
  surfaceSelected: 'oklch(0.935 0.002 85)',
  text: 'oklch(0.235 0.003 85)',
  textMuted: 'oklch(0.475 0.004 85)',
  textDisabled: 'oklch(0.65 0.003 85)',
  border: 'oklch(0 0 0 / 0.075)',
  borderStrong: 'oklch(0 0 0 / 0.16)',
  accent: 'oklch(0.265 0.004 85)',
  accentHover: 'oklch(0.315 0.004 85)',
  accentPressed: 'oklch(0.21 0.004 85)',
  onAccent: 'oklch(0.99 0.001 85)',
  danger: 'oklch(0.5 0.17 27)',
  dangerSurface: 'oklch(0.5 0.17 27 / 0.1)',
  dangerSurfaceHover: 'oklch(0.5 0.17 27 / 0.15)',
  success: 'oklch(0.45 0.09 155)',
  successSurface: 'oklch(0.45 0.09 155 / 0.1)',
  warning: 'oklch(0.49 0.09 75)',
  warningSurface: 'oklch(0.49 0.09 75 / 0.1)',
  focus: 'oklch(0.53 0.16 260)',
})

const darkColors = {
  canvas: 'oklch(0.18 0.003 85)',
  surface: 'oklch(0.215 0.003 85)',
  surfaceRaised: 'oklch(0.255 0.004 85)',
  surfaceInset: 'oklch(0.195 0.003 85)',
  surfaceMuted: 'oklch(0.28 0.004 85)',
  surfaceHover: 'oklch(0.315 0.004 85)',
  surfaceSelected: 'oklch(0.35 0.005 85)',
  text: 'oklch(0.925 0.003 85)',
  textMuted: 'oklch(0.73 0.004 85)',
  textDisabled: 'oklch(0.52 0.004 85)',
  border: 'oklch(0.29 0.004 85)',
  borderStrong: 'oklch(0.4 0.004 85)',
  accent: 'oklch(0.91 0.004 85)',
  accentHover: 'oklch(0.965 0.003 85)',
  accentPressed: 'oklch(0.84 0.004 85)',
  onAccent: 'oklch(0.2 0.003 85)',
  danger: 'oklch(0.73 0.145 27)',
  dangerSurface: 'oklch(0.73 0.145 27 / 0.2)',
  dangerSurfaceHover: 'oklch(0.73 0.145 27 / 0.3)',
  success: 'oklch(0.76 0.105 155)',
  successSurface: 'oklch(0.76 0.105 155 / 0.16)',
  warning: 'oklch(0.79 0.1 75)',
  warningSurface: 'oklch(0.79 0.1 75 / 0.16)',
  focus: 'oklch(0.73 0.125 260)',
}

export const darkTheme = stylex.createTheme(colors, darkColors)

// Exploratory house style, opt-in at the theme boundary rather than component props.
export const warmLightTheme = stylex.createTheme(colors, {
  canvas: 'oklch(0.974 0.008 80)',
  surface: 'oklch(0.99 0.004 80)',
  surfaceRaised: 'oklch(0.997 0.002 80)',
  surfaceInset: 'oklch(0.94 0.009 80)',
  surfaceMuted: 'oklch(0.955 0.008 80)',
  surfaceHover: 'oklch(0.925 0.009 80)',
  surfaceSelected: 'oklch(0.9 0.01 80)',
  text: 'oklch(0.245 0.012 60)',
  textMuted: 'oklch(0.465 0.015 60)',
  textDisabled: 'oklch(0.6 0.01 60)',
  accent: 'oklch(0.515 0.145 42)',
  accentHover: 'oklch(0.47 0.135 42)',
  accentPressed: 'oklch(0.44 0.125 42)',
  onAccent: 'oklch(0.995 0 0)',
  focus: 'oklch(0.465 0 0)',
})

export const warmDarkTheme = stylex.createTheme(colors, {
  ...darkColors,
  canvas: 'oklch(0.18 0.007 80)',
  surface: 'oklch(0.205 0.007 80)',
  surfaceRaised: 'oklch(0.245 0.007 80)',
  surfaceInset: 'oklch(0.155 0.007 80)',
  surfaceMuted: 'oklch(0.225 0.007 80)',
  surfaceHover: 'oklch(0.29 0.008 80)',
  surfaceSelected: 'oklch(0.33 0.008 80)',
  text: 'oklch(0.95 0.006 80)',
  textMuted: 'oklch(0.735 0.01 80)',
  textDisabled: 'oklch(0.52 0.007 80)',
  border: 'oklch(0.31 0.007 80)',
  borderStrong: 'oklch(0.395 0.008 80)',
  accent: 'oklch(0.76 0.12 48)',
  accentHover: 'oklch(0.81 0.1 48)',
  accentPressed: 'oklch(0.71 0.12 48)',
  onAccent: 'oklch(0.19 0.01 60)',
  focus: 'oklch(0.75 0 0)',
})

export const warmGeometry = stylex.createTheme(radii, {
  control: '0.5rem',
  inset: '0.75rem',
  popover: '0.875rem',
  surface: '1.25rem',
})

export const warmShadows = stylex.createTheme(shadows, {
  raised:
    '0 0 0 1px oklch(0 0 0 / 0.07), 0 2px 3px oklch(0 0 0 / 0.025), 0 12px 28px -12px oklch(0 0 0 / 0.13)',
})

export const warmDarkShadows = stylex.createTheme(shadows, {
  raised: '0 0 0 1px oklch(1 0 0 / 0.12)',
  overlay:
    '0 0 0 1px oklch(1 0 0 / 0.16), 0 16px 36px -12px oklch(0 0 0 / 0.4)',
})

const warmChatValues = {
  readingSize: '1rem',
  activitySurface: 'transparent',
  activityBorder: 'transparent',
  inputPaddingBlock: '1.25rem',
  inputPaddingInline: '1.25rem',
  composerFocusOffset: '4px',
  composerFocusShadow:
    '0 0 0 1px oklch(0 0 0 / 0.12), 0 6px 12px -6px oklch(0 0 0 / 0.08), 0 18px 36px -14px oklch(0 0 0 / 0.15)',
  composerToolbarSurface: colors.surfaceMuted,
  requestTitleSize: '1.125rem',
  requestGap: '0.75rem',
  shimmerIterations: '0',
}

export const warmChat = stylex.createTheme(chatAppearance, warmChatValues)

export const warmDarkChat = stylex.createTheme(chatAppearance, {
  ...warmChatValues,
  composerFocusShadow: '0 0 0 1px oklch(1 0 0 / 0.22)',
})

export const warmPrecision = {
  light: [warmLightTheme, warmGeometry, warmShadows, warmChat],
  dark: [warmDarkTheme, warmGeometry, warmDarkShadows, warmDarkChat],
}
