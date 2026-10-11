'use client'

import { useState } from 'react'
import { Check, ChevronDown, GripVertical, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
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
            className={`overflow-hidden rounded-xl border transition ${isOpen ? 'border-[#C9A24D]/60' : 'border-gray-200 dark:border-gray-800'} ${draggedId === chapter.id ? 'opacity-50' : ''} bg-white dark:bg-[#1A1A1C]`}
          >
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-300" />
              <span className="shrink-0 font-serif text-xs text-gray-400">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <input
                  value={chapter.label}
                  onChange={(e) => updateChapter(chapter.id, { label: e.target.value })}
                  className="w-full truncate bg-transparent text-sm font-black text-[#111827] outline-none dark:text-white"
                />
                <p className="text-[10px] font-bold text-gray-400">
                  {chapter.photos.length} photo{chapter.photos.length === 1 ? '' : 's'} &middot; {chapter.enabled ? (chapter.photos.length > 0 ? 'Showing on site' : 'Empty - add a photo to show it') : 'Hidden'}
                </p>
              </div>
              <button
                onClick={() => updateChapter(chapter.id, { enabled: !chapter.enabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${chapter.enabled ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                aria-label={chapter.enabled ? 'Hide this section' : 'Show this section'}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full transition ${chapter.enabled ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
              </button>
              <button onClick={() => removeChapter(chapter.id)} className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setOpenId(isOpen ? '' : chapter.id)} aria-label="Expand section" className="shrink-0 p-1">
                <ChevronDown className={`h-4 w-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isOpen && (
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
                    className="w-full rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 text-sm font-medium text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                  />
                </div>
              </div>
            )}
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add a section
        </button>
      )}
    </div>
  )
}
