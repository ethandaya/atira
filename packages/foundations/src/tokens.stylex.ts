import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  canvas: 'oklch(0.985 0.003 250)',
  surface: 'oklch(0.998 0.001 250)',
  surfaceRaised: 'oklch(1 0 0)',
  surfaceInset: 'oklch(0.96 0.004 250)',
  surfaceMuted: 'oklch(0.972 0.003 250)',
  surfaceHover: 'oklch(0.945 0.005 250)',
  surfaceSelected: 'oklch(0.925 0.008 250)',
  text: 'oklch(0.18 0.008 250)',
  textMuted: 'oklch(0.46 0.012 250)',
  textDisabled: 'oklch(0.62 0.006 250)',
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
  sizeTitle: '0.9375rem',
  sizeHeading: '1.0625rem',
  lineCompact: '1.3',
  lineBody: '1.55',
  lineHeading: '1.2',
  weightRegular: '400',
  weightMedium: '500',
  weightStrong: '600',
})

export const motion = stylex.defineVars({
  durationFast: '140ms',
  durationModerate: '200ms',
  easingStandard: 'cubic-bezier(0.32, 0.72, 0, 1)',
})

export const shadows = stylex.defineVars({
  raised:
    '0 0 0 1px oklch(0 0 0 / 0.025), 0 1px 2px oklch(0 0 0 / 0.035), 0 6px 18px -10px oklch(0 0 0 / 0.12)',
  overlay:
    '0 0 0 1px oklch(0 0 0 / 0.04), 0 8px 24px -8px oklch(0 0 0 / 0.18), 0 24px 48px -20px oklch(0 0 0 / 0.24)',
})
