'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronRight, Copy, Crown, Home, Link2, Megaphone, Palette, Plus, QrCode, RotateCcw, Sparkles, UserRound, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { DesignBlock, FormCampaign } from '@/types'
import { blockId, DESIGN_STYLES } from '@/lib/studio/designFormats'
import { DESIGN_COLOR_MODES, joinColorMode, splitColorMode } from '@/lib/studio/designColors'
import { brandSwatch } from '@/lib/studio/designTheme'
import { LUXE_METALS } from '@/lib/luxeMetals'
import LuxeFinishPicker from '@/components/studio/design/LuxeFinishPicker'
import { getTemplatesFor, isCompositionReady, isStyleReady } from '@/lib/studio/designTemplates'
import { pickBestForm } from '@/lib/studio/formFit'
import { COMPOSITION_LABELS } from '@/lib/studio/designCompositions'
import { DesignPreview } from '@/components/studio/design/StyleThumbnail'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import NewCampaignModal from '@/components/forms/NewCampaignModal'
import { CampaignRedirect, campaignRedirectPayload } from '@/components/forms/CampaignRedirectPicker'
import { Card, Field, Note, Seg, Toggle, UploadTile, inputCls, labelCls, money, useDraftValue } from './ui'
import { EditorCtl, find } from './cards'
import { copyText } from '@/lib/copyText'

const setData = (ctl: EditorCtl, id: string, patch: Record<string, any>) => ctl.updateBlock(id, b => ({ ...b, data: { ...b.data, ...patch } }))
const setOverride = (ctl: EditorCtl, id: string, key: string, value: any) => ctl.updateBlock(id, b => {
  const next = { ...b.overrides }
  if (value === undefined || value === null || value === '') delete next[key]
  else next[key] = value
  return { ...b, overrides: next }
})

function DraftInput({ label, value, placeholder, onCommit, hint }: { label: string; value: string; placeholder?: string; onCommit: (v: string) => void; hint?: string }) {
  const [draft, setDraft] = useDraftValue(value, onCommit)
  return (
    <Field label={label} hint={hint}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} className={inputCls} /></Field>
  )
}

