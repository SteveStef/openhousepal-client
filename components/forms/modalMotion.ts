// Shared motion for the Forms page windows (a form's Campaigns / Stats / Results window and the
// form editor): the backdrop fades, the panel rises and settles on a soft spring, and whatever a
// tab shows cascades in piece by piece - the same "everything animates in and settles" feel the
// Stats tab has, on every tab and every open / close.
import type { Transition, Variants } from 'framer-motion'

export const SETTLE: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }

export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.04 } },
}

export const panelMotion = {
  initial: { opacity: 0, y: 26, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SETTLE },
  exit: { opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' as const } },
}

/** A tab's content: children marked <motion.div variants={riseItem}> cascade in. */
export const cascade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
  leave: { opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
}

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: SETTLE },
}
