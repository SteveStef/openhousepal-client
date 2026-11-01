'use client'

import { useAuth } from '@/contexts/AuthContext'
import { resolveMediaUrl } from '@/lib/api-service'

// The helper's face (owner, 11/01: "OpenHousePal logo with eyes, like a little robot - something
// cute"): the logo's house - navy walls, gold roof - with a screen face, two eyes that blink now and
// then, and a gold antenna light. `thinking` = eyes glance side to side while a reply is coming.
export function OhpBot({ size = 32, thinking = false, className = '' }: { size?: number; thinking?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className={`ohp-bot ${thinking ? 'ohp-bot-thinking' : ''} ${className}`}>
      <defs>
        <linearGradient id="ohpBotRoof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e8c97a" /><stop offset="1" stopColor="#a8803a" /></linearGradient>
        <linearGradient id="ohpBotBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f2937" /><stop offset="1" stopColor="#0b1220" /></linearGradient>
      </defs>
      {/* antenna */}
      <line x1="20" y1="5.5" x2="20" y2="2.6" stroke="#C9A24D" strokeWidth="1.4" strokeLinecap="round" />
      <circle className="ohp-bot-light" cx="20" cy="2.4" r="1.7" fill="#e8c97a" />
      {/* roof */}
      <path d="M20 5.5 L36.5 18.2 a1.6 1.6 0 0 1 -1 2.9 H4.5 a1.6 1.6 0 0 1 -1 -2.9 Z" fill="url(#ohpBotRoof)" />
      {/* walls */}
      <rect x="7.5" y="17.5" width="25" height="19" rx="4.5" fill="url(#ohpBotBody)" />
      {/* face screen */}
      <rect x="10.5" y="20.5" width="19" height="11.5" rx="4" fill="#f8f4ea" />
      {/* eyes */}
      <g className="ohp-bot-eyes">
        <ellipse className="ohp-bot-eye" cx="16" cy="25.6" rx="1.9" ry="2.3" fill="#111827" />
        <ellipse className="ohp-bot-eye" cx="24" cy="25.6" rx="1.9" ry="2.3" fill="#111827" />
        <circle cx="16.6" cy="24.8" r=".6" fill="#fff" />
        <circle cx="24.6" cy="24.8" r=".6" fill="#fff" />
      </g>
      {/* cheeks + smile */}
      <circle cx="12.9" cy="29.2" r="1.1" fill="#e8b4a0" opacity=".75" />
      <circle cx="27.1" cy="29.2" r="1.1" fill="#e8b4a0" opacity=".75" />
      <path d="M18.4 29.1 q1.6 1.4 3.2 0" stroke="#111827" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** The agent's own picture on their messages: their photo, else their initials. */
export function UserAvatar({ size = 32 }: { size?: number }) {
  const { user } = useAuth()
  const photo = user?.photo_url ? resolveMediaUrl(user.photo_url) : null
  const initials = [user?.first_name, user?.last_name].map(s => (s || '').trim()[0] || '').join('').toUpperCase() || 'You'
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-zinc-900" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a8803a] to-[#8b7355] font-black text-white ring-2 ring-white shadow-sm dark:ring-zinc-900"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  )
}
