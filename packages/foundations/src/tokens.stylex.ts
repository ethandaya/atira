import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
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
  control: '0.625rem',
  surface: '0.875rem',
})

export const type = stylex.defineVars({
  family:
    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  sizeSmall: '0.875rem',
  sizeBody: '1rem',
  sizeTitle: '1.125rem',
  lineCompact: '1.25',
  lineBody: '1.5',
  weightRegular: '400',
  weightMedium: '550',
  weightStrong: '650',
})

export const motion = stylex.defineVars({
  durationFast: '120ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
})
