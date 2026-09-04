import { AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'

/** Shared presence language; no layout measurements or per-frame React state. */
export function PresenceSurface({
  kind = 'panel',
  immediate = false,
  ...props
}: HTMLMotionProps<'div'> & {
  immediate?: boolean
  kind?: 'panel' | 'overlay' | 'content'
}) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  const instant = reduced || immediate
  const transform = kind === 'panel'
    ? 'translateY(4px) scale(0.98)'
    : kind === 'content'
      ? 'translateY(3px)'
      : 'none'
  const rest = kind === 'panel' ? 'translateY(0px) scale(1)' : kind === 'content' ? 'translateY(0px)' : 'none'

  return (
    <motion.div
      {...props}
      inert={!present || props.inert}
      aria-hidden={!present || props['aria-hidden']}
      initial={instant ? false : { opacity: 0, transform }}
      animate={{ opacity: 1, transform: rest }}
      exit={{ opacity: 0, transform, transition: { duration: instant ? 0 : 0.12 } }}
      transition={{ duration: instant ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

/** Cross-fades state marks in one fixed slot; never duplicates live regions. */
export function StateTransition({ children, state, size = 14 }: { children: ReactNode; state: string; size?: 14 | 16 | 20 }) {
  const reduced = useReducedMotion()
  return (
    <span aria-hidden="true" {...stylex.props(styles.slot, styles.size(size))}>
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          {...stylex.props(styles.mark)}
          initial={reduced ? false : { opacity: 0, transform: 'scale(0.85)' }}
          animate={{ opacity: 1, transform: 'scale(1)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.12, ease: 'easeOut' }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export { AnimatePresence } from 'motion/react'

const styles = stylex.create({
  slot: { display: 'inline-grid', placeItems: 'center' },
  size: (size: number) => ({ inlineSize: `${size}px`, blockSize: `${size}px` }),
  mark: { gridArea: '1 / 1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
})
