'use client'

import { CalendarCheck, AlertCircle } from 'lucide-react'
import { OpenHouseStatus } from '@/types'

export default function StatusBadge({ status }: { status: OpenHouseStatus }) {
  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
        <CalendarCheck size={11} strokeWidth={3} /> Open Scheduled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
      <AlertCircle size={11} strokeWidth={3} /> Needs Host
    </span>
  )
}
