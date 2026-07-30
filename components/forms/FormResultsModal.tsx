'use client'

import { useEffect, useState } from 'react'
import { X, FileText, Mail, Phone, User, MapPin, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { AgentFormConfig, FormSubmissionAnswer, FormSubmissionListItem } from '@/types'

interface FormResultsModalProps {
  isOpen: boolean
  onClose: () => void
  form: AgentFormConfig | null
  submissions: FormSubmissionListItem[]
  isLoading: boolean
  onToggleReviewed: (submissionId: string, isReviewed: boolean) => Promise<void>
  onDeleteSubmission: (submission: FormSubmissionListItem) => void
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function extractGroupName(entries: FormSubmissionAnswer[]) {
  const first = entries.find(entry => /first name/i.test(entry.label))
  const last = entries.find(entry => /last name/i.test(entry.label))
  if (first || last) return [first?.value, last?.value].filter(Boolean).join(' ')
  const single = entries.find(entry => /^(legal )?name$|full name/i.test(entry.label))
  return single ? String(single.value) : ''
}

// No card wrapper of its own — every contact group renders with identical styling, stacked inside one shared card.
function ContactInfoSection({ title, entries }: { title: string; entries: FormSubmissionAnswer[] }) {
  const name = extractGroupName(entries)
  const email = entries.find(entry => entry.type === 'email' && entry.value)
  const phone = entries.find(entry => entry.type === 'phone' && entry.value)
  const usedIds = new Set([email?.questionId, phone?.questionId, ...entries.filter(entry => /first name|last name|^(legal )?name$|full name/i.test(entry.label)).map(entry => entry.questionId)])
  const otherEntries = entries.filter(entry => !usedIds.has(entry.questionId) && entry.value !== undefined && entry.value !== null && String(entry.value).trim() !== '')

  return (
    <div>
      <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
        {title}
      </h4>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {name && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><User size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <span className="truncate font-medium text-[#111827] dark:text-white">{name}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><Mail size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <a href={`mailto:${email.value}`} className="truncate font-medium text-[#6B7280] transition-colors hover:text-[#C9A24D] dark:text-gray-400">{String(email.value)}</a>
          </div>
        )}
        {phone && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><Phone size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <a href={`tel:${phone.value}`} className="font-medium text-[#6B7280] transition-colors hover:text-[#C9A24D] dark:text-gray-400">{String(phone.value)}</a>
          </div>
        )}
        {otherEntries.map(entry => (
          <div key={entry.questionId} className="flex items-center text-[#6B7280] dark:text-gray-400">
            <span className="truncate text-xs font-medium"><span className="text-gray-400 dark:text-gray-500">{entry.label}:</span> <span className="text-[#111827] dark:text-white">{String(entry.value)}</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr)
  const diffMins = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function FormResultsModal({ isOpen, onClose, form, submissions, isLoading, onToggleReviewed, onDeleteSubmission }: FormResultsModalProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) setSelectedIndex(null)
  }, [isOpen, form?.id])

  if (!isOpen || !form) return null

  const handleToggle = async (submissionId: string, current: boolean) => {
    setUpdatingId(submissionId)
    try {
      await onToggleReviewed(submissionId, !current)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const pendingCount = submissions.filter(submission => !submission.is_reviewed).length
  const selected = selectedIndex !== null ? submissions[selectedIndex] : null

  const groupedSections: { title: string; entries: FormSubmissionAnswer[] }[] = []
  if (selected) {
    const order: string[] = []
    const map = new Map<string, FormSubmissionAnswer[]>()
    for (const answer of selected.answers) {
      const key = answer.sectionTitle || '__none__'
      if (!map.has(key)) { map.set(key, []); order.push(key) }
      map.get(key)!.push(answer)
    }
    for (const key of order) groupedSections.push({ title: key === '__none__' ? '' : key, entries: map.get(key)! })
  }
  const contactGroups = groupedSections.filter(group => group.entries.some(entry => entry.type === 'email' || entry.type === 'phone'))
  if (contactGroups.length === 0 && selected && (selected.contact_name || selected.contact_email || selected.contact_phone)) {
    contactGroups.push({
      title: '',
      entries: [
        ...(selected.contact_name ? [{ questionId: '__contact_name', label: 'Name', type: 'short_text' as const, value: selected.contact_name }] : []),
        ...(selected.contact_email ? [{ questionId: '__contact_email', label: 'Email', type: 'email' as const, value: selected.contact_email }] : []),
        ...(selected.contact_phone ? [{ questionId: '__contact_phone', label: 'Phone', type: 'phone' as const, value: selected.contact_phone }] : []),
      ],
    })
  }
  const contactEntryIds = new Set(contactGroups.flatMap(group => group.entries.map(entry => entry.questionId)))
  const otherAnswers = selected ? selected.answers.filter(answer => !contactEntryIds.has(answer.questionId)) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleBackdropClick}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-colors dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
            {selected ? (
              <button
                onClick={() => setSelectedIndex(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
                aria-label="Back to all submissions"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="rounded-xl bg-[#111827] p-2.5 shadow-md dark:bg-white sm:rounded-2xl sm:p-3">
                <FileText className="text-white dark:text-[#111827]" size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black tracking-tight text-[#111827] dark:text-white sm:text-2xl">
                {selected ? (selected.contact_name || 'Anonymous submission') : form.title}
              </h2>
              <p className="mt-0.5 truncate text-xs font-medium text-[#6B7280] dark:text-gray-400 sm:text-sm">
                {selected ? new Date(selected.created_at).toLocaleString() : `${pendingCount} new · ${submissions.length} total`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selected && (
              <div className="hidden items-center gap-1 sm:flex">
                <button
                  onClick={() => setSelectedIndex(i => (i !== null && i > 0 ? i - 1 : i))}
                  disabled={selectedIndex === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-30 dark:border-gray-700 dark:text-gray-400"
                  aria-label="Previous submission"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedIndex(i => (i !== null && i < submissions.length - 1 ? i + 1 : i))}
                  disabled={selectedIndex === submissions.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-30 dark:border-gray-700 dark:text-gray-400"
                  aria-label="Next submission"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#111827] dark:border-white"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#111827] dark:text-white">No submissions yet</h3>
              <p className="text-[#6B7280] dark:text-gray-400">Submissions from this form will appear here.</p>
            </div>
          ) : selected ? (
            <div className="p-4 sm:p-6">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
                {selected.property_address && (
                  <div className={contactGroups.length > 0 ? 'border-b border-gray-100 pb-6 dark:border-gray-800' : ''}>
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
                      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
                      Property
                    </h4>
                    <div className="mt-3 flex items-center text-[#6B7280] dark:text-gray-400">
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                        <MapPin size={14} className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <span className="truncate font-medium text-[#111827] dark:text-white">{selected.property_address}</span>
                    </div>
                  </div>
                )}

                {contactGroups.map((group, index) => (
                  <div key={group.title || index} className={index > 0 || selected.property_address ? 'mt-6 border-t border-gray-100 pt-6 dark:border-gray-800' : ''}>
                    <ContactInfoSection title={`Contact ${index + 1}`} entries={group.entries} />
                  </div>
                ))}

                <div className="mt-6 space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
                  <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
                    Full Responses
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {otherAnswers.filter(answer => answer.value !== undefined && answer.value !== null && String(answer.value).trim() !== '').map(answer => (
                      <div key={answer.questionId} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{answer.label}</p>
                        <p className="mt-1 break-words text-sm font-medium text-[#111827] dark:text-gray-100">{String(answer.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
                  <button
                    onClick={() => handleToggle(selected.id, selected.is_reviewed)}
                    disabled={updatingId === selected.id}
                    className={`flex flex-1 items-center justify-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all sm:flex-none ${
                      selected.is_reviewed
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        : 'bg-[#111827] text-white shadow-md hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] dark:hover:text-white'
                    }`}
                  >
                    {updatingId === selected.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    ) : selected.is_reviewed ? (
                      <span>Mark Unreviewed</span>
                    ) : (
                      <span>Mark Reviewed</span>
                    )}
                  </button>
                  <button
                    onClick={() => { onDeleteSubmission(selected); setSelectedIndex(null) }}
                    className="flex items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600 transition-all hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                    aria-label="Delete submission"
                    title="Delete submission"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {submissions.map((submission, index) => (
                <button
                  key={submission.id}
                  onClick={() => setSelectedIndex(index)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white dark:hover:bg-[#151517] sm:p-5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      submission.is_reviewed
                        ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                    }`}
                  >
                    {getInitials(submission.contact_name || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-black text-[#111827] dark:text-white">{submission.contact_name || 'Anonymous'}</p>
                      {!submission.is_reviewed && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">New</span>
                      )}
                    </div>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {submission.contact_email || submission.contact_phone || submission.property_address || 'No contact details'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">{formatRelative(submission.created_at)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected && (
          <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#111827] px-6 py-3.5 font-bold text-white shadow-lg shadow-[#111827]/10 transition-all duration-300 hover:scale-[1.01] hover:bg-[#C9A24D] hover:shadow-xl dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:py-4"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
