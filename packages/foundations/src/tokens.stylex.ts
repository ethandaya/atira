import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
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
  surface: '0.75rem',
})

export const type = stylex.defineVars({
  family:
    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  sizeCaption: '0.75rem',
  sizeSmall: '0.8125rem',
  sizeBody: '0.9375rem',
  sizeInput: '1rem',
  sizeTitle: '1rem',
  lineCompact: '1.3',
  lineBody: '1.55',
  weightRegular: '400',
  weightMedium: '500',
  weightStrong: '600',
})

export const motion = stylex.defineVars({
  durationFast: '120ms',
  durationModerate: '180ms',
  easingStandard: 'cubic-bezier(0.23, 1, 0.32, 1)',
})
