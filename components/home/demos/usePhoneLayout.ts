'use client'

import { useEffect, useState } from 'react'

// True below Tailwind's `sm` breakpoint (phones) - same cut-off as the demos' `max-sm:` classes
// and DemoNote/DemoCaption. Only for things CSS classes can't switch on their own (pointer
// coordinates, measured zoom). Starts false so the server render and desktop stay unchanged.
export default function usePhoneLayout() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639.98px)')
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}
