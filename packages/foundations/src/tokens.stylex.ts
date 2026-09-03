import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
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
  focus: 'oklch(0.708 0 0 / 0.5)',
})

export const space = stylex.defineVars({
  x1: '0.25rem',
  x2: '0.5rem',
  x3: '0.75rem',
  x4: '1rem',
  x5: '1.25rem',
  x6: '1.5rem',
  x8: '2rem',
})

export const radii = stylex.defineVars({
  control: '0.5rem',
  surface: '0.625rem',
})

export const type = stylex.defineVars({
  family:
    '"Geist Variable", "Helvetica Neue", Arial, sans-serif',
  familyMono:
    '"Geist Mono Variable", "SFMono-Regular", Consolas, monospace',
  sizeCaption: '0.75rem',
  sizeSmall: '0.8125rem',
  sizeBody: '0.875rem',
  sizeInput: '1rem',
  sizeTitle: '0.875rem',
  lineCompact: '1.25',
  lineBody: '1.625',
  weightRegular: '400',
  weightMedium: '500',
  weightStrong: '600',
})

export const motion = stylex.defineVars({
  durationFast: '150ms',
  durationModerate: '180ms',
  easingStandard: 'ease',
})
