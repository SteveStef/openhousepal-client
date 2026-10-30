'use client'

// The person's alert switches on the follow-up link pages (/d/<code> "Mark as done" and the
// tap-to-text page) - owner, 10/27: "every follow-up screen, when you click done, has a settings
// section for that lead". Saved through the follow-up's own code (no login, like the page itself).
// Loaded on its own (next/dynamic) so the check-off page still opens fast.
import { motion, useReducedMotion } from 'framer-motion'
import api from '@/lib/api-service'
import type { LeadAlerts } from '@/types'
import LeadAlertSwitches from '@/components/leads/LeadAlertSwitches'

export default function DoneLeadAlerts({ code, firstName, alerts, delay = 0.2, inCard = false }: {
  code: string
  firstName: string
  alerts: LeadAlerts
  delay?: number
  /** In a card of its own (the computer's text page) - no divider line on top. */
  inCard?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={inCard ? 'text-left' : 'border-t border-gray-100 px-3 py-3.5 text-left dark:border-gray-800'}>
      <LeadAlertSwitches firstName={firstName} alerts={alerts}
        onSave={async patch => {
          const r = await api.tasks.publicAlerts(code, patch)
          return r.success && r.data ? r.data.alerts : null
        }} />
    </motion.div>
  )
}
