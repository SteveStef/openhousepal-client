'use client'

import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api-service'

// Reveals actual guest name/email/phone for one open house - only ever rendered when the backend
// has already confirmed the hosting agent turned sharing on for that specific kit (share_guests_enabled).
// Shared between ManageHostsModal and OpenHouseInsightsModal so a listing agent finds the same
// guest-detail option no matter which of the two "View Insights" / "Manage Hosts" entry points
// they used to get to this listing's history.
export default function GuestDetailsToggle({ eventId, windowDate }: { eventId: string; windowDate?: string | null }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [guests, setGuests] = useState<any[] | null>(null)

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next && guests === null) {
      setLoading(true)
      const { success, data } = await api.openHouseManager.getSharedGuests(eventId, windowDate)
      if (success && data) setGuests(data)
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <button onClick={handleToggle} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] hover:text-[#6b5a43] dark:text-[#e8cf8a]">
        {open ? <EyeOff size={11} /> : <Eye size={11} />} {open ? 'Hide' : 'View'} Guest Details
      </button>
      {open && (
        loading ? <div className="mt-2 flex justify-center"><Loader2 size={14} className="animate-spin text-[#C9A24D]" /></div> : (
          <div className="mt-2 space-y-1.5">
            {(guests || []).length === 0 ? (
              <p className="text-xs text-gray-400">No guests signed in yet.</p>
            ) : (guests || []).map(g => (
              <div key={g.id} className="rounded-lg bg-gray-50 dark:bg-[#0F0F11] p-2 text-xs">
                <p className="font-bold text-gray-700 dark:text-gray-200">{g.full_name}</p>
                <p className="text-gray-500 dark:text-gray-400">{g.email} · {g.phone}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
