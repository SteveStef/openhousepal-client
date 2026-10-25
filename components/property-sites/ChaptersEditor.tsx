'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import api from '@/lib/api-service'
import type { PropertyWebsiteChapter } from '@/types'

// Mirrors backend/app/services/property_website_service.py's CHAPTER_TYPES - keep both in sync.
export const CHAPTER_TYPE_LABELS: Record<string, string> = {
  exterior_arrival: 'Exterior / Arrival',
  great_room: 'Living Room / Great Room',
  kitchen: 'Kitchen',
  dining_room: 'Dining Room',
  primary_suite: 'Primary Suite',
  additional_bedrooms: 'Additional Bedrooms',
  bathrooms: 'Bathrooms',
  grounds_backyard: 'Grounds / Backyard',
  pool_spa: 'Pool & Spa',
  porch_patio: 'Porch / Patio',
  garage_automotive: 'Garage / Automotive',
  office_den: 'Office / Den',
  basement_rec: 'Basement / Rec Room',
  custom: 'Custom',
}
const STANDARD_TYPES = Object.keys(CHAPTER_TYPE_LABELS).filter(t => t !== 'custom')
const MAX_CUSTOM = 3

// Agent-editable room/section photo mapping for Cinematic Luxury's chapter storytelling layout.
// A photo belongs to one section at a time (see togglePhoto) - unassigned photos just stay
// available to pick for a different section, or none at all. Persisted per-listing via the
// caller's own save flow (draft_data.chapters), not per-template.
// The room's name: looks like a field you can type in, and wraps onto a second line instead of
// cutting a long name off ("Grand Exterior & Grounds").
function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} aria-label="Section name"
      onChange={e => onChange(e.target.value.replace(/\s*\n\s*/g, ' '))}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
      className="block min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2 text-[16px] font-black leading-snug text-[#111827] outline-none dark:text-white sm:text-sm" />
  )
}

