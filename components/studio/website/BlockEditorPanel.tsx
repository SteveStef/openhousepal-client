'use client'

import { useEffect, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import {
  ArrowRight, Check, ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, ExternalLink, GripVertical,
  Loader2, Lock, Plus, Trash2, Upload, X,
} from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { SiteBlock, SiteBlockType } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import { BLOCK_FIELD_SCHEMA, type BlockField } from './blockFieldSchema'
import { SECTION_GROUPS, SECTION_ORDER, SECTIONS, newSectionBlock, sectionDef, type SectionDef } from './sectionCatalogue'
import NumberInput from './NumberInput'
import OhpSwitch from '@/components/ui/OhpSwitch'

// The Content tab: a simple website builder. The list is the home page, top to bottom - drag the
// grip (or use the arrows) to reorder, the eye switches a section off without losing its settings,
// opening one shows its few plain-words settings. "Add a section" is a catalogue of complete,
// working sections (see sectionCatalogue.ts); adding one drops it in fully configured. The live
// preview (WebsiteEditorShell) follows every step - outlining, folding out, "Added"/"Moved" tags.

type ContentOptions = { forms: { id: string; title: string; form_type?: string }[]; showcases: { id: string; name: string }[] }

function getNested(data: Record<string, any>, key: string): string {
  if (!key.includes('.')) return data[key] == null ? '' : String(data[key])
  const [parent, child] = key.split('.')
  const v = data[parent]?.[child]
  return v == null ? '' : String(v)
}

function setNested(data: Record<string, any>, key: string, value: string): Record<string, any> {
  if (!key.includes('.')) return { ...data, [key]: value }
  const [parent, child] = key.split('.')
  return { ...data, [parent]: { ...(data[parent] || {}), [child]: value } }
}

const inputCls = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
const labelCls = 'text-[10px] font-black uppercase tracking-wide text-gray-400'

// Upload-or-paste picture field (hero photo, About photo, Photo section). Uploads go to the
// agent's own media library (Studio -> media), same as Design Studio.
function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState(false)
  const upload = async (file: File) => {
    setBusy(true)
    const res = await api.studio.uploadMedia(file, 'design')
    setBusy(false)
    if (res.success && res.data?.url) onChange(res.data.url)
    else showToast(res.error || 'Could not upload that photo.', 'error')
  }
  return (
    <div className="mt-1 rounded-xl border border-gray-200 p-2 dark:border-gray-700">
      <div className="flex items-center gap-2.5">
        <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
          {value && <img src={resolveMediaUrl(value)} alt="" className="h-full w-full object-cover" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-white">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {value ? 'Replace' : 'Upload a photo'}
          </button>
          <button type="button" onClick={() => setPaste(v => !v)} className="rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-[#8b7355]">{paste ? 'Hide link' : 'Paste a link'}</button>
          {value && <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-red-600"><Trash2 className="h-3 w-3" /> Remove</button>}
        </div>
      </div>
      {paste && <input value={value} onChange={e => onChange(e.target.value)} placeholder="https://..." className={inputCls} />}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
    </div>
  )
}

function Switch({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
      <span className="min-w-0"><span className="block text-xs font-bold text-gray-700 dark:text-gray-200">{label}</span>{hint && <span className="block text-[10px] font-semibold text-gray-400">{hint}</span>}</span>
      <OhpSwitch on={on} onChange={onToggle} size="sm" label={label} />
    </div>
  )
}

function Field({ field, data, options, onChange }: { field: BlockField; data: Record<string, any>; options: ContentOptions; onChange: (value: string) => void }) {
  const value = getNested(data, field.key)
  if (field.kind === 'checkbox') {
    const on = value === '' ? !!field.defaultChecked : value === 'true'
    return <Switch on={on} onToggle={() => onChange(on ? 'false' : 'true')} label={field.label} hint={field.hint} />
  }
  let control: React.ReactNode
  switch (field.kind) {
    case 'textarea':
      control = <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={field.placeholder} className={inputCls} />
      break
    case 'select':
      control = (
        <select value={value || field.options?.[0]?.value || ''} onChange={e => onChange(e.target.value)} className={inputCls}>
          {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
      break
    case 'form_picker':
      control = (
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">Choose a form...</option>
          {options.forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      )
      break
    case 'showcase_picker':
      control = (
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">Choose a showcase...</option>
          {options.showcases.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )
      break
    case 'image':
      control = <ImageField value={value} onChange={onChange} />
      break
    case 'number':
      control = <NumberInput value={value} onChange={onChange} placeholder={field.placeholder} className={inputCls} />
      break
    default:
      control = <input value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} />
  }
  return (
    <div>
      <label className={labelCls}>{field.label}</label>
      {control}
      {field.hint && <p className="mt-1 text-[10px] font-semibold text-gray-400">{field.hint}</p>}
    </div>
  )
}

function SectionRow({
  block, index, count, expanded, options, onToggleOpen, onMove, onHide, onRemove, onField, onDragEnd, onSwitchTab,
}: {
  block: SiteBlock; index: number; count: number; expanded: boolean; options: ContentOptions
  onToggleOpen: () => void; onMove: (dir: -1 | 1) => void; onHide: () => void; onRemove: () => void
  onField: (key: string, value: string) => void; onDragEnd: () => void
  onSwitchTab?: (tab: 'featured' | 'areas' | 'media' | 'reviews') => void
}) {
  const def = sectionDef(block.type)
  const controls = useDragControls()
  const Icon = def.icon
  const fields = BLOCK_FIELD_SCHEMA[block.type].filter(f => !f.showWhen || f.showWhen(block.data))
  const off = !!block.hidden
  return (
    <Reorder.Item value={block} as="div" dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      className={`group/blk rounded-2xl border bg-white transition dark:bg-[#151517] ${expanded ? 'border-[#C9A24D] shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'} ${off ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-1.5 p-2 pr-2.5">
        <button type="button" aria-label="Drag to reorder" title="Drag to reorder" onPointerDown={e => controls.start(e)} className="cursor-grab touch-none rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing dark:hover:bg-gray-800">
          <GripVertical className="h-4 w-4" />
        </button>
        <div role="button" tabIndex={0} onClick={onToggleOpen} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen() } }} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${expanded ? 'bg-[#C9A24D] text-white' : 'bg-[#111827] text-[#e8c97a] dark:bg-white/10'}`}><Icon className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-black leading-tight text-[#111827] sm:truncate dark:text-white">{def.label}</span>
              {off && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800">Off</span>}
            </span>
            {!expanded && <span className="block truncate text-[10px] font-semibold text-gray-400">{def.blurb}</span>}
          </span>
          {expanded ? <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#8b7355]" /> : <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover/blk:text-[#8b7355]" />}
        </div>
        <div className="flex shrink-0 items-center">
          {/* phones: bigger tap areas (audit 11/11) */}
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move up" aria-label="Move up" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 sm:p-1 dark:hover:bg-gray-800"><ChevronUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} title="Move down" aria-label="Move down" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 sm:p-1 dark:hover:bg-gray-800"><ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>
          <button type="button" onClick={onHide} title={off ? 'Turn this section on' : 'Turn this section off'} aria-label={off ? 'Turn this section on' : 'Turn this section off'} className={`rounded-lg p-2 transition hover:bg-gray-100 sm:p-1.5 dark:hover:bg-gray-800 ${off ? 'text-gray-400' : 'text-[#8b7355] dark:text-[#e8c97a]'}`}>
            {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5 border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
          <p className="text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{def.blurb}{def.powered ? <span className="block text-[10px] text-gray-400">{def.powered}</span> : null}</p>
          {fields.map(field => <Field key={field.key} field={field} data={block.data} options={options} onChange={v => onField(field.key, v)} />)}
          {fields.length === 0 && <p className="text-xs font-semibold text-gray-400">Nothing to set up - it just works.</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            {def.manage?.href && (
              <a href={def.manage.href} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#C9A24D]">{def.manage.label} <ExternalLink className="h-2.5 w-2.5" /></a>
            )}
            {def.manage?.tab && onSwitchTab && (
              <button type="button" onClick={() => onSwitchTab(def.manage!.tab!)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#C9A24D]">{def.manage.label} <ArrowRight className="h-2.5 w-2.5" /></button>
            )}
            {!def.core && (
              <button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-red-600"><Trash2 className="h-3 w-3" /> Remove from page</button>
            )}
          </div>
        </div>
      )}
    </Reorder.Item>
  )
}

export default function BlockEditorPanel({
  blocks,
  onChange,
  onOpenChange,
  onSwitchTab,
}: {
  blocks: SiteBlock[]
  onChange: (blocks: SiteBlock[]) => void
  /** The section open for editing (or null) - the live preview scrolls to and outlines it. */
  onOpenChange?: (id: string | null) => void
  /** Shortcuts from a section to the editor tab that feeds it (Featured homes, Areas). */
  onSwitchTab?: (tab: 'featured' | 'areas' | 'media' | 'reviews') => void
}) {
  const { showToast } = useToast()
  const [options, setOptions] = useState<ContentOptions>({ forms: [], showcases: [] })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [catalogueOpen, setCatalogueOpen] = useState(false)
  // Drag reorders live in local state while the pointer is down and commit once on drop - so
  // the preview plays one "Moved" animation per drag, not one per row crossed.
  const [order, setOrder] = useState<SiteBlock[]>(blocks)
  const orderRef = useRef(order)
  orderRef.current = order
  useEffect(() => { setOrder(blocks) }, [blocks])

  useEffect(() => {
    onOpenChange?.(expandedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId])
  useEffect(() => () => onOpenChange?.(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Forms/showcases for the pickers and for a new Lead Form's default (the general "How Can I
  // Help?" form) - a thin list, not a second place to manage them.
  useEffect(() => {
    api.sites.getContentOptions().then(res => { if (res.success && res.data) setOptions(res.data) })
  }, [])

  const updateBlock = (id: string, patch: Partial<SiteBlock>) => onChange(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)))
  // Clears _template_generated the instant an agent hand-edits a template block, so re-applying
  // the template later never overwrites this customization (backend starter_template._merge_page).
  const updateBlockData = (id: string, key: string, value: string) => onChange(blocks.map(b => (b.id === id ? { ...b, data: { ...setNested(b.data, key, value), _template_generated: false } } : b)))
  const removeBlock = (id: string) => { if (expandedId === id) setExpandedId(null); onChange(blocks.filter(b => b.id !== id)) }
  // The home page never draws a Contact Band section - it always closes with the footer's
  // "Let's talk about your next move" band (SitePageRenderer, owner's call 10/07). Older sites may
  // still carry one in their data: keep it there (last) but never list it, so agents can't edit
  // fields that change nothing (audit 11/11).
  const isBand = (b: SiteBlock) => b.type === 'contact_cta'
  const rows = order.filter(b => !isBand(b))
  const moveBlock = (index: number, direction: -1 | 1) => {
    const list = blocks.filter(b => !isBand(b))
    const target = index + direction
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    onChange([...list, ...blocks.filter(isBand)])
  }
  const commitDrag = () => {
    const next = orderRef.current
    if (next.some((b, i) => b.id !== blocks[i]?.id)) onChange(next)
  }

  const present = new Map(blocks.map(b => [b.type, b]))
  const addSection = (def: SectionDef) => {
    const extra: Record<string, any> = {}
    if (def.type === 'form') {
      const general = options.forms.find(f => f.form_type === 'how_can_i_help') || options.forms[0]
      if (!general) { showToast('Create a form first in Studio → Forms, then add it here.', 'error'); return }
      extra.form_id = general.id
    }
    if (def.type === 'showcase') {
      // No showcase to show = a section nobody would ever see (it renders nothing) - say so instead.
      if (!options.showcases[0]) { showToast('Make a Showcase first in Showcases, then add it here.', 'error'); return }
      extra.collection_id = options.showcases[0].id
    }
    const block = newSectionBlock(def.type, extra)
    // New sections land just above the closing Contact band when it's last, otherwise at the end.
    const next = [...blocks]
    const last = next[next.length - 1]
    if (last && last.type === 'contact_cta' && def.type !== 'contact_cta') next.splice(next.length - 1, 0, block)
    else next.push(block)
    onChange(next)
    setCatalogueOpen(false)
    setExpandedId(block.id)
  }
  const turnOn = (block: SiteBlock) => { updateBlock(block.id, { hidden: false }); setCatalogueOpen(false); setExpandedId(block.id) }

  const onCount = blocks.filter(b => !b.hidden && !isBand(b)).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">{onCount} section{onCount === 1 ? '' : 's'} on your page</p>
        <p className="text-[10px] font-semibold text-gray-400">Top to bottom, like your site. Drag the grip to reorder.</p>
      </div>

      <Reorder.Group axis="y" values={rows} onReorder={vis => setOrder([...vis, ...orderRef.current.filter(isBand)])} as="div" className="space-y-2.5">
        {rows.map((block, index) => (
          <SectionRow
            key={block.id}
            block={block}
            index={index}
            count={rows.length}
            expanded={expandedId === block.id}
            options={options}
            onToggleOpen={() => setExpandedId(expandedId === block.id ? null : block.id)}
            onMove={dir => moveBlock(index, dir)}
            onHide={() => updateBlock(block.id, { hidden: !block.hidden })}
            onRemove={() => removeBlock(block.id)}
            onField={(key, value) => updateBlockData(block.id, key, value)}
            onDragEnd={commitDrag}
            onSwitchTab={onSwitchTab}
          />
        ))}
      </Reorder.Group>

      {/* Always-on closing band - shown so agents know it's there and where its info comes from */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-300"><Lock className="h-3.5 w-3.5" /></span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black text-[#111827] dark:text-white">&quot;Let&apos;s talk&quot; closing band</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800">Always last</span>
          </span>
          <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Your site always closes with &quot;Let&apos;s talk about your next move&quot;: home value, home search and consultation buttons, then your agent card. Your photo and contact info come from your Agent Hub - change them there.</span>
        </span>
      </div>

      {/* Add a section - the catalogue */}
      {!catalogueOpen ? (
        <button type="button" onClick={() => setCatalogueOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.04] px-4 py-3.5 text-sm font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-[#C9A24D]/30 dark:text-[#e8c97a]">
          <Plus className="h-4 w-4" /> Add a section
        </button>
      ) : (
        <div className="rounded-2xl border border-[#C9A24D]/50 bg-[#fffdf7] p-3 shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)] dark:bg-[#161410]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#111827] dark:text-white">Add a section</p>
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Each one arrives complete and working - pick it, then fine-tune the words.</p>
            </div>
            <button type="button" onClick={() => setCatalogueOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 space-y-4">
            {SECTION_GROUPS.map(group => {
              // (This panel edits the home page, which always ends with its own contact band.)
              const defs = SECTION_ORDER.map(t => SECTIONS[t]).filter(d => d.group === group.id && d.addable !== false && d.type !== 'contact_cta')
              if (!defs.length) return null
              return (
                <div key={group.id}>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{group.label} <span className="font-semibold normal-case tracking-normal text-gray-400">· {group.blurb}</span></p>
                  <div className="mt-1.5 space-y-1.5">
                    {defs.map(def => {
                      const existing = present.get(def.type)
                      const onPage = !!existing && def.single
                      const Icon = def.icon
                      return (
                        <div key={def.type} className={`flex items-center gap-2.5 rounded-xl border bg-white p-2 dark:bg-[#151517] ${onPage && !existing?.hidden ? 'border-gray-100 opacity-70 dark:border-gray-800' : 'border-gray-200 dark:border-gray-800'}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a] dark:bg-white/10"><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-black text-[#111827] dark:text-white">{def.label}</span>
                            <span className="block text-[10px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{def.blurb}</span>
                            {def.powered && <span className="block text-[9px] font-semibold text-gray-400">{def.powered}</span>}
                          </span>
                          {onPage ? (
                            existing!.hidden ? (
                              <button type="button" onClick={() => turnOn(existing!)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-black dark:bg-white dark:text-[#111827]"><Eye className="h-3 w-3" /> Turn on</button>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3 w-3" /> On page</span>
                            )
                          ) : (
                            <button type="button" onClick={() => addSection(def)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:-translate-y-0.5"><Plus className="h-3 w-3" /> Add</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
