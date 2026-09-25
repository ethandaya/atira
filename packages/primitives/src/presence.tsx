// react-doctor-disable-next-line react-doctor/use-lazy-motion -- Standalone presence primitives need layout features without a consumer-owned LazyMotion provider.
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from 'motion/react'
import { forwardRef, type ReactNode } from 'react'
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
  const transform =
    kind === 'panel'
      ? 'translateY(4px) scale(0.98)'
      : kind === 'content'
        ? 'translateY(3px)'
        : 'none'
  const rest =
    kind === 'panel'
      ? 'translateY(0px) scale(1)'
      : kind === 'content'
        ? 'translateY(0px)'
        : 'none'

  return (
    <motion.div
      {...props}
      data-presence={present ? 'present' : 'exiting'}
      inert={!present || props.inert}
      aria-hidden={!present || props['aria-hidden']}
      initial={instant ? false : { opacity: 0, transform }}
      animate={{ opacity: 1, transform: rest }}
      exit={{
        opacity: 0,
        transform,
        transition: { duration: instant ? 0 : 0.12 },
      }}
      transition={{ duration: instant ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

/** Cross-fades state marks in one fixed slot; never duplicates live regions. */
export function StateTransition({
  children,
  state,
  size = 14,
}: {
  children: ReactNode
  state: string
  size?: 14 | 16 | 20
}) {
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

export { AnimatePresence, LayoutGroup } from 'motion/react'

/** The slot survives a handoff. Only its contents participate in presence. */
export function ActivitySlot({
  state,
  children,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: ReactNode
  state: string
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      {...props}
      layout={reduced ? false : true}
      layoutDependency={state}
      initial={false}
      transition={{
        layout: { duration: reduced ? 0 : 0.24, ease: [0.4, 0, 0.2, 1] },
      }}
    >
      <AnimatePresence initial={state === 'pending'} mode="popLayout">
        <ActivitySlotContent key={state}>{children}</ActivitySlotContent>
      </AnimatePresence>
    </motion.div>
  )
}

const ActivitySlotContent = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function ActivitySlotContent({ children }, ref) {
    const reduced = useReducedMotion()
    const present = useIsPresent()
    return (
      <motion.div
        ref={ref}
        data-slot="activity-slot-content"
        inert={!present}
        aria-hidden={!present || undefined}
        // Counter the parent's layout scale so labels and icons never stretch.
        layout={reduced ? false : 'position'}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.08 } }}
        transition={{
          duration: reduced ? 0 : 0.09,
          ease: 'easeOut',
          layout: { duration: reduced ? 0 : 0.24, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        {children}
      </motion.div>
    )
  },
)

/** Position-only layout keeps text unscaled while activity makes room for its successor. */
export const ActivityPresence = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<'div'>
>(function ActivityPresence(props, ref) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  return (
    <motion.div
      {...props}
      ref={ref}
      data-activity-presence={present ? 'present' : 'exiting'}
      inert={!present || props.inert}
      aria-hidden={!present || props['aria-hidden']}
      layout={reduced ? false : 'position'}
      initial={
        reduced || props.initial === false ? false : { opacity: 0, y: 6 }
      }
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reduced ? 0 : -4,
        transition: { duration: reduced ? 0 : 0.12 },
      }}
      transition={{
        duration: reduced ? 0 : 0.24,
        ease: [0.22, 1, 0.36, 1],
        layout: { duration: reduced ? 0 : 0.24, ease: [0.4, 0, 0.2, 1] },
      }}
    />
  )
})

export function PresenceItem(props: HTMLMotionProps<'li'>) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  return (
    <motion.li
      {...props}
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0, transform: 'translateY(4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
      transition={{ duration: reduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

/** State labels update immediately; outgoing text no longer contributes an accessible name. */
export function TextTransition({
  children,
  state,
}: {
  children: ReactNode
  state: string
}) {
  return (
    <span
      data-slot="text-transition"
      {...stylex.props(styles.text, styles.textContainer)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <TransitionLabel key={state} state={state}>
          {children}
        </TransitionLabel>
      </AnimatePresence>
    </span>
  )
}

const TransitionLabel = forwardRef<
  HTMLSpanElement,
  { children: ReactNode; state: string }
>(function TransitionLabel({ children, state }, ref) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  return (
    <motion.span
      ref={ref}
      aria-hidden={!present || undefined}
      data-text-state={state}
      {...stylex.props(styles.text)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.08 } }}
      transition={{ duration: reduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  )
})

const styles = stylex.create({
  text: {
    display: 'inline-block',
    maxInlineSize: '100%',
    verticalAlign: 'bottom',
  },
  textContainer: { position: 'relative' },
  slot: { display: 'inline-grid', placeItems: 'center' },
  size: (size: number) => ({ inlineSize: `${size}px`, blockSize: `${size}px` }),
  mark: {
    gridArea: '1 / 1',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