export default function ChaptersEditor({
  chapters, onChange, photos, description,
}: {
  chapters: PropertyWebsiteChapter[]
  onChange: (chapters: PropertyWebsiteChapter[]) => void
  photos: string[]
  description: string
}) {
  const [openId, setOpenId] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Opening a room on a phone glides the page down to it, so the agent sees what opened.
  const toggleOpen = (id: string) => {
    const opening = openId !== id
    setOpenId(opening ? id : '')
    if (opening && typeof window !== 'undefined' && window.innerWidth < 768) {
      window.setTimeout(() => rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320)
    }
  }

  const customCount = chapters.filter(c => c.type === 'custom').length
  const usedTypes = new Set(chapters.map(c => c.type))

  const addChapter = (type: string) => {
    const id = `${type}-${Date.now()}`
    onChange([...chapters, { id, type, label: CHAPTER_TYPE_LABELS[type] || 'Custom Section', enabled: true, photos: [], copy: '' }])
    setOpenId(id)
    setShowAddPicker(false)
  }

  const updateChapter = (id: string, patch: Partial<PropertyWebsiteChapter>) => {
    onChange(chapters.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeChapter = (id: string) => {
    onChange(chapters.filter(c => c.id !== id))
    if (openId === id) setOpenId('')
  }

  // A photo belongs to one section at a time so the story stays linear - assigning it here
  // unassigns it from wherever else it was, so the agent can just click/drag without manually
  // clearing its old spot first.
  const togglePhoto = (chapterId: string, url: string) => {
    const target = chapters.find(c => c.id === chapterId)
    const alreadyHere = !!target?.photos.includes(url)
    onChange(chapters.map(c => {
      if (c.id === chapterId) return { ...c, photos: alreadyHere ? c.photos.filter(p => p !== url) : [...c.photos, url] }
      return alreadyHere ? c : { ...c, photos: c.photos.filter(p => p !== url) }
    }))
  }

  const moveDragged = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const next = [...chapters]
    const from = next.findIndex(c => c.id === draggedId)
    const to = next.findIndex(c => c.id === targetId)
    if (from === -1 || to === -1) return
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const generateCopy = async (chapter: PropertyWebsiteChapter) => {
    if (!description.trim()) return
    setGeneratingId(chapter.id)
    const res = await api.ai.copywrite({
      purpose: 'property_site_section',
      context: `Section: ${chapter.label}\n\nFull listing description:\n${description}`,
    })
    setGeneratingId(null)
    if (res.success && res.data?.text) updateChapter(chapter.id, { copy: res.data.text.trim() })
  }

  const photoOwner = (url: string) => chapters.find(c => c.photos.includes(url))

  return (
    <div className="space-y-3">
      <style>{`.ce-pulse{animation:cePulse 1.8s ease-in-out infinite}@keyframes cePulse{0%,100%{box-shadow:0 0 0 0 rgba(201,162,77,.45)}50%{box-shadow:0 0 0 7px rgba(201,162,77,0)}}@media (prefers-reduced-motion:reduce){.ce-pulse{animation:none}}`}</style>
      {chapters.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
          No sections yet - add one below to start building the chapter story. A section with no photos assigned won't appear on the live site.
        </p>
      )}
      {chapters.map((chapter, index) => {
        const isOpen = openId === chapter.id
        return (
          <div
            key={chapter.id}
            draggable
            onDragStart={() => setDraggedId(chapter.id)}
            onDragOver={(e) => { e.preventDefault(); moveDragged(chapter.id) }}
            onDragEnd={() => setDraggedId(null)}
            ref={el => { rowRefs.current[chapter.id] = el }}
            data-unconfirmed={!chapter.confirmed && chapter.enabled && chapter.photos.length > 0 ? '1' : undefined}
            className={`scroll-mt-24 overflow-hidden rounded-xl border-2 transition-colors duration-300 ${chapter.confirmed ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500/50 dark:bg-emerald-500/10' : isOpen ? 'border-[#C9A24D]/70 bg-white dark:bg-[#1A1A1C]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1A1A1C]'} ${draggedId === chapter.id ? 'opacity-50' : ''}`}
          >
            {/* Owner, 10/24: a check to tap on every room (the whole bar goes green), the name in a
                bar that looks editable, and an open/close arrow that's always plain to see. */}
            <div className="p-2.5 sm:p-3">
            <div className="flex items-start gap-2 sm:gap-2.5">
              <button type="button" onClick={() => updateChapter(chapter.id, { confirmed: !chapter.confirmed })}
                aria-pressed={!!chapter.confirmed} aria-label={chapter.confirmed ? 'Confirmed - tap to undo' : 'Tap to confirm this room looks right'} title={chapter.confirmed ? 'Confirmed' : 'Tap when this room looks right'}
                className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-90 ${chapter.confirmed ? 'bg-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,.8)]' : 'ce-pulse border-2 border-dashed border-[#C9A24D] bg-[#C9A24D]/5 text-[#C9A24D]'}`}>
                <Check className="h-5 w-5" strokeWidth={chapter.confirmed ? 3 : 2.25} />
              </button>
              <div className="min-w-0 flex-1">
                <label className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 transition focus-within:border-[#C9A24D] focus-within:ring-2 focus-within:ring-[#C9A24D]/15 dark:bg-black/25 ${chapter.confirmed ? 'border-emerald-300 dark:border-emerald-500/40' : 'border-gray-300 dark:border-gray-700'}`}>
                  <span className="shrink-0 font-serif text-[11px] text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                  <NameField value={chapter.label} onChange={v => updateChapter(chapter.id, { label: v })} />
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                </label>
              </div>
              <button onClick={() => toggleOpen(chapter.id)} aria-expanded={isOpen} aria-label={isOpen ? 'Close this section' : 'Open this section'}
                className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition ${isOpen ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-gray-600 dark:bg-white/5 dark:text-white'}`}>
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
              </button>
            </div>
                <div className="mt-2 flex items-center gap-2 pl-0.5 sm:pl-[50px]">
                  <p className={`min-w-0 flex-1 text-[11px] font-bold leading-snug ${chapter.confirmed ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {chapter.confirmed ? 'Looks good · ' : ''}{chapter.photos.length} photo{chapter.photos.length === 1 ? '' : 's'} &middot; {chapter.enabled ? (chapter.photos.length > 0 ? 'On your page' : 'Empty - add a photo') : 'Hidden'}
                    {!chapter.confirmed && <span className="block text-[#8b7355] dark:text-[#d7b974]">Tap the check when it looks right</span>}
                  </p>
                  <button
                    onClick={() => updateChapter(chapter.id, { enabled: !chapter.enabled })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${chapter.enabled ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                    aria-label={chapter.enabled ? 'Hide this section' : 'Show this section'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full transition ${chapter.enabled ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                  </button>
                  <button onClick={() => removeChapter(chapter.id)} aria-label="Remove this section" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div key="open" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
              <div className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-800">
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400">Photos for this section</p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {photos.map(url => {
                      const assignedHere = chapter.photos.includes(url)
                      const owner = photoOwner(url)
                      const assignedElsewhere = !assignedHere && !!owner
                      return (
                        <button
                          key={url}
                          onClick={() => togglePhoto(chapter.id, url)}
                          title={assignedElsewhere ? `Currently in "${owner!.label}" - click to move it here` : undefined}
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 ${assignedHere ? 'border-[#C9A24D]' : 'border-transparent'}`}
                        >
                          <img src={url} alt="" className={`h-full w-full object-cover ${assignedElsewhere ? 'opacity-40' : ''}`} />
                          {assignedHere && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" /></span>
                          )}
                        </button>
                      )
                    })}
                    {photos.length === 0 && <p className="col-span-full text-xs font-semibold text-gray-400">No photos available for this listing.</p>}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Section copy</p>
                    <button
                      onClick={() => generateCopy(chapter)}
                      disabled={generatingId === chapter.id || !description.trim()}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#d7b974]"
                    >
                      {generatingId === chapter.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Generate with AI
                    </button>
                  </div>
                  <textarea
                    value={chapter.copy}
                    onChange={(e) => updateChapter(chapter.id, { copy: e.target.value })}
                    rows={3}
                    placeholder="A sentence or two about this part of the home..."
                    className="w-full rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 text-[16px] font-medium text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white sm:text-sm"
                  />
                </div>
                <button type="button" onClick={() => { updateChapter(chapter.id, { confirmed: true }); setOpenId('') }}
                  className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-black transition active:scale-[.98] ${chapter.confirmed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                  <Check className="h-4 w-4" strokeWidth={3} /> {chapter.confirmed ? 'Confirmed - close' : 'Looks good'}
                </button>
              </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )
      })}

      {showAddPicker ? (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_TYPES.map(type => {
              const used = usedTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => !used && addChapter(type)}
                  disabled={used}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${used ? 'cursor-not-allowed border-gray-100 text-gray-300 dark:border-gray-800 dark:text-gray-600' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300'}`}
                >
                  {CHAPTER_TYPE_LABELS[type]}
                </button>
              )
            })}
            {customCount < MAX_CUSTOM && (
              <button
                onClick={() => addChapter('custom')}
                className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-600"
              >
                + Custom section
              </button>
            )}
          </div>
          <button onClick={() => setShowAddPicker(false)} className="mt-2 text-[11px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddPicker(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3.5 py-1.5 text-[12px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 sm:min-h-0 sm:px-3 sm:text-[11px]"
        >
          <Plus className="h-3.5 w-3.5" /> Add a section
        </button>
      )}
    </div>
  )
}
