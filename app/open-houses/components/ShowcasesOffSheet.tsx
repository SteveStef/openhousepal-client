'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Sparkles } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { useLastValue } from '@/components/ui/windowMotion'
import type { GuestSettingsPatch, OpenHouse } from '@/types'
import { toTitleCase } from '@/lib/cheatSheetContent'

/**
 * Turning Showcases OFF for one open house (user, 10/24): before it saves, ask what guests who sign
 * in without an agent should still get on their Guest Pass -
 *  - Similar homes: the homes picked like this one (the open house's Similar Homes switch - also
 *    the Similar Homes sheet in the kit).
 *  - Showcases: a "Get my Showcase" button on the pass; one is built only if the guest taps it
 *    (open_house_events.pass_showcase). Nobody gets one automatically any more.
 */
export default function ShowcasesOffSheet({ openHouse, onClose, onSave }: {
  openHouse: OpenHouse | null
  onClose: () => void
  onSave: (openHouse: OpenHouse, patch: GuestSettingsPatch) => void
}) {
  const oh = useLastValue(openHouse)
  const [similar, setSimilar] = useState(true)
  const [showcase, setShowcase] = useState(false)
  useEffect(() => {
    if (!openHouse) return
    setSimilar(openHouse.similarHomes !== false)
    setShowcase(!!openHouse.passShowcase)
  }, [openHouse])
  // Similar homes only exist for an MLS-linked home on a Guest Pass plan.
  const similarAvailable = !!(oh?.guestPassAvailable && oh?.listingKey)
  const street = toTitleCase((oh?.address || '').split(',')[0])

  const row = (on: boolean, set: (v: boolean) => void, icon: React.ReactNode, title: string, body: string) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${on
        ? 'border-[#C9A24D]/50 bg-[#C9A24D]/[0.07] dark:bg-[#C9A24D]/10'
        : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[#111827] dark:text-white">{title}</span>
        <span className="mt-0.5 block text-xs font-medium leading-snug text-gray-500 dark:text-gray-400">{body}</span>
      </span>
      <OhpSwitch on={on} as="span" size="md" />
    </button>
  )

  return (
    <OhSheet
      open={!!openHouse}
      onClose={onClose}
      width="max-w-lg"
      title="Turn off Showcases?"
      subtitle={street}
      image={oh?.coverImageUrl || null}
      footer={
        <div className="flex gap-2.5">
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white">
            Keep them on
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }}
            onClick={() => { if (oh) onSave(oh, { autoShowcase: false, passShowcase: showcase, ...(similarAvailable ? { similarHomes: similar } : {}) }); onClose() }}
            className="flex-[1.4] rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-lg shadow-black/20 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
            Turn off Showcases
          </motion.button>
        </div>
      }
    >
      <p className="text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
        Guests who sign in here without an agent won&apos;t get a Showcase made for them automatically.
        <span className="mt-2 block font-black text-[#111827] dark:text-white">What should their Guest Pass still offer?</span>
      </p>
      <div className="mt-3 space-y-2.5">
        {similarAvailable && row(similar, setSimilar, <Home className="h-5 w-5" />, 'Similar homes',
          'The homes you picked like this one, on their Guest Pass (and the Similar Homes sheet in your kit).')}
        {row(showcase, setShowcase, <Sparkles className="h-5 w-5" />, 'Showcases',
          'A "Get my Showcase" button on their Guest Pass - one is made only if they tap it.')}
      </div>
    </OhSheet>
  )
}
