'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Info, Mail, MessageCircle, Phone, Video } from 'lucide-react'

// Mirrors backend/app/services/vcard_service.py's CONTACT_CARD_FIELD_DEFAULTS - keep both in
// sync if a field is added/removed. "Sourced" fields reuse a value that already lives elsewhere
// on the Agent Hub (profile/contact/social links/headshot) - only the include toggle is stored
// here, so the agent is never asked to enter the same thing twice and it can't go stale. "Custom"
// fields have no existing home on the Agent Hub, so they carry their own value.
export type ContactCardField = { include: boolean; value?: string; label?: string }
export type ContactCardFields = Record<string, ContactCardField>

export const defaultContactCardFields: ContactCardFields = {
  headshot: { include: true },
  jobTitle: { include: true },
  company: { include: true },
  team: { include: false, value: '' },
  mobilePhone: { include: true },
  officePhone: { include: false, value: '' },
  email: { include: true },
  website: { include: true },
  agentHubUrl: { include: true },
  officeAddress: { include: false, value: '' },
  instagram: { include: false },
  linkedin: { include: false, value: '' },
  facebook: { include: false },
  youtube: { include: false },
  customUrl: { include: false, value: '', label: '' },
  notes: { include: false, value: '' },
}

export const mergeContactCardFields = (saved: unknown): ContactCardFields => {
  const savedFields = (saved && typeof saved === 'object' ? saved as Record<string, Partial<ContactCardField>> : {})
  const merged: ContactCardFields = {}
  for (const key of Object.keys(defaultContactCardFields)) {
    merged[key] = { ...defaultContactCardFields[key], ...(savedFields[key] || {}) }
  }
  return merged
}

type FieldMeta = {
  key: string
  label: string
  kind: 'sourced' | 'custom' | 'custom-label'
  sourceHint?: string
  placeholder?: string
}

const FIELD_ORDER: FieldMeta[] = [
  { key: 'mobilePhone', label: 'Mobile Phone', kind: 'sourced', sourceHint: 'From Contact → Call button' },
  { key: 'email', label: 'Email', kind: 'sourced', sourceHint: 'From Contact → Email button' },
  { key: 'company', label: 'Brokerage', kind: 'sourced', sourceHint: 'From Profile → Brokerage name' },
  { key: 'headshot', label: 'Headshot', kind: 'sourced', sourceHint: 'From Profile → Profile photo' },
  { key: 'website', label: 'Website', kind: 'sourced', sourceHint: 'From Social Links → Website' },
  { key: 'agentHubUrl', label: 'Agent Hub', kind: 'sourced', sourceHint: 'Your public Agent Hub link' },
  { key: 'jobTitle', label: 'Job Title', kind: 'sourced', sourceHint: 'From Profile → Professional title' },
  { key: 'officePhone', label: 'Office Phone', kind: 'custom', placeholder: '(555) 123-4567' },
  { key: 'officeAddress', label: 'Office Address', kind: 'custom', placeholder: '123 Main St, Suite 100, City, ST 00000' },
  { key: 'team', label: 'Team', kind: 'sourced', sourceHint: 'From Profile → Team name' },
  { key: 'instagram', label: 'Instagram', kind: 'sourced', sourceHint: 'From Social Links → Instagram' },
  { key: 'facebook', label: 'Facebook', kind: 'sourced', sourceHint: 'From Social Links → Facebook' },
  { key: 'youtube', label: 'YouTube', kind: 'sourced', sourceHint: 'From Social Links → YouTube' },
  { key: 'linkedin', label: 'LinkedIn', kind: 'custom', placeholder: 'https://linkedin.com/in/you' },
  { key: 'customUrl', label: 'Custom Link', kind: 'custom-label', placeholder: 'https://example.com' },
  { key: 'notes', label: 'Notes', kind: 'custom', placeholder: 'A short note saved with your contact' },
]

export type ContactCardSourceValues = {
  displayName: string
  jobTitle: string
  company: string
  team?: string
  mobilePhone: string
  email: string
  website: string
  instagram: string
  facebook: string
  youtube: string
  agentHubUrl: string
  headshotUrl: string
}

function resolvePreviewValue(key: string, field: ContactCardField, source: ContactCardSourceValues): string {
  switch (key) {
    case 'jobTitle': return source.jobTitle
    case 'company': return source.company
    case 'team': return source.team || field.value || ''
    case 'mobilePhone': return source.mobilePhone
    case 'email': return source.email
    case 'website': return source.website
    case 'instagram': return source.instagram
    case 'facebook': return source.facebook
    case 'youtube': return source.youtube
    case 'agentHubUrl': return source.agentHubUrl
    case 'headshot': return source.headshotUrl ? 'Photo attached' : ''
    default: return field.value || ''
  }
}