// ---------------------------------------------------------------------------------------------
// You - who the design is from: headshot, name, contact details, logo, fine print.
// ---------------------------------------------------------------------------------------------
export function YouCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const agent = find(ctl.blocks, 'agent_info')
  const branding = find(ctl.blocks, 'brokerage_branding')
  const bk = ctl.brandKit
  const a = ctl.agent
  const logos = ([
    { mode: 'personal' as const, label: 'My logo', url: bk?.personal_logo_url },
    { mode: 'team' as const, label: 'Team logo', url: bk?.team_logo_url },
    { mode: 'brokerage' as const, label: 'Brokerage logo', url: bk?.brokerage_logo_url },
  ]).filter(l => !!l.url)
  const logoOn = !!logos.length && ctl.design.branding_mode !== 'none' && !branding?.hidden && logos.some(l => l.mode === ctl.design.branding_mode)
  const scale: '0.8' | '1' | '1.3' = String(Number(branding?.data?.scale) || 1) as any
  const ov = (k: string) => (agent?.overrides?.[k] ?? '') as string
  const overridden = !!agent && Object.keys(agent.overrides || {}).length > 0
  const [moreOpen, setMoreOpen] = useState(overridden)
  const ensureBranding = (patch: Partial<DesignBlock>) => {
    if (branding) ctl.updateBlock(branding.id, b => ({ ...b, ...patch, data: { ...b.data, ...(patch.data || {}) } }))
    else ctl.addBlock({ id: blockId('brokerage_branding'), type: 'brokerage_branding', hidden: false, data: {}, overrides: {}, ...patch })
  }
  const pickLogo = (mode: 'personal' | 'team' | 'brokerage' | 'none') => {
    ctl.setBrandingMode(mode)
    if (mode !== 'none') ensureBranding({ hidden: false })
  }
  const hint = [a.agentName || 'Your name', ctl.design.branding_mode !== 'none' && logoOn ? 'logo on' : null].filter(Boolean).join(' · ')

  return (
    <Card icon={UserRound} title="You" hint={hint} open={open} onToggle={onToggle} flash={flash}>
      {agent ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-[#C9A24D]/40">
              {(ov('photo_url') || a.agentPhotoUrl) && !agent.data?.hidePhoto ? <img src={ov('photo_url') || a.agentPhotoUrl || ''} alt="" className="h-full w-full object-cover" /> : <UserRound className="m-3 h-6 w-6 text-gray-300" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{ov('name') || a.agentName || 'Your name'}</p>
              <p className="truncate text-[11px] font-semibold text-gray-400">{[ov('title') || a.agentTitle, ov('brokerage') || a.agentBrokerage].filter(Boolean).join(' · ') || 'Title · Brokerage'}</p>
              <p className="truncate text-[11px] font-semibold text-gray-400">{[agent.data?.hidePhone ? null : ov('phone') || a.agentPhone, agent.data?.hideEmail ? null : ov('email') || a.agentEmail].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div>
            <p className={labelCls}>Show on this design</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([['hidePhoto', 'Headshot'], ['hidePhone', 'Phone'], ['hideEmail', 'Email']] as const).map(([key, label]) => {
                const on = !agent.data?.[key]
                return <button key={key} type="button" onClick={() => setData(ctl, agent.id, { [key]: on })} className={`rounded-xl border px-2 py-2 text-xs font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-400 dark:border-white/10'}`}>{on ? <Check className="mr-1 inline h-3 w-3" /> : null}{label}</button>
              })}
            </div>
          </div>
          <button type="button" onClick={() => setMoreOpen(v => !v)} className="inline-flex items-center gap-1 text-[12px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-90' : ''}`} /> Use different details on this design
          </button>
          {moreOpen && (
            <div className="space-y-3 rounded-xl border border-dashed border-gray-200 p-3 dark:border-white/10">
              <p className="text-[11px] font-semibold text-gray-400">Blank = whatever is on your profile. These changes only affect this one design.</p>
              <div className="grid grid-cols-2 gap-2">
                <DraftInput label="Name" value={ov('name')} placeholder={a.agentName || 'Your name'} onCommit={v => setOverride(ctl, agent.id, 'name', v)} />
                <DraftInput label="Title" value={ov('title')} placeholder={a.agentTitle || 'REALTOR®'} onCommit={v => setOverride(ctl, agent.id, 'title', v)} />
                <DraftInput label="Brokerage / team" value={ov('brokerage')} placeholder={a.agentBrokerage || 'Your brokerage'} onCommit={v => setOverride(ctl, agent.id, 'brokerage', v)} />
                <DraftInput label="Phone" value={ov('phone')} placeholder={a.agentPhone || '(555) 555-0123'} onCommit={v => setOverride(ctl, agent.id, 'phone', v)} />
                <DraftInput label="Email" value={ov('email')} placeholder={a.agentEmail || 'you@brokerage.com'} onCommit={v => setOverride(ctl, agent.id, 'email', v)} />
                <DraftInput label="Website" value={ov('website')} placeholder="yoursite.com" onCommit={v => setOverride(ctl, agent.id, 'website', v)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <UploadTile compact label={ov('photo_url') ? 'Replace headshot' : 'Different headshot'} onUploaded={url => setOverride(ctl, agent.id, 'photo_url', url)} />
                {ov('photo_url') && <button type="button" onClick={() => setOverride(ctl, agent.id, 'photo_url', '')} className="text-[11px] font-black text-gray-400 hover:text-red-600">Use my profile photo</button>}
                {overridden && <button type="button" onClick={() => ctl.updateBlock(agent.id, b => ({ ...b, overrides: {} }))} className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline"><RotateCcw className="h-3 w-3" /> Back to my profile</button>}
              </div>
            </div>
          )}
        </>
      ) : (
        <button type="button" onClick={() => ctl.addBlock({ id: blockId('agent_info'), type: 'agent_info', hidden: false, data: {}, overrides: {} })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15"><Plus className="h-3.5 w-3.5" /> Add my name & contact details</button>
      )}

      {ctl.draws?.logo !== false && <div>
        <p className={labelCls}>Logo</p>
        {logos.length === 0 ? (
          <Note>No logos yet. <a href="/studio/brand-kit" className="font-black text-[#8b7355] hover:underline">Add your logo in Branding</a> and it will appear on every design.</Note>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {logos.map(l => {
                const on = logoOn && ctl.design.branding_mode === l.mode
                return (
                  <button key={l.mode} type="button" onClick={() => pickLogo(l.mode)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'}`}>
                    <span className="flex h-12 w-full items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-black/5"><img src={l.url!} alt="" className="max-h-full max-w-full object-contain" /></span>
                    <span className="text-[11px] font-black text-[#111827] dark:text-white">{l.label}</span>
                  </button>
                )
              })}
              <button type="button" onClick={() => pickLogo('none')} className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition ${!logoOn ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'}`}>
                <span className="flex h-12 w-full items-center justify-center rounded-lg text-gray-300"><X className="h-5 w-5" /></span>
                <span className="text-[11px] font-black text-gray-500">No logo</span>
              </button>
            </div>
            {logoOn && (
              <div className="mt-2">
                <p className="mb-1.5 text-[11px] font-semibold text-gray-400">Logo size</p>
                <Seg value={scale} options={[{ value: '0.8', label: 'Smaller' }, { value: '1', label: 'Normal' }, { value: '1.3', label: 'Larger' }]} onChange={v => ensureBranding({ data: { scale: Number(v) } })} />
              </div>
            )}
            <a href="/studio/brand-kit" className="mt-2 inline-block text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Manage logos in Branding →</a>
          </>
        )}
      </div>}

      {agent && (ctl.format.isPrint || ctl.leadGen) && (
        <Field label="Fine print" hint="Printed and mailed pieces carry a short disclaimer. Blank uses your Brand Kit disclaimer, or the standard Equal Housing line." action={agent.data?.disclaimer !== undefined ? <button type="button" onClick={() => ctl.updateBlock(agent.id, b => { const d = { ...b.data }; delete d.disclaimer; return { ...b, data: d } })} className="text-[10px] font-black text-[#8b7355] hover:underline">Use the default</button> : undefined}>
          <FinePrintInput value={agent.data?.disclaimer ?? ''} onCommit={v => setData(ctl, agent.id, { disclaimer: v })} />
        </Field>
      )}
      <a href="/settings" className="inline-block text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Update your photo & contact details in Settings →</a>
    </Card>
  )
}

function FinePrintInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useDraftValue(value, onCommit)
  return <textarea rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Information deemed reliable but not guaranteed. Equal Housing Opportunity." className={`${inputCls} resize-none text-sm leading-5`} />
}

// ---------------------------------------------------------------------------------------------
// Look - layout, style, color. Every tile is the agent's own design rendered that way.
// ---------------------------------------------------------------------------------------------
function LookTile({ selected, label, onClick, luxe, locked, children, swatch, soon }: { selected: boolean; label: string; onClick: () => void; luxe?: boolean; locked?: boolean; children: React.ReactNode; swatch?: [string, string]; soon?: boolean }) {
  // not signed off yet (user 10/12): shown so agents see what's coming, but it can't be picked
  if (soon && !selected && luxe) return (
    <div aria-disabled="true" title="Coming soon" className="relative cursor-not-allowed select-none overflow-hidden rounded-xl border-2 border-[#C9A24D]/45 bg-gradient-to-br from-[#111827] to-[#2a2218] text-left">
      <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
      <div className="pointer-events-none p-1.5 opacity-60">{children}</div>
      <div className="px-2 pb-2"><span className="truncate text-[11px] font-black text-[#f3dfa8]">{label}</span></div>
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b8913f] to-[#e8c97a] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#111827]"><Sparkles className="h-2.5 w-2.5" /> Luxe · Coming soon</span>
    </div>
  )
  if (soon && !selected) return (
    <div aria-disabled="true" title="Coming soon" className="relative cursor-not-allowed select-none overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white text-left dark:border-white/10 dark:bg-white/[0.03]">
      <div className="pointer-events-none p-1.5 opacity-40 grayscale">{children}</div>
      <div className="px-2 pb-2"><span className="truncate text-[11px] font-black text-gray-400">{label}</span></div>
      <span className="absolute left-2 top-2 rounded-full bg-[#111827] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white dark:bg-white dark:text-[#111827]">Coming soon</span>
    </div>
  )
  return (
    <button type="button" onClick={onClick} className={`relative overflow-hidden rounded-xl border-2 text-left transition ${selected ? 'border-[#C9A24D] shadow-[0_10px_24px_-14px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'} ${luxe ? 'bg-gradient-to-br from-[#111827] to-[#2a2218]' : 'bg-white dark:bg-white/[0.03]'}`}>
      <div className="p-1.5">{children}</div>
      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        <span className={`truncate text-[11px] font-black ${luxe ? 'text-[#f3dfa8]' : 'text-[#111827] dark:text-white'}`}>{label}{locked ? ' · IDX' : ''}</span>
        {swatch ? <span className="flex -space-x-1">{swatch.map((c, i) => <span key={i} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />)}</span> : selected ? <Check className="h-3.5 w-3.5 text-[#C9A24D]" /> : null}
      </div>
      {luxe && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b8913f] to-[#e8c97a] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#111827]">{locked ? <Crown className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />} Luxe</span>}
    </button>
  )
}

export function LookCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const layouts = ctl.situation ? getTemplatesFor(ctl.situation, ctl.design.design_type) : []
  const [pitch, setPitch] = useState(false)
  const styleLabel = DESIGN_STYLES.find(s => s.id === ctl.design.style_id)?.label
  const { base: baseColor, metal } = splitColorMode(ctl.design.color_mode)
  const colorLabel = [DESIGN_COLOR_MODES.find(c => c.id === baseColor)?.label, metal && `Luxe ${LUXE_METALS[metal].label}`].filter(Boolean).join(' · ')
  const layoutLabel = layouts.find(t => t.id === ctl.design.template_id)?.label
  return (
    <Card icon={Palette} title="Look" hint={[layoutLabel, styleLabel, colorLabel].filter(Boolean).join(' · ') || 'Layout, style and color'} open={open} onToggle={onToggle} flash={flash}>
      {pitch && !ctl.isIdx && <LuxeUpgradePitch feature="Studio Luxe" text="The Luxe layout and Luxe theme come with IDX." />}
      {layouts.length > 1 && (
        <div>
          <p className={labelCls}>Layout</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Same words and photos, arranged differently. Nothing you typed is lost when you switch.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {layouts.map(t => {
              const locked = t.composition === 'luxe' && !ctl.isIdx
              return (
                <LookTile key={t.id} soon={!isCompositionReady(t.composition)} selected={ctl.design.template_id === t.id} label={COMPOSITION_LABELS[t.composition]?.label || t.label} luxe={t.composition === 'luxe'} locked={locked} onClick={() => { if (locked) { setPitch(true); return } ctl.changeLook({ template_id: t.id }) }}>
                  <DesignPreview blocks={ctl.blocks} ctx={{ ...ctl.ctx, composition: t.composition, layoutHints: t.layoutHints }} rounded={false} />
                </LookTile>
              )
            })}
          </div>
        </div>
      )}
      <div>
        <p className={labelCls}>Style</p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-400">The typography and finishing details.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[...DESIGN_STYLES.filter(s => isStyleReady(s.id)), ...DESIGN_STYLES.filter(s => !isStyleReady(s.id))].map(s => (
            <LookTile key={s.id} soon={!isStyleReady(s.id)} selected={ctl.design.style_id === s.id} label={s.label} onClick={() => ctl.changeLook({ style_id: s.id })}>
              <DesignPreview blocks={ctl.blocks} ctx={{ ...ctl.ctx, styleId: s.id }} rounded={false} />
            </LookTile>
          ))}
        </div>
      </div>
      <div>
        <p className={labelCls}>Color theme</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DESIGN_COLOR_MODES.map(c => {
            const locked = c.id === 'luxe' && !ctl.isIdx
            const swatch: [string, string] = c.id === 'brand' ? brandSwatch(ctl.brandKit) : c.swatch
            return (
              <LookTile key={c.id} selected={baseColor === c.id} label={c.label} luxe={c.id === 'luxe'} locked={locked} swatch={swatch} onClick={() => { if (locked) { setPitch(true); return } ctl.changeLook({ color_mode: joinColorMode(c.id, metal) }) }}>
                <DesignPreview blocks={ctl.blocks} ctx={{ ...ctl.ctx, colorMode: joinColorMode(c.id, metal) }} rounded={false} />
              </LookTile>
            )
          })}
        </div>
        <div className="mt-3">
          <LuxeFinishPicker compact value={metal} goldTheme={baseColor === 'luxe' || ctl.ctx.composition === 'luxe'} locked={!ctl.isIdx} onChange={m => { if (m && !ctl.isIdx) { setPitch(true); return } ctl.changeLook({ color_mode: joinColorMode(baseColor, m) }) }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold text-gray-400">Brand uses your brand color from Branding. <a href="/studio/brand-kit" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline">Open Branding</a></p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Property - which listing fills this design.
// ---------------------------------------------------------------------------------------------
export function PropertyCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const p = ctl.property
  return (
    <Card icon={Home} title="Property" hint={p ? p.address : 'No property attached'} open={open} onToggle={onToggle} flash={flash}>
      {p ? (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
          <span className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{p.address}</p>
            <p className="truncate text-[11px] font-semibold text-gray-400">{[p.city && `${p.city}${p.state ? `, ${p.state}` : ''}`, money(p.close_price || p.price), p.beds && `${p.beds} bd`, p.baths && `${p.baths} ba`, p.sqft && `${Number(p.sqft).toLocaleString()} sqft`].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ) : (
        <Note>Attach a listing and the address, price, facts, photos and description fill in automatically.</Note>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={ctl.openPropertyPicker} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]"><Home className="h-3.5 w-3.5" /> {p ? 'Change property' : 'Attach a property'}</button>
        {p && <button type="button" onClick={ctl.resetToListing} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:text-white"><RotateCcw className="h-3.5 w-3.5" /> Refill from the listing</button>}
      </div>
      {p && <p className="text-[11px] font-semibold text-gray-400">&ldquo;Refill&rdquo; puts back the listing&apos;s own address, price, facts and description - handy if you changed something and want the original back.</p>}
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Leads & QR - the form this piece sends people to, and the QR code on print pieces.
// ---------------------------------------------------------------------------------------------
const FORM_TYPE_LABELS: Record<string, string> = {
  buying: 'Buyer form', selling: 'Seller form', home_value: 'Home value form', showing: 'Showing request',
  how_can_i_help: 'How Can I Help form', make_me_sell: 'Make Me Sell form', seller_onboarding: 'Seller onboarding', buyer_onboarding: 'Buyer onboarding', showcase_request: 'Showcase request',
}

export function LeadsCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const qr = find(ctl.blocks, 'qr_code')
  const isPrint = ctl.format.isPrint
  const info = ctl.campaignInfo
  // campaignInfo arrives a beat after the design; the design's own campaign_id is known at once.
  const [picking, setPicking] = useState(!ctl.design.campaign_id)
  const [formId, setFormId] = useState<string | null>(info?.form_id || null)
  const [campaigns, setCampaigns] = useState<FormCampaign[]>([])
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (info) setFormId(info.form_id) }, [info?.form_id])
  useEffect(() => {
    if (!formId) { setCampaigns([]); return }
    let alive = true
    setLoading(true)
    api.forms.getCampaigns(formId).then(res => { if (!alive) return; setCampaigns(res.success && res.data ? res.data.filter(c => !c.deleted_at) : []); setLoading(false) })
    return () => { alive = false }
  }, [formId])
  const headlineText = (ctl.blocks.find(b => b.type === 'headline')?.data as { text?: string } | undefined)?.text || ''
  const enabled = ctl.agentForms.filter(f => f.is_enabled)
  const best = pickBestForm(enabled.filter(f => f.form_type !== 'custom'), ctl.situation, headlineText)
  const forms = best ? [best, ...enabled.filter(f => f.id !== best.id)] : enabled
  useEffect(() => { if (!info && !formId && best) setFormId(best.id) }, [info, formId, best?.id])
  const createCampaign = async (name: string, redirect: CampaignRedirect) => {
    if (!formId) return false
    const res = await api.forms.createCampaign(formId, name, campaignRedirectPayload(redirect))
    if (res.success && res.data?.id) { ctl.changeCampaign(res.data.id); setShowNew(false); setPicking(false); return true }
    return false
  }
  const copy = () => { if (ctl.trackingUrl) { copyText(ctl.trackingUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } }
  const target = qr?.data?.target || 'property'
  const premade = forms.filter(f => f.form_type !== 'custom')
  const custom = forms.filter(f => f.form_type === 'custom')
  const noOpenHouse = (target === 'property' || target === 'open_house_registration') && ctl.linkedOpenHouses.length === 0 && !ctl.campaignInfo

  return (
    <Card icon={Megaphone} title={isPrint ? 'Leads & QR code' : 'Leads'} hint={info ? `Tracking as "${info.name}"` : isPrint && qr && !qr.hidden ? 'QR code on · not tracked' : 'Not tracking leads yet'} open={open} onToggle={onToggle} flash={flash}>
      {info && !picking ? (
        <div className="space-y-3 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.06] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{info.name}</p>
              <p className="truncate text-[11px] font-semibold text-gray-500">Under {info.form_title} · every response shows in Forms</p>
            </div>
            <button type="button" onClick={() => ctl.changeCampaign(null)} title="Stop tracking" className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
          </div>
          {isPrint ? (
            <p className="flex items-center gap-1.5 text-[11px] font-black text-[#8b7355]"><QrCode className="h-3.5 w-3.5" /> The QR code on this piece opens this campaign&apos;s form.</p>
          ) : (
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Paste this link in your caption, bio or Story:</p>
              <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-black/20">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-400" /><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">{ctl.trackingUrl}</span>
                <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-[#111827] px-2 py-1 text-[10px] font-black text-white dark:bg-white dark:text-[#111827]">{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
          )}
          <button type="button" onClick={() => setPicking(true)} className="text-[11px] font-black text-[#8b7355] hover:underline">Change campaign</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-gray-400">Pick the form people fill out{isPrint ? ' when they scan' : ''} - each response is saved and counted for this piece.</p>
          {forms.length === 0 ? (
            <Note>No forms turned on yet. <a href="/studio/site?tab=forms" className="font-black text-[#8b7355] hover:underline">Turn on a form</a> to track leads.</Note>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {forms.map(f => (
                  <button key={f.id} type="button" onClick={() => setFormId(f.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${formId === f.id ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>{f.title}{best?.id === f.id && <span className="rounded-full bg-[#C9A24D]/20 px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-[#8b7355]">Best fit</span>}</button>
                ))}
              </div>
              {formId && (
                <div>
                  <p className={labelCls}>Campaign</p>
                  <div className={`mt-1.5 space-y-1.5 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    {campaigns.filter(c => !c.is_general && c.id).map(c => (
                      <button key={c.id!} type="button" onClick={() => { ctl.changeCampaign(c.id!); setPicking(false) }} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-black transition ${ctl.design.campaign_id === c.id ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
                        <span>{c.name}</span><span className="text-[10px] font-semibold text-gray-400">{c.leads} lead{c.leads === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                    <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15"><Plus className="h-3.5 w-3.5" /> New campaign for this piece</button>
                  </div>
                </div>
              )}
            </>
          )}
          {info && <button type="button" onClick={() => setPicking(false)} className="text-[11px] font-black text-gray-400 hover:text-gray-600">Cancel</button>}
        </div>
      )}

      {qr && (
        <div className="space-y-3">
          <Toggle label="QR code on this piece" hint={qr.hidden ? 'Off - you still get the link.' : 'People scan it with their phone camera.'} on={!qr.hidden} onChange={on => ctl.updateBlock(qr.id, b => ({ ...b, hidden: !on }))} />
          {!qr.hidden && (
            <>
              {!info && (
                <Field label="Where the QR code goes">
                  <select value={target} onChange={e => setData(ctl, qr.id, { target: e.target.value })} className={inputCls}>
                    <option value="property">The open house sign-in page</option>
                    <option value="open_house_registration">Open house registration</option>
                    <option value="agent_hub">My Agent Hub</option>
                    {target === 'buyer_form' && <option value="buyer_form">Buyer form (older link)</option>}
                    {target === 'seller_form' && <option value="seller_form">Seller form (older link)</option>}
                    {premade.length > 0 && <optgroup label="My forms">{premade.map(f => <option key={f.id} value={`form:${f.slug}`}>{FORM_TYPE_LABELS[f.form_type] || f.title}</option>)}</optgroup>}
                    {custom.length > 0 && <optgroup label="Custom forms">{custom.map(f => <option key={f.id} value={`form:${f.slug}`}>{f.title}</option>)}</optgroup>}
                    <option value="custom">A web address I type</option>
                  </select>
                </Field>
              )}
              {!info && target === 'custom' && <QrText label="Web address" value={qr.data?.customUrl || ''} placeholder="https://" onCommit={v => setData(ctl, qr.id, { customUrl: v })} />}
              {!info && noOpenHouse && <Note tone="warn">No open house is linked to this property yet, so the code will open your Agent Hub instead. Pick a form above, or schedule the open house first.</Note>}
              <QrText label="Words beside the code" value={qr.data?.label || ''} placeholder="Scan for details" onCommit={v => setData(ctl, qr.id, { label: v })} />
            </>
          )}
        </div>
      )}
      {!qr && isPrint && (
        <button type="button" onClick={() => ctl.addBlock({ id: blockId('qr_code'), type: 'qr_code', hidden: false, data: { target: 'property', label: 'Scan for details' }, overrides: {} })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15"><Plus className="h-3.5 w-3.5" /> Add a QR code</button>
      )}
      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreate={createCampaign} formGoesToHub={ctl.agentForms.find(f => f.id === formId)?.redirect_to_agent_hub ?? true} />}
    </Card>
  )
}

function QrText({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useDraftValue(value, onCommit)
  return <Field label={label}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} className={inputCls} /></Field>
}

export { Copy }
