import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
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
  inset: '0.5rem',
  popover: '0.75rem',
  surface: '0.75rem',
  panel: '1.125rem',
})

export const type = stylex.defineVars({
  family:
    '"Geist Variable", "Helvetica Neue", Arial, sans-serif',
  familyMono:
    '"Geist Mono Variable", "SFMono-Regular", Consolas, monospace',
  // Metadata: 13px; controls: 14px; reading: 15px; mobile input: 16px; headings: 17px.
  sizeCaption: '0.8125rem',
  sizeSmall: '0.875rem',
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
  easingEnter: 'cubic-bezier(0.32, 0.72, 0, 1)',
  easingMove: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easingStandard: 'cubic-bezier(0.22, 1, 0.36, 1)',
})

export const shadows = stylex.defineVars({
  inset:
    'inset 0 1px 2px oklch(0 0 0 / 0.025)',
  raised:
    '0 2px 6px -2px oklch(0 0 0 / 0.06), 0 8px 24px -8px oklch(0 0 0 / 0.1)',
  control:
    'inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.07)',
  overlay:
    '0 0 0 0.5px color-mix(in oklab, currentColor 14%, transparent), 0 4px 12px -2px oklch(0 0 0 / 0.12), 0 16px 36px -12px oklch(0 0 0 / 0.18)',
})

// Chat roles share one default; consumers can override these at the theme boundary.
export const chatAppearance = stylex.defineVars({
  readingSize: '0.9375rem',
  activitySurface: 'transparent',
  activityBorder: 'transparent',
  inputPaddingBlock: '1rem',
  inputPaddingInline: '1rem',
  composerShadow: '0 0 0 1px color-mix(in oklch, currentColor 12%, transparent)',
  composerFocusOffset: '3px',
  composerFocusShadow: 'initial',
  composerToolbarSurface: 'initial',
  requestTitleSize: '1.0625rem',
  requestGap: '0.75rem',
  shimmerIterations: '0',
})
