'use client'

// The calendar alert a follow-up situation makes, exactly as it will look - built by the backend's
// real event builder for a sample lead (Jane Buyer), with the message being edited right now
// (unsaved). Same emojis, dividers, spacing and order as the event on the agent's phone.
import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'

const URL_RE = /^https?:\/\/\S+$/

export default function CalendarAlertPreview({ ruleKey, template, pitch, seller, maxHeightClass = 'max-h-[460px]' }: {
  ruleKey: string
  template?: string
  pitch?: string
  seller?: boolean
  /** How tall before the alert text scrolls inside the preview. */
  maxHeightClass?: string
}) {
  const [event, setEvent] = useState<{ summary: string; description: string; all_day?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    // Debounced - it follows the editor as the agent types.
    timer.current = setTimeout(async () => {
      setLoading(true)
      const r = await api.tasks.previewAlert(ruleKey, { template, pitch, seller })
      if (r.success && r.data) setEvent(r.data)
      setLoading(false)
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [ruleKey, template, pitch, seller])

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B]">
      <div className="flex items-start gap-2 border-b border-gray-100 bg-[#C9A24D]/10 px-3 py-2.5 dark:border-gray-800">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7355] dark:text-[#d7b974]" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[12px] font-black leading-snug text-[#111827] dark:text-white">{event?.summary || ' '}</p>
          <p className="text-[10px] font-bold text-gray-400">{event?.all_day ? 'Tomorrow · all day' : 'Tomorrow · 10:15 AM'}</p>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />}
      </div>
      <div className={`${maxHeightClass} overflow-y-auto whitespace-pre-wrap break-words px-3 py-2.5 text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-300`}>
        {(event?.description || '').split('\n').map((line, i) => (
          <span key={i} className="block min-h-[1em]">
            {URL_RE.test(line.trim())
              ? <span className="break-all text-[#0a84ff] underline">{line}</span>
              : /^[━]+$/.test(line.trim())
                ? <span className="my-1 block h-px bg-gray-200 dark:bg-gray-700" />
                : line}
          </span>
        ))}
      </div>
    </div>
  )
}