export default function ContactCardPanel({
  fields,
  onChange,
  source,
  showPreview = true,
}: {
  fields: ContactCardFields
  onChange: (key: string, updates: Partial<ContactCardField>) => void
  source: ContactCardSourceValues
  /** Off when the page shows ContactCardPreview elsewhere (the Agent Hub editor's live preview pane). */
  showPreview?: boolean
}) {
  return (
    <div className={showPreview ? 'grid gap-6 lg:grid-cols-[1fr_300px]' : ''}>
      <div className={showPreview ? 'space-y-3' : 'grid gap-2.5 md:grid-cols-2'}>
        <div className={`flex items-start gap-2 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3 text-xs font-semibold text-[#8b7355] dark:border-[#C9A24D]/20 dark:bg-[#C9A24D]/10 dark:text-[#d7b974] ${showPreview ? '' : 'md:col-span-2'}`}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{showPreview ? "Choose what people receive when they tap Save Contact on your Agent Hub. Turning something off here only affects the saved contact card - it won't hide it from your Agent Hub page itself." : 'What people get when they tap Save Contact - see it live on the right. Off here only leaves it out of the saved card, not your hub.'}</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-[#0B0B0B]">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Name</p>
          <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-300">{source.displayName || 'Set your name in Profile'}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-400">Always included - a saved contact needs a name.</p>
        </div>

        {FIELD_ORDER.map(meta => {
          const field = fields[meta.key] || { include: false }
          const previewValue = resolvePreviewValue(meta.key, field, source)
          return (
            <div key={meta.key} className={`rounded-xl border p-3 transition hover:-translate-y-0.5 ${field.include ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]' : 'border-gray-100 bg-gray-50 opacity-75 dark:border-gray-800 dark:bg-[#111113]'}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black dark:text-white">{meta.label}</p>
                  {meta.kind === 'sourced' ? (
                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                      {previewValue ? previewValue : `Not set yet – ${meta.sourceHint}`}
                    </p>
                  ) : (
                    <div className={meta.kind === 'custom-label' ? 'mt-2 grid gap-2 sm:grid-cols-[120px_1fr]' : 'mt-2'}>
                      {meta.kind === 'custom-label' && (
                        <input
                          value={field.label || ''}
                          onChange={(event) => onChange(meta.key, { label: event.target.value })}
                          placeholder="Label"
                          className="w-full rounded-lg border border-gray-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                        />
                      )}
                      <input
                        value={field.value || ''}
                        onChange={(event) => onChange(meta.key, { value: event.target.value })}
                        placeholder={meta.placeholder}
                        className="w-full rounded-lg border border-gray-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(meta.key, { include: !field.include })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition active:scale-90 ${field.include ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                  aria-label={`${field.include ? 'Remove' : 'Include'} ${meta.label} in saved contact`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full transition ${field.include ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showPreview && (
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Preview - what gets saved</p>
          <div className="mt-2"><ContactCardPreview fields={fields} source={source} /></div>
        </div>
      )}
    </div>
  )
}

// What a visitor's phone shows after tapping Save Contact - a phone-style contact card. Rows slide
// in and out as fields are switched on and off.
export function ContactCardPreview({ fields, source }: { fields: ContactCardFields; source: ContactCardSourceValues }) {
  const includedCount = FIELD_ORDER.filter(meta => fields[meta.key]?.include).length
  const rows = FIELD_ORDER.filter(meta => meta.key !== 'headshot' && meta.key !== 'jobTitle' && fields[meta.key]?.include).map(meta => {
    const value = meta.key === 'customUrl'
      ? (fields.customUrl?.label || fields.customUrl?.value ? `${fields.customUrl?.value || ''}` : '')
      : resolvePreviewValue(meta.key, fields[meta.key], source)
    const label = meta.key === 'customUrl' ? (fields.customUrl?.label || 'Link') : meta.label
    return value ? { key: meta.key, label, value } : null
  }).filter(Boolean) as { key: string; label: string; value: string }[]
  const photo = fields.headshot?.include && source.headshotUrl
  return (
    <div className="overflow-hidden rounded-[26px] border border-gray-200 bg-[#f4f3f1] shadow-[0_20px_40px_-26px_rgba(17,24,39,.5)] dark:border-white/10 dark:bg-[#111113]">
      <div className="flex flex-col items-center bg-gradient-to-b from-[#e9e6df] to-[#f4f3f1] px-5 pb-4 pt-6 text-center dark:from-[#1c1c1f] dark:to-[#111113]">
        <motion.div key={photo ? 'p' : 'n'} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          className="h-20 w-20 overflow-hidden rounded-full bg-gray-300 shadow-md ring-4 ring-white dark:bg-gray-700 dark:ring-[#1c1c1f]">
          {photo
            ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${source.headshotUrl})` }} />
            : <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white">{(source.displayName || '?').slice(0, 1).toUpperCase()}</div>}
        </motion.div>
        <p className="mt-3 text-xl font-bold text-[#111827] dark:text-white">{source.displayName || 'Your name'}</p>
        <AnimatePresence initial={false}>
          {fields.jobTitle?.include && source.jobTitle && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-gray-500">{source.jobTitle}{fields.company?.include && source.company ? ` · ${source.company}` : ''}</motion.p>
          )}
        </AnimatePresence>
        <div className="mt-4 grid w-full grid-cols-4 gap-2">
          {([['message', MessageCircle], ['call', Phone], ['video', Video], ['mail', Mail]] as const).map(([k, Icon]) => (
            <span key={k} className="flex flex-col items-center gap-1 rounded-xl bg-white py-2 text-[9px] font-bold capitalize text-[#007aff] shadow-sm transition hover:-translate-y-0.5 dark:bg-white/[0.06]">
              <Icon className="h-4 w-4" />{k}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <AnimatePresence initial={false}>
          {rows.map(r => (
            <motion.div key={r.key} layout initial={{ opacity: 0, x: -10, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} exit={{ opacity: 0, x: 10, height: 0 }} transition={{ duration: 0.22 }}
              className="overflow-hidden rounded-xl bg-white px-3.5 py-2.5 shadow-sm dark:bg-white/[0.05]">
              <p className="text-[10px] font-semibold text-gray-500">{r.label}</p>
              <p className="truncate text-sm text-[#007aff]">{r.value}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {includedCount === 0 && <p className="px-1 py-2 text-xs font-semibold text-gray-400">Nothing selected yet besides name.</p>}
      </div>
    </div>
  )
}
