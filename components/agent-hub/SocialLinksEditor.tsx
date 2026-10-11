'use client'

import { Facebook, Globe, Instagram, Music2, Youtube } from 'lucide-react'
import { publicWebUrl } from '@/lib/webUrl'

export type SocialLink = {
  id: string
  label: string
  url: string
  enabled: boolean
  icon: React.ComponentType<{ className?: string }>
}

export const defaultSocialLinks: SocialLink[] = [
  { id: 'instagram', label: 'Instagram', url: '', enabled: false, icon: Instagram },
  { id: 'facebook', label: 'Facebook', url: '', enabled: false, icon: Facebook },
  { id: 'youtube', label: 'YouTube', url: '', enabled: false, icon: Youtube },
  { id: 'tiktok', label: 'TikTok', url: '', enabled: false, icon: Music2 },
  { id: 'website', label: 'Website', url: '', enabled: false, icon: Globe },
]

export const getSocialBrandClass = (id: string) => {
  const classes: Record<string, string> = {
    instagram: 'text-[#E4405F]',
    facebook: 'text-[#1877F2]',
    youtube: 'text-[#FF0000]',
    tiktok: 'text-[#111827] dark:text-white',
    website: 'text-[#C9A24D]',
  }

  return classes[id] || 'text-[#111827]'
}

// Shared by both the Agent Hub editor (Studio > Site) and Settings - same component, same
// save path, so a link toggled/edited in either place shows up in the other on next load.
//
// Laid out as a responsive grid (1 col on mobile, 2 on wider containers) of self-contained cards,
// each with its own full-width URL field on its own line - not a single cramped row that squeezed
// icon + label + input + toggle onto one line. The caller (Settings' Profile tab) now also gives
// this room to breathe by putting it in a full-width card instead of a narrow sidebar column.
//
// Icons carry their real platform brand color everywhere this renders (explicit ask, reversing an
// earlier neutral-icon pass: "should have a color icon on settings and other places like signature
// and agent hub"). `animateIcons` (default true) separately controls the hover builder-draw effect -
// Settings passes false so this specific list of icons sits still there, while the Agent Hub editor
// keeps the hover animation.
export default function SocialLinksEditor({ socialLinks, onChange, animateIcons = true }: { socialLinks: SocialLink[]; onChange: (id: string, updates: Partial<SocialLink>) => void; animateIcons?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {socialLinks.map(({ id, label, url, enabled, icon: Icon }) => (
        // Website is always the odd 5th card - spans both columns so the grid ends flush instead
        // of leaving an empty half-row beside it (explicit ask: "make website entire length").
        <div key={id} className={`group rounded-xl border p-4 transition ${id === 'website' ? 'sm:col-span-2' : ''} ${enabled ? 'border-gray-200 bg-[#fbfaf7] dark:border-gray-700 dark:bg-[#0B0B0B]' : 'border-gray-100 bg-gray-50 opacity-75 dark:border-gray-800 dark:bg-[#111113]'}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]">
              <Icon className={`h-4 w-4 ${animateIcons ? 'ohp-icon-draw' : ''} ${getSocialBrandClass(id)}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black leading-tight dark:text-white">{label}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {enabled ? 'Showing on public Agent Hub' : 'Hidden from public Agent Hub'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(id, { enabled: !enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
              aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${label}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full transition ${enabled ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
            </button>
          </div>
          <input
            value={url}
            disabled={!enabled}
            placeholder={`Your ${label} link`}
            onChange={(event) => onChange(id, { url: event.target.value })}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-[#151517] dark:text-white dark:disabled:bg-[#0B0B0B] dark:disabled:text-gray-600"
          />
          {enabled && url.trim() && !publicWebUrl(url) && (
            <p className="mt-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">That isn&apos;t a web address yet - paste the full link (like instagram.com/yourname). It stays hidden until it is.</p>
          )}
        </div>
      ))}
    </div>
  )
}
