'use client'

import { useEffect, useState } from 'react'

// Tracks whether any AI generation is currently in flight anywhere in the app (AiWriteButton's
// "Write/Polish with AI", ComplianceChips' Fair-Housing check, ...) via plain window events - the
// same lightweight cross-component signal already used for LEADS_REFRESH_EVENT/
// OPEN_HOUSE_REFRESH_EVENT in components/NotificationBell.tsx, instead of introducing a new React
// Context that every AI call site would need to be wrapped in just for this. Consumed by
// MonthlyAiUsageMeter to drive its "RPM needle" animation while AI is actively busy.
const START_EVENT = 'ai-activity:start'
const END_EVENT = 'ai-activity:end'

// Module-level counter (not React state) so concurrent AI calls from different components don't
// stomp on each other - the meter only goes idle once every in-flight call has finished.
let activeCount = 0

export function startAiActivity() {
  activeCount += 1
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(START_EVENT))
}

export function endAiActivity() {
  activeCount = Math.max(0, activeCount - 1)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(END_EVENT))
}

export function useAiActivity(): boolean {
  const [active, setActive] = useState(activeCount > 0)
  useEffect(() => {
    const update = () => setActive(activeCount > 0)
    update()
    window.addEventListener(START_EVENT, update)
    window.addEventListener(END_EVENT, update)
    return () => {
      window.removeEventListener(START_EVENT, update)
      window.removeEventListener(END_EVENT, update)
    }
  }, [])
  return active
}
