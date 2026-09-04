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
  control: '0.4375rem',
  inset: '0.5rem',
  popover: '0.625rem',
  surface: '0.75rem',
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
  durationInstant: '100ms',
  durationFast: '140ms',
  durationEnter: '180ms',
  durationModerate: '220ms',
  durationStructural: '240ms',
  easingEnter: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easingMove: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easingStandard: 'cubic-bezier(0.22, 1, 0.36, 1)',
})

export const shadows = stylex.defineVars({
  raised:
    '0 0 0 0.5px color-mix(in oklab, currentColor 10%, transparent), 0 1px 2px oklch(0 0 0 / 0.05), 0 2px 4px oklch(0 0 0 / 0.02)',
  overlay:
    '0 0 0 0.5px color-mix(in oklab, currentColor 14%, transparent), 0 4px 12px -2px oklch(0 0 0 / 0.12), 0 16px 36px -12px oklch(0 0 0 / 0.18)',
})
