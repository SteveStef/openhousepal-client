'use client'

// The "about you" steps. Each keeps its own typing state (seeded once from what's saved) and
// saves as the agent types - the shell debounces and merges these into one request.
import { useRef, useState } from 'react'
import { Facebook, Globe, ImageIcon, Instagram, Linkedin, Loader2, Mail, MapPin, MessageSquare, Music2, Phone, Trash2, UserRound, Youtube } from 'lucide-react'
import type { SetupData } from '@/lib/api-service'
import api from '@/lib/api-service'
import DraggableAvatarPhoto from '@/components/agent-hub/DraggableAvatarPhoto'
import { AiWriteButton } from '@/components/ai/AiWriteButton'
import { BIO_MAX_CHARS, fitBio } from '@/lib/agentBio'
import { emailOk, Field, formatPhone, inputCls, LockedValue, MoreOptions, phoneOk, StepCtx, toJpeg, useGate } from './SetupUi'

const TITLE_SUGGESTIONS = ['REALTOR®', 'Real Estate Agent', 'Associate Broker', 'Broker', 'Team Leader']

export function AboutStep({ ctx }: { ctx: StepCtx }) {
  const i = ctx.data.info
  const [v, setV] = useState({ name: i.name, title: i.title, brokerage: i.brokerage, team: i.team, market: i.market })
  const set = (k: keyof typeof v, value: string) => {
    setV(cur => ({ ...cur, [k]: value }))
    ctx.saveInfo({ profile: { [k]: value } })
  }
  const missing = ([['name', 'your name'], ['title', 'your title'], ['brokerage', 'your brokerage'], ['market', 'the area you serve']] as const).filter(([k]) => !v[k].trim()).map(([, l]) => l)
  useGate(ctx, { ok: missing.length === 0, message: missing.length ? `Please add ${missing.join(', ')}.` : undefined }, [missing.join()])
  return (
    <WithCard ctx={ctx} over={v}>
    <div className="space-y-6">
      <Field label="Your full name" required value={v.name} onChange={x => set('name', x)} placeholder="Jane Smith" autoComplete="name" hint="The way you'd like clients to see it." />
      <Field label="Your title" required value={v.title} onChange={x => set('title', x)} placeholder="REALTOR®">
        <span className="mt-2.5 flex flex-wrap gap-2">
          {TITLE_SUGGESTIONS.map(t => (
            <button key={t} type="button" onClick={() => set('title', t)} className={`rounded-full border-2 px-3.5 py-1.5 text-[13px] font-bold transition ${v.title === t ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : 'border-[#ece5d6] text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>{t}</button>
          ))}
        </span>
      </Field>
      <Field label="Your brokerage" required value={v.brokerage} onChange={x => set('brokerage', x)} placeholder="Main Line Realty" autoComplete="organization" />
      <Field label="Area you serve" required value={v.market} onChange={x => set('market', x)} placeholder="Philadelphia & the Main Line" hint="A few words - the towns or region you work in." />
      <Field label="Team name" value={v.team} onChange={x => set('team', x)} placeholder="The Smith Group" hint="Only if you're on a team." />
    </div>
    </WithCard>
  )
}

export function ContactStep({ ctx }: { ctx: StepCtx }) {
  const i = ctx.data.info
  const [v, setV] = useState({ call: i.call, text: i.text, email: i.email, brokeragePhone: i.brokeragePhone || '', officePhone: i.officePhone, officeAddress: i.officeAddress })
  const [sameText, setSameText] = useState(!i.text || i.text === i.call)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const save = (next: typeof v, same = sameText) => {
    const text = same ? next.call : next.text
    ctx.saveInfo({ contact: { call: next.call, text, email: next.email }, profile: { brokeragePhone: next.brokeragePhone }, card: { officePhone: next.officePhone, officeAddress: next.officeAddress } })
  }
  const set = (k: keyof typeof v, value: string) => {
    const next = { ...v, [k]: value }
    setV(next)
    save(next)
  }
  const blurPhone = (k: 'call' | 'text' | 'brokeragePhone' | 'officePhone') => {
    setTouched(t => ({ ...t, [k]: true }))
    const f = formatPhone(v[k])
    if (f !== v[k]) set(k, f)
  }
  const textValue = sameText ? v.call : v.text
  const problems: string[] = []
  if (!phoneOk(v.call)) problems.push('your mobile number')
  if (!sameText && !phoneOk(v.text)) problems.push('the number you text from')
  if (!emailOk(v.email)) problems.push('your email')
  if (!phoneOk(v.brokeragePhone)) problems.push("your brokerage's phone")
  if (v.officePhone.trim() && !phoneOk(v.officePhone)) problems.push('your office phone')
  useGate(ctx, { ok: problems.length === 0, message: problems.length ? `Please check ${problems.join(', ')}.` : undefined }, [problems.join()])
  return (
    <WithCard ctx={ctx} over={{ call: v.call, text: textValue, email: v.email }}>
    <div className="space-y-6">
      <Field label="Mobile number" required value={v.call} onChange={x => set('call', x)} onBlur={() => blurPhone('call')} type="tel" inputMode="tel" autoComplete="tel" placeholder="(610) 555-0134" invalid={touched.call && !phoneOk(v.call)} hint="The number clients call you on." />
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-[#ece5d6] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141416]">
        <input type="checkbox" checked={sameText} onChange={e => { setSameText(e.target.checked); save(v, e.target.checked) }} className="h-6 w-6 shrink-0 accent-[#C9A24D]" />
        <span className="text-[16px] font-bold text-[#111827] dark:text-white">I text from this same number</span>
      </label>
      {!sameText && <Field label="Number you text from" required value={textValue} onChange={x => set('text', x)} onBlur={() => blurPhone('text')} type="tel" inputMode="tel" placeholder="(610) 555-0199" invalid={touched.text && !phoneOk(v.text)} />}
      <Field label="Email for clients" required value={v.email} onChange={x => set('email', x)} onBlur={() => setTouched(t => ({ ...t, email: true }))} type="email" inputMode="email" autoComplete="email" placeholder="jane@yourbrokerage.com" invalid={touched.email && !emailOk(v.email)} hint="Where client emails and form replies should go. It can be different from your login." />
      <Field label="Office phone (optional)" value={v.officePhone} onChange={x => set('officePhone', x)} onBlur={() => blurPhone('officePhone')} type="tel" inputMode="tel" placeholder="(610) 555-0123" invalid={touched.officePhone && !!v.officePhone.trim() && !phoneOk(v.officePhone)} hint="Your own office or direct line, if you have one. It goes on your Save Contact card." />
      <Field label="Your brokerage's phone" required value={v.brokeragePhone} onChange={x => set('brokeragePhone', x)} onBlur={() => blurPhone('brokeragePhone')} type="tel" inputMode="tel" placeholder="(610) 555-0100" invalid={touched.brokeragePhone && !phoneOk(v.brokeragePhone)} hint="Your brokerage's main number. Most states require it on print ads, so it's printed on your mailers, flyers and door hangers. It never goes on your Save Contact card." />
      <MoreOptions label="Office address (optional)" defaultOpen={!!v.officeAddress}>
        <Field label="Office address" value={v.officeAddress} onChange={x => set('officeAddress', x)} placeholder="123 Lancaster Ave, Wayne, PA" autoComplete="street-address" />
      </MoreOptions>
    </div>
    </WithCard>
  )
}

export function LicenseStep({ ctx }: { ctx: StepCtx }) {
  const saved = ctx.data.info.licenseNumber
  const [value, setValue] = useState('')
  const [confirm, setConfirm] = useState(false)
  const clean = value.trim()
  useGate(ctx, {
    ok: !!saved || (clean.length >= 3 && confirm),
    message: saved ? undefined : clean.length < 3 ? 'Please type your license number.' : 'Please tick the box to confirm it’s correct.',
    onContinue: saved ? undefined : async () => {
      const r = await api.setup.patchInfo({ profile: { licenseNumber: clean } })
      if (r.success && r.data) { ctx.setData(r.data); return true }
      return false
    },
  }, [saved, clean, confirm])
  if (saved) return <LockedValue label="License number" value={saved} note="If it ever needs to change, our support team can update it for you." />
  return (
    <div className="space-y-5">
      <Field label="License number" required value={value} onChange={setValue} placeholder="RS123456" autoComplete="off" hint="Exactly as it appears on your license." />
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#ece5d6] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141416]">
        <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#C9A24D]" />
        <span className="text-[15px] font-semibold leading-snug text-[#111827] dark:text-white">I double-checked it. I understand it locks once I continue.</span>
      </label>
    </div>
  )
}

export function PhotoStep({ ctx }: { ctx: StepCtx }) {
  const i = ctx.data.info
  const [pos, setPos] = useState(i.photoPosition || { x: 50, y: 50 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useGate(ctx, { ok: true }, [])
  const pick = async (file?: File) => {
    if (!file) return
    setErr(''); setBusy(true)
    try {
      const jpg = file.type === 'image/jpeg' && file.size < 4.5 * 1024 * 1024 ? file : await toJpeg(file)
      const r = await api.setup.uploadPhoto(jpg)
      if (r.success && r.data) { ctx.setData(r.data); setPos({ x: 50, y: 50 }); ctx.saveInfo({ photoPosition: { x: 50, y: 50 } }) }
      else setErr(r.error || 'That photo didn’t upload - please try another one.')
    } catch {
      setErr('We couldn’t read that file - please pick a photo (JPG or PNG).')
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-[#e8c97a]/50 via-transparent to-[#C9A24D]/40 blur-xl" />
        <div className="relative rounded-full bg-gradient-to-br from-[#8b6a2b] via-[#e8c97a] to-[#C9A24D] p-[5px] shadow-[0_24px_50px_-24px_rgba(139,106,43,.9)]">
          {i.photoUrl ? (
            <DraggableAvatarPhoto url={i.photoUrl} position={pos} onPositionChange={setPos} onDragEnd={p => ctx.saveInfo({ photoPosition: p })} size={176} uploading={busy} />
          ) : (
            <button type="button" onClick={() => input.current?.click()} className="flex h-[176px] w-[176px] flex-col items-center justify-center gap-2 rounded-full bg-[#fbf6ea] text-[#8b6a2b] dark:bg-[#1a1712] dark:text-[#e8c97a]">
              {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <ImageIcon className="h-9 w-9" />}
              <span className="text-[13px] font-black">{busy ? 'Uploading...' : 'Add photo'}</span>
            </button>
          )}
        </div>
      </div>
      <div className="w-full min-w-0 flex-1 text-center sm:text-left">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-[#111827] px-7 text-[16px] font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />} {i.photoUrl ? 'Choose a different photo' : 'Choose a photo'}
        </button>
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
        {err && <p className="mt-3 text-[14px] font-bold text-rose-600">{err}</p>}
        <ul className="mt-5 space-y-2 text-[14.5px] font-medium text-gray-600 dark:text-gray-300">
          <li>• A recent, professional headshot works best.</li>
          <li>• Face the camera, with good light.</li>
          {i.photoUrl && <li>• <b>Drag the photo</b> in the circle to center your face.</li>}
        </ul>
      </div>
    </div>
  )
}

export function StoryStep({ ctx }: { ctx: StepCtx }) {
  const [about, setAbout] = useState(ctx.data.info.about)
  const set = (x: string) => { const t = x.slice(0, BIO_MAX_CHARS); setAbout(t); ctx.saveInfo({ profile: { about: t } }) }
  useGate(ctx, { ok: true }, [])
  const starters = [
    `I help buyers and sellers in ${ctx.data.info.market || 'my area'} make confident moves.`,
    `Born and raised here, I know these neighborhoods street by street.`,
  ]
  return (
    <div>
      <label className="block">
        <span className="text-[15px] font-black text-[#111827] dark:text-white">About me</span>
        <textarea value={about} onChange={e => set(e.target.value)} rows={6} placeholder="I've helped families across the Main Line buy and sell for over 10 years..." className={`${inputCls} mt-2.5 resize-none leading-relaxed`} />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className={`text-[13px] font-bold ${about.length > BIO_MAX_CHARS - 20 ? 'text-amber-600' : 'text-gray-400'}`}>{about.length} / {BIO_MAX_CHARS}</span>
        <AiWriteButton purpose="bio_polish" getContext={() => about} onResult={t => set(fitBio(t))} disabled={!about.trim()} />
      </div>
      {!about.trim() && (
        <div className="mt-5">
          <p className="text-[14px] font-bold text-gray-500">Need a start? Tap one:</p>
          <div className="mt-2 flex flex-col gap-2">
            {starters.map(s => <button key={s} type="button" onClick={() => set(s)} className="rounded-2xl border-2 border-dashed border-[#e7dfcf] px-4 py-3 text-left text-[14.5px] font-semibold text-gray-600 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:text-gray-300 dark:hover:text-white">&ldquo;{s}&rdquo;</button>)}
          </div>
        </div>
      )}
    </div>
  )
}

const SOCIALS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-[#E4405F]', ph: 'instagram.com/yourname' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-[#1877F2]', ph: 'facebook.com/yourpage' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-[#0A66C2]', ph: 'linkedin.com/in/yourname' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-[#FF0000]', ph: 'youtube.com/@yourchannel' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: 'text-[#111827] dark:text-white', ph: 'tiktok.com/@yourname' },
  { id: 'website', label: 'Your website', icon: Globe, color: 'text-[#C9A24D]', ph: 'www.yourwebsite.com' },
] as const

export function SocialsStep({ ctx }: { ctx: StepCtx }) {
  const saved = ctx.data.social_links
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const s of SOCIALS) o[s.id] = s.id === 'linkedin' ? ctx.data.info.linkedin : (saved.find(l => l.id === s.id)?.url || '')
    return o
  })
  useGate(ctx, { ok: true }, [])
  const set = (id: string, url: string) => {
    const next = { ...urls, [id]: url }
    setUrls(next)
    if (id === 'linkedin') { ctx.saveInfo({ card: { linkedin: url } }); return }
    // keep any link the agent switched off in Agent Hub switched off, unless they changed it here
    const links: { id: string; label?: string; url: string; enabled: boolean }[] = SOCIALS.filter(s => s.id !== 'linkedin').map(s => {
      const prev = saved.find(l => l.id === s.id)
      const u = next[s.id].trim()
      return { id: s.id, label: s.id === 'website' ? 'Website' : s.label, url: u, enabled: !!u && (prev && prev.url === u ? prev.enabled !== false : true) }
    })
    // links Agent Hub has that the flow doesn't list stay as they are
    for (const l of saved) if (!links.some(x => x.id === l.id)) links.push(l)
    ctx.saveInfo({ socialLinks: links })
  }
  return (
    <WithCard ctx={ctx} over={{ socialUrls: urls }}>
    <div className="grid gap-3 sm:grid-cols-2">
      {SOCIALS.map(s => {
        const Icon = s.icon
        return (
          <label key={s.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#ece5d6] bg-white py-2 pl-4 pr-2 transition focus-within:border-[#C9A24D] dark:border-white/10 dark:bg-[#0e0e10]">
            <Icon className={`h-6 w-6 shrink-0 ${s.color}`} />
            <span className="sr-only">{s.label}</span>
            <input value={urls[s.id]} onChange={e => set(s.id, e.target.value)} placeholder={s.ph} inputMode="url" className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white" />
            {urls[s.id] && <button type="button" onClick={() => set(s.id, '')} aria-label={`Remove ${s.label}`} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-rose-500 dark:hover:bg-white/5"><Trash2 className="h-4 w-4" /></button>}
          </label>
        )
      })}
      <p className="text-[13px] font-medium text-gray-500 sm:col-span-2 dark:text-gray-400">LinkedIn goes on your Save Contact card. The others show as icons on your pages.</p>
      <div className="flex gap-2.5 rounded-2xl border border-[#FF0000]/15 bg-[#FF0000]/[0.03] px-4 py-3 sm:col-span-2">
        <Youtube className="mt-0.5 h-4 w-4 shrink-0 text-[#FF0000]" />
        <p className="text-[13px] font-medium leading-snug text-gray-600 dark:text-gray-300">
          <span className="font-black text-[#111827] dark:text-white">YouTube: use your channel&apos;s link</span>, not a single video. On YouTube, tap your profile picture, then <span className="font-bold">View your channel</span>, and copy the address - it looks like <span className="font-mono text-[12px]">youtube.com/@yourname</span>. Your newest videos then show on your Agent Hub, and the blog writer suggests the ones that fit each article.
        </p>
      </div>
    </div>
    </WithCard>
  )
}

// ---------- "How clients see you" ----------
// A live card beside the About / Contact / Socials questions that fills in as they type - the same
// name, title, brokerage, photo, buttons and icons their Agent Hub, website and signature show.
type CardOver = Partial<SetupData['info']> & { socialUrls?: Record<string, string> }
const CARD_SOCIAL_ICONS: Record<string, typeof Globe> = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, youtube: Youtube, tiktok: Music2, website: Globe }

function YouCard({ ctx, over = {} }: { ctx: StepCtx; over?: CardOver }) {
  const i = { ...ctx.data.info, ...over }
  const pos = i.photoPosition || { x: 50, y: 50 }
  const initials = (i.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
  const socials = over.socialUrls
    ? Object.entries(over.socialUrls).filter(([, u]) => u.trim()).map(([id]) => id)
    : [...ctx.data.social_links.filter(l => l.enabled !== false && l.url).map(l => l.id), ...(i.linkedin ? ['linkedin'] : [])]
  const line = [i.title, i.brokerage].filter(Boolean).join(' · ')
  const chip = (label: string, has: boolean, Icon: typeof Phone) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black transition-all duration-300 ${has ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-dashed border-gray-300 text-gray-400 dark:border-white/15'}`}>
      <Icon className="h-3.5 w-3.5" />{label}
    </span>
  )
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#d7b974]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> How clients see you</p>
      <div className="relative overflow-hidden rounded-[26px] border border-[#C9A24D]/30 bg-gradient-to-b from-[#fffaf0] to-white p-5 shadow-[0_30px_60px_-44px_rgba(139,106,43,.9)] dark:from-[#1a1712] dark:to-[#141416]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
        <div className="flex items-center gap-4 text-left lg:flex-col lg:text-center">
          <span className="relative shrink-0 rounded-full bg-gradient-to-br from-[#8b6a2b] via-[#e8c97a] to-[#C9A24D] p-[3px]">
            {i.photoUrl
              ? <img src={i.photoUrl} alt="" className="h-[72px] w-[72px] rounded-full object-cover lg:h-[88px] lg:w-[88px]" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />
              : <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#fbf6ea] font-serif text-[24px] font-black text-[#8b6a2b] dark:bg-[#1a1712] dark:text-[#e8c97a] lg:h-[88px] lg:w-[88px]">{initials || <UserRound className="h-8 w-8" />}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate font-serif text-[21px] font-black leading-tight ${i.name ? 'text-[#111827] dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>{i.name || 'Your name'}</p>
            <p className={`mt-1 truncate text-[10.5px] font-black uppercase tracking-[0.18em] ${line ? 'text-[#a8803a] dark:text-[#e8c97a]' : 'text-gray-300 dark:text-gray-600'}`}>{line || 'Title · Brokerage'}</p>
            {i.team && <p className="mt-1 truncate text-[12.5px] font-bold text-gray-500 dark:text-gray-400">{i.team}</p>}
            {i.market && <p className="mt-1 flex items-center gap-1 truncate text-[12.5px] font-semibold text-gray-500 dark:text-gray-400 lg:justify-center"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />{i.market}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 lg:justify-center">
          {chip('Call', !!i.call, Phone)}
          {chip('Text', !!(i.text || i.call), MessageSquare)}
          {chip('Email', !!i.email, Mail)}
        </div>
        {socials.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 lg:justify-center">
            {socials.map(id => { const Icon = CARD_SOCIAL_ICONS[id] || Globe; return <span key={id} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9A24D]/30 bg-white text-[#8b6a2b] dark:bg-white/5 dark:text-[#e8c97a]"><Icon className="h-4 w-4" /></span> })}
          </div>
        )}
      </div>
      <p className="mt-2 text-[12px] font-semibold text-gray-400 lg:text-center">On your Agent Hub, website and signature.</p>
    </div>
  )
}

function WithCard({ ctx, over, children }: { ctx: StepCtx; over?: CardOver; children: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">{children}</div>
      <aside className="order-first lg:order-none"><div className="lg:sticky lg:top-28"><YouCard ctx={ctx} over={over} /></div></aside>
    </div>
  )
}
