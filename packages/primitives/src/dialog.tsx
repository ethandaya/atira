import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { colors, radii, shadows, space, type } from '@pretty-amped/foundations/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, PresenceSurface } from './presence'

/** Unstyled Base UI parts for layouts that cannot use the convenience wrapper. */
export const DialogParts = BaseDialog

export type DialogProps = {
  actions?: ReactNode
  children: ReactNode
  closeLabel?: ReactNode
  defaultOpen?: boolean
  description: ReactNode
  headingLevel?: 2 | 3 | 4 | 5 | 6
  onOpenChange?: (open: boolean) => void
  open?: boolean
  title: ReactNode
  trigger: ReactNode
}

export function Dialog({ actions, children, closeLabel = 'Close', defaultOpen, description, headingLevel = 2, onOpenChange, open, title, trigger }: DialogProps) {
  const portalContainerRef = useRef<HTMLSpanElement>(null)
  const Heading = `h${headingLevel}` as const
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false)
  const [immediate, setImmediate] = useState(false)
  const isOpen = open ?? localOpen

  return (
    <span ref={portalContainerRef} data-slot="dialog" {...stylex.props(styles.container)}>
      <BaseDialog.Root onOpenChange={(next, details) => {
        setImmediate(details.event.type.startsWith('key'))
        setLocalOpen(next)
        onOpenChange?.(next)
      }} open={isOpen}>
        <BaseDialog.Trigger data-slot="dialog-trigger" {...stylex.props(styles.trigger)}>{trigger}</BaseDialog.Trigger>
        <AnimatePresence initial={false}>
        {isOpen && <BaseDialog.Portal keepMounted container={portalContainerRef}>
          <BaseDialog.Backdrop render={<PresenceSurface immediate={immediate} kind="overlay" />} data-slot="dialog-backdrop" {...stylex.props(styles.backdrop)} />
          <BaseDialog.Viewport data-slot="dialog-viewport" {...stylex.props(styles.viewport)}>
            <BaseDialog.Popup render={<PresenceSurface immediate={immediate} />} data-slot="dialog-content" {...stylex.props(styles.popup)}>
              <div data-slot="dialog-header" {...stylex.props(styles.header)}>
                <BaseDialog.Title render={<Heading />} data-slot="dialog-title" {...stylex.props(styles.title)}>{title}</BaseDialog.Title>
                <BaseDialog.Description data-slot="dialog-description" {...stylex.props(styles.description)}>{description}</BaseDialog.Description>
              </div>
              <div data-slot="dialog-body" {...stylex.props(styles.body)}>{children}</div>
              <div data-slot="dialog-actions" {...stylex.props(styles.actions)}>
                {actions}
                <BaseDialog.Close data-slot="dialog-close" {...stylex.props(styles.trigger)}>{closeLabel}</BaseDialog.Close>
              </div>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>}
        </AnimatePresence>
      </BaseDialog.Root>
    </span>
  )
}

const styles = stylex.create({
  container: { display: 'inline-flex' },
  trigger: { alignItems: 'center', appearance: 'none', backgroundColor: { default: colors.surfaceMuted, ':hover': { default: null, '@media (hover: hover) and (pointer: fine)': colors.surfaceHover }, ':active': colors.surfaceSelected }, borderColor: 'transparent', borderRadius: radii.control, borderStyle: 'solid', borderWidth: '1px', color: colors.text, cursor: 'pointer', display: 'inline-flex', fontFamily: type.family, fontSize: type.sizeSmall, fontWeight: type.weightMedium, justifyContent: 'center', lineHeight: type.lineCompact, minBlockSize: { default: '2rem', '@media (hover: none)': '2.75rem' }, outlineColor: { default: 'transparent', ':focus-visible': colors.focus }, outlineOffset: 0, outlineStyle: 'solid', outlineWidth: '3px', paddingInline: space.x3, touchAction: 'manipulation' },
  backdrop: { backgroundColor: 'oklch(0 0 0 / 0.35)', inset: 0, position: 'fixed', zIndex: 100 },
  viewport: { alignItems: 'center', display: 'flex', inset: 0, justifyContent: 'center', padding: space.x6, position: 'fixed', zIndex: 101 },
  popup: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radii.surface, borderStyle: 'solid', borderWidth: '1px', boxShadow: shadows.overlay, boxSizing: 'border-box', color: colors.text, display: 'flex', flexDirection: 'column', gap: space.x4, maxBlockSize: 'calc(100dvh - 3rem)', maxInlineSize: '32rem', outlineColor: { default: 'transparent', ':focus-visible': colors.focus }, outlineStyle: 'solid', outlineWidth: '3px', overflow: 'auto', padding: space.x6, width: '100%' },
  header: { display: 'flex', flexDirection: 'column', gap: space.x2 },
  title: { fontFamily: type.family, fontSize: type.sizeInput, fontWeight: type.weightStrong, lineHeight: type.lineCompact, margin: 0 },
  description: { color: colors.textMuted, fontFamily: type.family, fontSize: type.sizeSmall, lineHeight: type.lineBody, margin: 0 },
  body: { fontFamily: type.family, fontSize: type.sizeBody, lineHeight: type.lineBody },
  actions: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: space.x2, justifyContent: 'flex-end' },
})
