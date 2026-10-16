// The real Google / Google Calendar / Outlook marks for every "Connect ..." button (setup, the
// Calendar page, Send-from-your-email) - one place, so they all look the same.

export function GoogleLogo({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function GoogleCalendarLogo({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="6" y="6" width="36" height="36" rx="5" fill="#fff" stroke="#e5e7eb" />
      <rect x="6" y="6" width="36" height="9" rx="4" fill="#4285F4" />
      <rect x="6" y="11" width="36" height="4" fill="#4285F4" />
      <text x="24" y="36" textAnchor="middle" fontSize="16" fontWeight="800" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
      <path d="M34 42l8-8v4a4 4 0 0 1-4 4z" fill="#34A853" />
    </svg>
  )
}

export function OutlookLogo({ className = 'h-full w-full' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="14" y="8" width="28" height="32" rx="3" fill="#28A8EA" />
      <rect x="14" y="8" width="28" height="10" rx="3" fill="#0078D4" />
      <rect x="4" y="13" width="22" height="22" rx="3" fill="#0A5FB4" />
      <ellipse cx="15" cy="24" rx="5.5" ry="6.5" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  )
}
