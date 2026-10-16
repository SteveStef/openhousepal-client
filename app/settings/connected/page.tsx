'use client'

// Where a Google sign-in opened from setup lands (in its own tab - setup is never interrupted).
// Tells the setup tab it's done, then closes itself; if the browser won't let it close, it says
// so in plain words.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { CONNECTED_EVENT } from '@/lib/providers'

const WHAT: Record<string, string> = { calendar: 'Your calendar', email: 'Your email' }

export default function ConnectedPage() {
  const params = useSearchParams()
  const what = params.get('what') || 'calendar'
  const ok = params.get('status') === 'connected'
  const [closing, setClosing] = useState(ok)

  useEffect(() => {
    const note = JSON.stringify({ what, ok, at: Date.now() })
    try { localStorage.setItem(CONNECTED_EVENT, note) } catch { /* private mode */ }
    if (!ok) return
    const t = setTimeout(() => { window.close(); setTimeout(() => setClosing(false), 400) }, 1400)
    return () => clearTimeout(t)
  }, [what, ok])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4 dark:bg-[#0B0B0B]">
      <div className="w-full max-w-sm rounded-3xl border border-[#ece5d6] bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#141416]">
        {ok
          ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          : <XCircle className="mx-auto h-12 w-12 text-rose-600" />}
        <h1 className="mt-4 font-serif text-2xl font-black text-[#111827] dark:text-white">
          {ok ? `${WHAT[what] || 'It'} is connected` : 'That didn’t connect'}
        </h1>
        <p className="mt-2 text-[15px] font-medium text-gray-500 dark:text-gray-400">
          {ok
            ? (closing ? 'Taking you back to your setup…' : 'You can close this tab - your setup has already updated.')
            : 'Close this tab and press Connect again in your setup.'}
        </p>
      </div>
    </div>
  )
}
