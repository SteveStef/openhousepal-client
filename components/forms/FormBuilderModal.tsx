'use client'

import { useRef, useState } from 'react'
import {
  X, Plus, Trash2, GripVertical, Lock, Save, Loader2, Home, PartyPopper,
  Type, AlignLeft, Mail, Phone, Hash, Calendar, Clock, DollarSign, Circle, ListChecks,
  MessageSquare, Users, Moon, Sun, Check, Settings,
} from 'lucide-react'
import FormRunner, { FormRunnerBranding } from '@/components/forms/FormRunner'
import { AgentFormConfig, FormQuestion, FormQuestionType, LinkedProperty } from '@/types'
import PropertyLinkPicker from '@/components/forms/PropertyLinkPicker'

type BlockId = 'welcome' | 'thankyou' | string

interface QuestionTypeMeta {
  type: FormQuestionType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const ADDABLE_TYPES: QuestionTypeMeta[] = [
  { type: 'short_text', label: 'Short answer', icon: Type, description: 'A single line of text' },
  { type: 'long_text', label: 'Long answer', icon: AlignLeft, description: 'A paragraph of text' },
  { type: 'email', label: 'Email', icon: Mail, description: 'Validated email address' },
  { type: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { type: 'number', label: 'Number', icon: Hash, description: 'A numeric value' },
  { type: 'date', label: 'Date', icon: Calendar, description: 'A calendar date' },
  { type: 'time', label: 'Time', icon: Clock, description: 'A time of day' },
  { type: 'currency', label: 'Currency', icon: DollarSign, description: 'A dollar amount' },
  { type: 'select', label: 'Single choice', icon: Circle, description: 'Pick one option' },
  { type: 'multi_select', label: 'Multiple choice', icon: ListChecks, description: 'Pick multiple options' },
  { type: 'statement', label: 'Statement', icon: MessageSquare, description: 'A transition slide, no input' },
]

const TYPE_META_BY_TYPE: Record<string, QuestionTypeMeta> = Object.fromEntries(ADDABLE_TYPES.map(meta => [meta.type, meta]))

function getTypeMeta(type: string): QuestionTypeMeta {
  return TYPE_META_BY_TYPE[type] || { type: type as FormQuestionType, label: type, icon: Users, description: '' }
}

interface FormBuilderModalProps {
  isOpen: boolean
  form: AgentFormConfig | null
  onClose: () => void
  onUpdateField: (field: 'title' | 'headline' | 'subtitle' | 'description' | 'success_heading' | 'success_message' | 'accent_color', value: string) => void
  onToggleBranding: () => void
  onToggleDarkMode: () => void
  onToggleRedirectToAgentHub: () => void
  onTogglePropertyPhotoCarousel: () => void
  onUpdateBrandingLayout: (layout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated') => void
  onUpdateLinkedProperty: (property: LinkedProperty | null) => void
  onUpdateQuestion: (questionId: string, updates: Partial<FormQuestion>) => void
  onAddQuestion: (type: FormQuestionType) => string
  onRemoveQuestion: (questionId: string) => void
  onReorderQuestions: (draggedQuestionId: string, targetQuestionId: string) => void
  onSave: () => Promise<void>
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  showPropertyLink: boolean
  branding: { agentName: string; agentBrokerage: string; agentPhotoUrl?: string; agentTitle?: string; agentMarket?: string }
  defaultDescription?: string
}

export default function FormBuilderModal({
  isOpen, form, onClose, onUpdateField, onToggleBranding, onToggleDarkMode, onToggleRedirectToAgentHub, onTogglePropertyPhotoCarousel, onUpdateBrandingLayout, onUpdateLinkedProperty,
  onUpdateQuestion, onAddQuestion, onRemoveQuestion, onReorderQuestions, onSave, saveStatus, showPropertyLink, branding, defaultDescription,
}: FormBuilderModalProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<BlockId>('welcome')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const addQuestionButtonRef = useRef<HTMLButtonElement>(null)

  if (!isOpen || !form) return null

  const selectedQuestion = form.questions.find(question => question.id === selectedBlockId) || null

  const handleAddType = (type: FormQuestionType) => {
    const newId = onAddQuestion(type)
    setSelectedBlockId(newId)
    setTypePickerPos(null)
  }

  const previewBranding: FormRunnerBranding = {
    title: form.headline || form.title,
    subtitle: form.subtitle,
    accentColor: form.accent_color,
    showBranding: form.show_branding,
    agentName: branding.agentName,
    agentBrokerage: branding.agentBrokerage,
    agentPhotoUrl: branding.agentPhotoUrl,
    agentTitle: branding.agentTitle,
    agentMarket: branding.agentMarket,
  }

  const previewKey = `${form.id}-${form.questions.map(question => question.id).join(',')}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#0B0B0B]">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-[#0B0B0B]">
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-[#111827] dark:text-white">{form.title}</p>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{form.questions.length} questions · drag to reorder</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setSelectedBlockId('settings')}
              className={`rounded-xl p-2.5 transition ${
                selectedBlockId === 'settings'
                  ? 'bg-[#C9A24D]/15 text-[#8b7355]'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
              aria-label="Form settings"
              title="Form settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black shadow-sm transition disabled:opacity-60 ${
                saveStatus === 'saved'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : saveStatus === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200'
              }`}
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Try Again' : 'Save'}
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close builder">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left rail: block list */}
          <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-[#fbfaf7] p-3 dark:border-gray-800 dark:bg-[#111113]">
            <button
              onClick={() => setSelectedBlockId('welcome')}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                selectedBlockId === 'welcome'
                  ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-sm ring-1 ring-[#C9A24D]/20 dark:bg-[#1A1A1C] dark:ring-white/10'
                  : 'border-transparent hover:border-[#C9A24D]/30 hover:bg-[#C9A24D]/5 dark:hover:bg-[#1A1A1C]/60'
              }`}
            >
              <Home className="h-4 w-4 shrink-0 text-[#8b7355]" />
              <span className="truncate text-sm font-black text-[#111827] dark:text-white">Welcome Screen</span>
            </button>

            <div className="my-3 border-t border-gray-200 dark:border-gray-800" />

            <div className="space-y-1.5">
              {form.questions.map((question, index) => {
                const meta = getTypeMeta(question.type)
                const Icon = meta.icon
                const isSelected = selectedBlockId === question.id
                return (
                  <div
                    key={question.id}
                    draggable
                    onDragStart={() => setDraggedId(question.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      if (draggedId && draggedId !== question.id) onReorderQuestions(draggedId, question.id)
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => setSelectedBlockId(question.id)}
                    className={`group flex cursor-grab items-center gap-2 rounded-xl border p-2.5 text-left transition active:cursor-grabbing ${
                      isSelected
                        ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-sm ring-1 ring-[#C9A24D]/20 dark:bg-[#1A1A1C] dark:ring-white/10'
                        : 'border-transparent hover:border-[#C9A24D]/30 hover:bg-[#C9A24D]/5 dark:hover:bg-[#1A1A1C]/60'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#C9A24D]/15 text-[#8b7355]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-[#111827] dark:text-white">{index + 1}. {question.label}</span>
                    </span>
                    {question.locked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                    ) : (
                      <button
                        onClick={(event) => { event.stopPropagation(); onRemoveQuestion(question.id); if (selectedBlockId === question.id) setSelectedBlockId('welcome') }}
                        className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-900/20"
                        aria-label="Delete question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="relative mt-2">
              <button
                ref={addQuestionButtonRef}
                onClick={() => {
                  if (typePickerPos) {
                    setTypePickerPos(null)
                    return
                  }
                  const rect = addQuestionButtonRef.current?.getBoundingClientRect()
                  if (!rect) return
                  const popoverHeight = Math.min(window.innerHeight * 0.7, 420)
                  const openUpward = rect.top - popoverHeight > 8
                  setTypePickerPos({
                    left: rect.left,
                    width: rect.width,
                    top: openUpward ? rect.top - popoverHeight - 8 : rect.bottom + 8,
                  })
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-2.5 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
              >
                <Plus className="h-4 w-4" /> Add question
              </button>
              {typePickerPos && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setTypePickerPos(null)} aria-label="Close type picker" />
                  <div
                    style={{ top: typePickerPos.top, left: typePickerPos.left, width: Math.max(typePickerPos.width, 240) }}
                    className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-[#1A1A1C]"
                  >
                    <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Choose a question type</p>
                    <div className="space-y-0.5">
                      {ADDABLE_TYPES.map(meta => {
                        const Icon = meta.icon
                        return (
                          <button
                            key={meta.type}
                            onClick={() => handleAddType(meta.type)}
                            className="flex w-full items-center gap-2 rounded-xl border border-transparent p-2 text-left transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/5"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#C9A24D]/15 text-[#8b7355]">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-black text-[#111827] dark:text-white">{meta.label}</span>
                              <span className="block truncate text-[10px] text-gray-400">{meta.description}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="my-3 border-t border-gray-200 dark:border-gray-800" />

            <button
              onClick={() => setSelectedBlockId('thankyou')}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                selectedBlockId === 'thankyou'
                  ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-sm ring-1 ring-[#C9A24D]/20 dark:bg-[#1A1A1C] dark:ring-white/10'
                  : 'border-transparent hover:border-[#C9A24D]/30 hover:bg-[#C9A24D]/5 dark:hover:bg-[#1A1A1C]/60'
              }`}
            >
              <PartyPopper className="h-4 w-4 shrink-0 text-[#8b7355]" />
              <span className="truncate text-sm font-black text-[#111827] dark:text-white">Thank You Screen</span>
            </button>

            <div className="my-3 border-t border-gray-200 dark:border-gray-800" />

            <button
              onClick={() => setSelectedBlockId('settings')}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                selectedBlockId === 'settings'
                  ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-sm ring-1 ring-[#C9A24D]/20 dark:bg-[#1A1A1C] dark:ring-white/10'
                  : 'border-transparent hover:border-[#C9A24D]/30 hover:bg-[#C9A24D]/5 dark:hover:bg-[#1A1A1C]/60'
              }`}
            >
              <Settings className="h-4 w-4 shrink-0 text-[#8b7355]" />
              <span className="truncate text-sm font-black text-[#111827] dark:text-white">Settings</span>
            </button>
          </div>

          {/* Middle: editor panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedBlockId === 'welcome' && (
              <div className="mx-auto max-w-lg space-y-5">
                <h3 className="text-lg font-black text-[#111827] dark:text-white">Welcome Screen</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">Title</span>
                    <input value={form.title} onChange={(event) => onUpdateField('title', event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">Accent color</span>
                    <input type="color" value={form.accent_color || '#816937'} onChange={(event) => onUpdateField('accent_color', event.target.value)} className="mt-2 h-[46px] w-full rounded-xl border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-[#151517]" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Intro headline</span>
                  <p className="mt-0.5 text-[11px] text-gray-400">What the visitor sees on the welcome screen.</p>
                  <input value={form.headline || ''} onChange={(event) => onUpdateField('headline', event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Subtitle</span>
                  <textarea rows={3} value={form.subtitle || ''} onChange={(event) => onUpdateField('subtitle', event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                </label>
              </div>
            )}

            {selectedBlockId === 'settings' && (
              <div className="mx-auto max-w-lg space-y-5">
                <h3 className="text-lg font-black text-[#111827] dark:text-white">Settings</h3>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Description</span>
                  <p className="mt-0.5 text-[11px] text-gray-400">Shown under this form's title in your Forms list. Keep it short - it's clipped after two lines.</p>
                  <textarea
                    rows={2}
                    value={form.description ?? defaultDescription ?? ''}
                    onChange={(event) => onUpdateField('description', event.target.value)}
                    placeholder="What this form is for..."
                    className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
                  />
                </label>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#151517]">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">Show your photo &amp; name</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Turn off to keep this form unbranded/anonymous.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleBranding}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.show_branding ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                    aria-label={`${form.show_branding ? 'Turn off' : 'Turn on'} branding`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full transition ${form.show_branding ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#151517]">
                  <div className="flex items-center gap-3">
                    {form.dark_mode ? <Moon className="h-5 w-5 shrink-0 text-[#8b7355]" /> : <Sun className="h-5 w-5 shrink-0 text-[#8b7355]" />}
                    <div>
                      <p className="text-sm font-black text-[#111827] dark:text-white">Dark mode for visitors</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Forces this form to show dark, regardless of the visitor's device settings.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.dark_mode ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                    aria-label={`${form.dark_mode ? 'Turn off' : 'Turn on'} dark mode`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full transition ${form.dark_mode ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                  </button>
                </div>

                {showPropertyLink && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Linked property (optional)</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Attach a listing to brand this form around a specific property.</p>
                    <div className="mt-3">
                      <PropertyLinkPicker value={form.linked_property || null} onChange={onUpdateLinkedProperty} />
                    </div>
                  </div>
                )}

                {showPropertyLink && form.linked_property && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#151517]">
                    <div>
                      <p className="text-sm font-black text-[#111827] dark:text-white">Cycle listing photos</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">On the welcome screen, flip through up to 10 of this listing's photos, 3 seconds each, on a loop.</p>
                    </div>
                    <button
                      type="button"
                      onClick={onTogglePropertyPhotoCarousel}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.property_photo_carousel ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                      aria-label={`${form.property_photo_carousel ? 'Turn off' : 'Turn on'} listing photo carousel`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full transition ${form.property_photo_carousel ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                    </button>
                  </div>
                )}

                {showPropertyLink && form.linked_property && (
                  <div className="rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#151517]">
                    <p className="text-sm font-black text-[#111827] dark:text-white">Agent &amp; property placement</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Where your photo/name and the linked property show on each question page.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {([
                        { value: 'split', label: 'Property top, agent bottom', description: 'Header & footer (default)' },
                        { value: 'split_reverse', label: 'Agent top, property bottom', description: 'Header & footer' },
                        { value: 'integrated', label: 'Integrated card', description: 'One cohesive card, like Open House sign-in' },
                      ] as const).map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onUpdateBrandingLayout(option.value)}
                          className={`rounded-xl border-2 p-3 text-left transition-all ${
                            form.branding_layout === option.value
                              ? 'text-[#111827] dark:text-white'
                              : 'border-gray-200 bg-white text-[#111827] hover:border-gray-300 dark:border-gray-700 dark:bg-[#0F0F11] dark:text-white'
                          }`}
                          style={form.branding_layout === option.value ? { borderColor: form.accent_color || '#816937', backgroundColor: `${form.accent_color || '#816937'}1A` } : undefined}
                        >
                          <p className="text-xs font-black">{option.label}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedBlockId === 'thankyou' && (
              <div className="mx-auto max-w-lg space-y-5">
                <h3 className="text-lg font-black text-[#111827] dark:text-white">Thank You Screen</h3>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Success heading</span>
                  <input value={form.success_heading} onChange={(event) => onUpdateField('success_heading', event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Success message</span>
                  <textarea rows={4} value={form.success_message || ''} onChange={(event) => onUpdateField('success_message', event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                </label>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#151517]">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">Redirect to Agent Hub</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">After submitting, show a 3-second loading bar then send the visitor to your Agent Hub.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleRedirectToAgentHub}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.redirect_to_agent_hub ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                    aria-label={`${form.redirect_to_agent_hub ? 'Turn off' : 'Turn on'} Agent Hub redirect`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full transition ${form.redirect_to_agent_hub ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                  </button>
                </div>
              </div>
            )}

            {selectedQuestion && (
              <QuestionEditor
                question={selectedQuestion}
                onUpdate={(updates) => onUpdateQuestion(selectedQuestion.id, updates)}
              />
            )}
          </div>

          {/* Right rail: live preview */}
          {/* Wide enough that the linked-property card renders at (close to) its real live-page size
              (up to max-w-md/448px) instead of being squeezed narrower than its own fixed-height photo
              expects, which was throwing off its proportions here versus the live site. */}
          <div className="hidden w-[360px] shrink-0 flex-col border-l border-gray-100 bg-[#f2efe8] p-4 dark:border-gray-800 dark:bg-[#0F0F11] lg:flex xl:w-[560px]">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Live preview</p>
            <div className={`flex-1 overflow-hidden rounded-2xl shadow-inner ${form.dark_mode ? 'dark' : ''}`}>
              <div className="h-full overflow-y-auto bg-[#FAFAF7] dark:bg-[#0B0B0B]">
                <FormRunner
                  key={previewKey}
                  questions={form.questions}
                  linkedProperty={form.linked_property}
                  propertyPhotoCarousel={form.property_photo_carousel}
                  brandingLayout={form.branding_layout}
                  branding={previewBranding}
                  successHeading={form.success_heading}
                  successMessage={form.success_message}
                  onSubmit={async () => ({ success: true })}
                  focusBlockId={selectedBlockId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionEditor({ question, onUpdate }: { question: FormQuestion; onUpdate: (updates: Partial<FormQuestion>) => void }) {
  if (question.type === 'contact_group') {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <h3 className="text-lg font-black text-[#111827] dark:text-white">{question.label}</h3>
        <div className="rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400">
          This is a core contact block. It shows several fields together on one screen: {(question.fields || []).map(field => field.label).join(', ')}.
        </div>
      </div>
    )
  }

  const isChoiceType = question.type === 'select' || question.type === 'multi_select'
  const showPlaceholder = ['short_text', 'long_text', 'email', 'phone', 'number', 'currency'].includes(question.type)
  const showUnit = question.type === 'number' || question.type === 'currency'
  const showRequired = question.type !== 'statement'

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{question.type === 'statement' ? 'Headline' : 'Question label'}</span>
        <input
          value={question.label}
          disabled={question.locked}
          onChange={(event) => onUpdate({ label: event.target.value })}
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-[#C9A24D] disabled:text-gray-400 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {!question.locked && (
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Type</span>
            <select
              value={question.type}
              onChange={(event) => {
                const nextType = event.target.value as FormQuestionType
                const isNextChoice = nextType === 'select' || nextType === 'multi_select'
                onUpdate({ type: nextType, options: isNextChoice ? (question.options && question.options.length > 0 ? question.options : ['Choice 1', 'Choice 2']) : undefined })
              }}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
            >
              {ADDABLE_TYPES.map(meta => <option key={meta.type} value={meta.type}>{meta.label}</option>)}
            </select>
          </label>
        )}
        {showRequired && (
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={question.required} disabled={question.locked} onChange={(event) => onUpdate({ required: event.target.checked })} />
            Required
          </label>
        )}
      </div>

      {showPlaceholder && (
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Placeholder</span>
          <input value={question.placeholder || ''} onChange={(event) => onUpdate({ placeholder: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
        </label>
      )}

      {showUnit && (
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Unit suffix (optional)</span>
          <input value={question.unit || ''} placeholder="e.g. square feet" onChange={(event) => onUpdate({ unit: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
        </label>
      )}

      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Helper text (optional)</span>
        <input value={question.helper_text || ''} onChange={(event) => onUpdate({ helper_text: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
      </label>

      {isChoiceType && (
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Choices</span>
          <div className="mt-2 space-y-2">
            {(question.options || []).map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(event) => {
                    const next = [...(question.options || [])]
                    next[optionIndex] = event.target.value
                    onUpdate({ options: next })
                  }}
                  placeholder={`Choice ${optionIndex + 1}`}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
                />
                <button
                  onClick={() => onUpdate({ options: (question.options || []).filter((_, i) => i !== optionIndex) })}
                  className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onUpdate({ options: [...(question.options || []), ''] })}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
            >
              <Plus className="h-3.5 w-3.5" /> Add choice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
