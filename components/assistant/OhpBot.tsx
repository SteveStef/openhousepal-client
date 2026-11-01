'use client'

import { useId } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { resolveMediaUrl } from '@/lib/api-service'

// The helper's face (owner, 11/01, third pass: "needs to be much better"): "Chat Pal" - a speech bubble
// with a little roof, big shiny eyes that blink now and then, rosy cheeks, a smile and an AI sparkle, on
// the OpenHousePal gold coin (no black). `coin={false}` when the chat button is the coin itself;
// `thinking` = the eyes glance side to side while a reply is coming. Gradient ids are per instance.
export function OhpBot({ size = 32, thinking = false, coin = true, className = '' }: { size?: number; thinking?: boolean; coin?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={`ohp-bot ${thinking ? 'ohp-bot-thinking' : ''} ${className}`}>
      <defs>
        <radialGradient id={`c${id}`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#f6e2a8" /><stop offset=".55" stopColor="#d6ae55" /><stop offset="1" stopColor="#a8803a" /></radialGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f4ead3" /></linearGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a3a24" /><stop offset="1" stopColor="#2e2416" /></linearGradient>
      </defs>
      {coin && <circle cx="32" cy="32" r="32" fill={`url(#c${id})`} />}
      {/* the bubble */}
      <path d="M12.5 30.5 Q12.5 21 22 21 H42 Q51.5 21 51.5 30.5 V39 Q51.5 48.5 42 48.5 H29 L21.5 54.5 Q20 55.6 20.2 53.7 L20.8 48.4 Q12.5 47.5 12.5 39 Z" fill={`url(#b${id})`} />
      {/* its roof */}
      <path d="M17.5 22.6 L30.4 12.9 Q32 11.7 33.6 12.9 L46.5 22.6" stroke={`url(#r${id})`} strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* face */}
      <g className="ohp-bot-eyes">
        <ellipse className="ohp-bot-eye" cx="25.6" cy="33.2" rx="3.6" ry="4.2" fill="#2b2418" />
        <ellipse className="ohp-bot-eye" cx="38.4" cy="33.2" rx="3.6" ry="4.2" fill="#2b2418" />
        <circle cx="26.8" cy="31.7" r="1.25" fill="#fff" />
        <circle cx="39.6" cy="31.7" r="1.25" fill="#fff" />
      </g>
      <ellipse cx="20.4" cy="39.6" rx="2.4" ry="1.5" fill="#f2a98d" opacity=".75" />
      <ellipse cx="43.6" cy="39.6" rx="2.4" ry="1.5" fill="#f2a98d" opacity=".75" />
      <path d="M28.4 40 Q32 43.6 35.6 40" stroke="#2b2418" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* the AI sparkle */}
      <path className="ohp-bot-light" d="M45.2 15.8 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z" fill="#fffaf0" />
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
