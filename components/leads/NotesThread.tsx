'use client'

import { useState } from 'react'
import { Home, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { LeadNote } from '@/types'
import { formatRelativeDay } from '@/lib/relativeDays'

interface NotesThreadProps {
  notes: LeadNote[]
  loading?: boolean
  currentUserId?: string
  emptyLabel?: string
  onAdd: (text: string) => Promise<void>
  onEdit: (noteId: string, text: string) => Promise<void>
  onDelete: (noteId: string) => Promise<void>
}

export default function NotesThread({ notes, loading, currentUserId, emptyLabel, onAdd, onEdit, onDelete }: NotesThreadProps) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!draft.trim()) return
    setAdding(true)
    await onAdd(draft.trim())
    setDraft('')
    setAdding(false)
  }

  const startEdit = (note: LeadNote) => {
    setEditingId(note.id)
    setEditDraft(note.text)
  }

  const saveEdit = async (noteId: string) => {
    if (!editDraft.trim()) return
    setSavingId(noteId)
    await onEdit(noteId, editDraft.trim())
    setSavingId(null)
    setEditingId(null)
  }

  const handleDelete = async (noteId: string) => {
    setSavingId(noteId)
    await onDelete(noteId)
    setSavingId(null)
  }

  return (
    <div>
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs font-bold text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notes...
          </div>
        )}
        {!loading && notes.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
            {emptyLabel || 'No notes yet'}
          </p>
        )}
        {!loading && notes.map(note => {
          const isEditing = editingId === note.id
          const isSaving = savingId === note.id
          const isMine = currentUserId && note.author_id === currentUserId
          return (
            <div key={note.id} className="rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-800 dark:bg-[#0B0B0B]">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-black text-[#111827] dark:text-white">{isMine ? 'You' : note.author_name || 'Unknown'}</span>
                  <span className="text-[10px] font-bold text-gray-400">{formatRelativeDay(note.updated_at || note.created_at)}</span>
                  {note.open_house_address && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">
                      <Home className="h-2.5 w-2.5" /> {note.open_house_address}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => startEdit(note)} disabled={isSaving} className="rounded-lg p-1 text-gray-400 hover:text-[#8b7355] disabled:opacity-50">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDelete(note.id)} disabled={isSaving} className="rounded-lg p-1 text-gray-400 hover:text-red-500 disabled:opacity-50">
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="mt-2">
                  <textarea
                    value={editDraft}
                    onChange={event => setEditDraft(event.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
                  />
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-black uppercase text-gray-500 dark:border-gray-700">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                    <button onClick={() => saveEdit(note.id)} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1 text-[10px] font-black uppercase text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold text-[#111827] dark:text-white">{note.text}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex gap-1.5">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="min-w-0 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !draft.trim()}
          className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 px-3 text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-50 dark:border-gray-700"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
