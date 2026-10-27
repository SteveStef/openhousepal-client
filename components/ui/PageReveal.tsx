'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import OhpLoader from '@/components/brand/OhpLoader'

/** The rise itself - shared with pages that keep their own loader but open the same way (a lead's
 *  page / window, LeadDetailPanel). Transform + opacity only, no blur, so it stays smooth on phones. */
export const pageRiseFrom = (reduce: boolean | null) => ({ opacity: 0, y: reduce ? 0 : 22, scale: reduce ? 1 : 0.985 })
export const pageRiseTo = { opacity: 1, y: 0, scale: 1 }
export const pageRiseTransition = { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.08 } as const

/**
 * The page opening (user, 10/24 - Manager / Discovery): the OpenHousePal house loader covers the
 * page (under the site header) until `ready` - data AND first photos in, see useImagesReady - then
 * fades away while the page underneath rises into place. The page renders the whole time (hidden),
 * so its photos load behind the loader. Pass `guest` on client-facing pages (house only).
 */
export default function PageReveal({ ready, label, guest = false, className = '', children }: {
  ready: boolean
  label?: string
  guest?: boolean
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <>
      <AnimatePresence>
        {!ready && (
          <motion.div key="page-reveal-loader" className="fixed inset-0 z-[35] bg-[#faf9f7] dark:bg-[#0B0B0B]"
            initial={false} exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } }}>
            <OhpLoader label={label} guest={guest} />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={false}
        animate={ready ? pageRiseTo : pageRiseFrom(reduce)}
        transition={ready ? pageRiseTransition : { duration: 0 }}
        aria-busy={!ready}
        className={`${ready ? '' : 'pointer-events-none'} ${className}`}
      >
        {children}
      </motion.div>
    </>
  )
}
