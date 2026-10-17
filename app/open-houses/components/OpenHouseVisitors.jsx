'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Mail, Phone, Users, UserCheck, UserPlus } from 'lucide-react'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import { formatPhone } from '@/lib/leadEventDetails'
import { toTitleCase } from '@/lib/cheatSheetContent'
import Footer from '@/components/Footer'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import NotesThread from '@/components/leads/NotesThread'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import { createPortal } from 'react-dom'
import { copyText } from '@/lib/copyText'

// The Visitor Insights view. As its own page (/open-houses/visitors/[id]) it reads the id from the
// URL; inside the Opens screen's pop-up it's handed `openHouseEventId` + `onClose`, so agents
// never lose their place on Opens.
export default function OpenHouseVisitors({ openHouseEventId: idProp, onClose }) {
  const router = useRouter()
  const params = useParams()
  const openHouseEventId = idProp || params?.openHouseEventId
  const embedded = !!onClose
  const { user } = useAuth()

  const [visitors, setVisitors] = useState([])
  const [openHouse, setOpenHouse] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState('')
  // Deep link (?visitor=<id> - "View Sign-in" on a lead's Activity): that person's row, scrolled
  // into view and highlighted.
  const [focusVisitorId, setFocusVisitorId] = useState(null)
  useEffect(() => {
    if (embedded) return
    try { setFocusVisitorId(new URLSearchParams(window.location.search).get('visitor')) } catch { /* no window */ }
  }, [])
  useEffect(() => {
    if (!focusVisitorId || isLoading) return
    const t = setTimeout(() => {
      const els = document.querySelectorAll(`[data-visitor-id="${focusVisitorId}"]`)
      const shown = Array.from(els).find(el => el.offsetParent !== null)
      shown?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => clearTimeout(t)
  }, [focusVisitorId, isLoading])
  const focusRing = (id) => id === focusVisitorId ? 'ring-2 ring-inset ring-[#C9A24D] bg-[#C9A24D]/[0.07]' : ''

  const handleCopy = (field, value) => {
    if (!value) return
    copyText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(current => current === field ? '' : current), 1200)
  }

  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [selectedVisitorForNote, setSelectedVisitorForNote] = useState(null)
  const [currentNote, setCurrentNote] = useState('')
  const [visitorNotes, setVisitorNotes] = useState([])
  const [visitorNotesLoading, setVisitorNotesLoading] = useState(false)

  useEffect(() => {
    loadVisitors()
  }, [openHouseEventId])

  const loadVisitors = async () => {
    setIsLoading(true)
    setError('')
    const [visitorsResult, openHouseResult] = await Promise.all([
      api.openHouses.getVisitors(openHouseEventId),
      api.openHouses.getById(openHouseEventId),
    ])

    if (visitorsResult.success && visitorsResult.data) {
      // Newest sign-in first (user, 10/17) - the person who just walked in is on top.
      setVisitors([...visitorsResult.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } else {
      setError(visitorsResult.error || 'Failed to load visitors')
    }
    if (openHouseResult.success && openHouseResult.data) {
      setOpenHouse(openHouseResult.data)
    }
    setIsLoading(false)
  }

  // Same calendar day as the visitor before them (list is newest-first) - drives the "connected"
  // vs "gapped" spacing so visitors from one day read as a cluster, distinct from other days.
  const isSameDayAsPrevious = (visitor, index) => {
    if (index === 0) return false
    const prev = new Date(visitors[index - 1].created_at)
    const current = new Date(visitor.created_at)
    return prev.toDateString() === current.toDateString()
  }

  const formatGroupDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return 'Today'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const CopyField = ({ field, value, icon: FieldIcon, href, display }) => (
    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 min-w-0">
      <FieldIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
      {href ? (
        <a href={href} className="truncate hover:text-[#8b7355] dark:hover:text-[#C9A24D] transition-colors">{display || value}</a>
      ) : (
        <span className="truncate">{display || value}</span>
      )}
      <button
        type="button"
        onClick={() => handleCopy(field, value)}
        className="shrink-0 rounded-md p-1 text-gray-300 transition hover:bg-gray-100 hover:text-[#8b7355] dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-[#C9A24D]"
        aria-label={`Copy ${field}`}
        title={`Copy ${field}`}
      >
        {copiedField === field ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  )

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getAgentStatusLabel = (status) => {
    const labels = {
      'YES': 'Has Agent',
      'NO': 'No Agent',
      'LOOKING': 'Looking for Agent'
    }
    return labels[status] || status
  }

  const getAgentStatusColor = (status) => {
    const colors = {
      'YES': 'bg-blue-100 text-blue-800 border-blue-200',
      'NO': 'bg-green-100 text-green-800 border-green-200',
      'LOOKING': 'bg-purple-100 text-purple-800 border-purple-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const handleOpenNoteModal = async (visitor) => {
    setSelectedVisitorForNote(visitor)
    setIsNoteModalOpen(true)

    if (visitor.lead_id) {
      // Shared notes path: same lead_notes rows shown on this visitor's Leads profile.
      setVisitorNotesLoading(true)
      const { success, data } = await api.openHouses.getVisitorNotes(visitor.id)
      if (success && data) setVisitorNotes(data)
      setVisitorNotesLoading(false)
    } else {
      // Legacy fallback for the rare visitor with no matching lead record yet.
      setCurrentNote(visitor.notes || '')
    }
  }

  const handleSaveNoteFromModal = async () => {
    if (!selectedVisitorForNote) return

    const { success, error } = await api.openHouses.updateVisitorNote(selectedVisitorForNote.id, currentNote)

    if (success) {
      // Update local state on success
      setVisitors(prev => prev.map(v =>
        v.id === selectedVisitorForNote.id ? { ...v, notes: currentNote } : v
      ))
      setIsNoteModalOpen(false)
      setSelectedVisitorForNote(null)
      setCurrentNote('')
    } else {
      alert('Failed to save note: ' + (error || 'Unknown error'))
    }
  }

  const handleAddVisitorNote = async (text) => {
    if (!selectedVisitorForNote) return
    const { success, data } = await api.openHouses.addVisitorNote(selectedVisitorForNote.id, { text })
    if (success && data) setVisitorNotes(current => [data, ...current])
  }

  const handleEditVisitorNote = async (noteId, text) => {
    const { success, data } = await api.openHouses.updateVisitorNoteThread(noteId, text)
    if (success && data) setVisitorNotes(current => current.map(n => n.id === noteId ? data : n))
  }

  const handleDeleteVisitorNote = async (noteId) => {
    const { success } = await api.openHouses.deleteVisitorNoteThread(noteId)
    if (success) setVisitorNotes(current => current.filter(n => n.id !== noteId))
  }

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false)
    setSelectedVisitorForNote(null)
    setCurrentNote('')
    setVisitorNotes([])
  }

  return (
    <div className={embedded ? 'flex flex-col' : 'min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300'}>
      

      <div className={embedded ? 'flex-1 p-4 sm:p-6' : 'flex-1 p-6 sm:p-8 pb-20 sm:pb-32'}>
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className={embedded ? 'mb-6' : 'mb-8'}>
            {embedded ? (
              <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 p-5 pr-14 sm:p-8 sm:pr-16 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
                  <div className="flex items-center min-w-0">
                    {openHouse?.coverImageUrl ? (
                      <img
                        src={openHouse.coverImageUrl}
                        alt={openHouse.address}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover mr-4 sm:mr-6 shadow-lg flex-shrink-0 border border-gray-100 dark:border-gray-800"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#151517] dark:bg-[#C9A24D] rounded-2xl flex items-center justify-center mr-4 sm:mr-6 shadow-lg flex-shrink-0">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Visitor Insights</h1>
                      {openHouse?.address ? (
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 font-light truncate">
                          {toTitleCase(String(openHouse?.address || '').split(',')[0])}{openHouse.price ? ` · $${Number(openHouse.price).toLocaleString()}` : ''}
                        </p>
                      ) : (
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 font-light">Track and manage sign-ins from your open house event</p>
                      )}
                    </div>
                  </div>
                  {!isLoading && !error && (
                    <div className="bg-gray-900 dark:bg-[#0B0B0B] text-white border border-gray-800 dark:border-gray-700 rounded-full px-5 py-2 self-start sm:self-auto shadow-lg shadow-gray-900/10">
                      <span className="font-bold text-sm">
                        {visitors.length} <span className="font-normal text-gray-300 dark:text-gray-400 ml-1">Total Visitors</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <LuxeHero
                compact
                kicker="Visitors"
                icon={Users}
                backHref="/open-houses"
                backLabel="Open Houses"
                title={<>Visitor <em>insights.</em></>}
                subtitle={openHouse?.address ? <>{toTitleCase(String(openHouse?.address || '').split(',')[0])}{openHouse.price ? ` · $${Number(openHouse.price).toLocaleString()}` : ''}</> : 'Everyone who signed in at this open house.'}
                aside={!isLoading && !error && (
                  <LuxeStats
                    stats={[
                      { label: 'Visitors', value: visitors.length, icon: Users },
                      { label: 'No agent', value: visitors.filter(v => String(v.has_agent || '').toUpperCase() === 'NO').length, icon: UserPlus },
                      { label: 'Has agent', value: visitors.filter(v => String(v.has_agent || '').toUpperCase() === 'YES').length, icon: UserCheck },
                    ]}
                  />
                )}
              />
            )}
          </div>

          {/* Content Section */}
          <div className="bg-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="text-center">
                  <OhpSpinner size={30} label="Loading visitors" />
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Error Loading Visitors</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">{error}</p>
                <button
                  onClick={loadVisitors}
                  className="px-8 py-3 bg-gradient-to-br from-[#151517] via-[#3a2f25] to-[#8b7355] dark:from-[#C9A24D] dark:to-[#8b7355] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : visitors.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="w-20 h-20 bg-gray-50 dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Visitors Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">When visitors sign in at your open house, they'll appear here.</p>
              </div>
            ) : (
              <>
                {/* Desktop / tablet: table */}
                <div className="hidden md:block bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-[#faf9f7] dark:bg-[#0B0B0B]">
                        <tr>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Visitor
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Contact Info
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Agent Status
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Checked In
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-[#151517]">
                        {visitors.map((visitor, index) => (
                          <Fragment key={visitor.id}>
                            {!isSameDayAsPrevious(visitor, index) && (
                              <tr className={index > 0 ? 'border-t-8 border-t-[#faf9f7] dark:border-t-[#0B0B0B]' : ''}>
                                <td colSpan={5} className="px-6 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                  {formatGroupDate(visitor.created_at)}
                                </td>
                              </tr>
                            )}
                            <motion.tr
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
                              data-visitor-id={visitor.id}
                              className={`hover:bg-gray-50 dark:hover:bg-[#2c241b] transition-colors ${isSameDayAsPrevious(visitor, index) ? 'border-t border-gray-100 dark:border-gray-800/60' : ''} ${focusRing(visitor.id)}`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap w-1/5">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 bg-[#151517] dark:bg-[#C9A24D] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white text-sm font-bold">
                                      {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{visitor.full_name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap w-1/4">
                                <div className="flex flex-col space-y-1">
                                  <CopyField field={`${visitor.id}-email`} value={visitor.email} icon={Mail} href={`mailto:${visitor.email}`} />
                                  <CopyField field={`${visitor.id}-phone`} value={visitor.phone} icon={Phone} href={`tel:${visitor.phone}`} display={formatPhone(visitor.phone)} />
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getAgentStatusColor(visitor.has_agent)}`}>
                                  {getAgentStatusLabel(visitor.has_agent)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {formatDate(visitor.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenNoteModal(visitor)}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600"
                                >
                                  <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  Notes
                                </button>
                              </td>
                            </motion.tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile: compact pill cards, no inner scrolling needed */}
                <div className="md:hidden space-y-0">
                  {visitors.map((visitor, index) => (
                    <div key={visitor.id} className={isSameDayAsPrevious(visitor, index) ? 'mt-2' : 'mt-5'}>
                      {!isSameDayAsPrevious(visitor, index) && (
                        <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {formatGroupDate(visitor.created_at)}
                        </p>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
                        data-visitor-id={visitor.id}
                        className={`rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] shadow-sm p-4 ${focusVisitorId === visitor.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 dark:ring-offset-[#0B0B0B]' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center min-w-0">
                            <div className="h-10 w-10 bg-[#151517] dark:bg-[#C9A24D] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                              <span className="text-white text-sm font-bold">
                                {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-3 min-w-0">
                              <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{visitor.full_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1} · {formatDate(visitor.created_at)}</div>
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getAgentStatusColor(visitor.has_agent)}`}>
                            {getAgentStatusLabel(visitor.has_agent)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
                          <CopyField field={`${visitor.id}-email-m`} value={visitor.email} icon={Mail} href={`mailto:${visitor.email}`} />
                          <CopyField field={`${visitor.id}-phone-m`} value={visitor.phone} icon={Phone} href={`tel:${visitor.phone}`} display={formatPhone(visitor.phone)} />
                        </div>

                        <button
                          onClick={() => handleOpenNoteModal(visitor)}
                          className="mt-3 inline-flex w-full items-center justify-center px-3 py-2 rounded-lg text-xs font-bold transition-all bg-[#faf9f7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600"
                        >
                          <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Notes
                        </button>
                      </motion.div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!embedded && <Footer />}

      {/* Note Modal - portaled to <body>: inside the pop-up (a transformed, scrolling box) a
          "fixed" window was pinned to the top of the list instead of the screen. */}
      {typeof document !== 'undefined' && createPortal(<AnimatePresence>
      {isNoteModalOpen && selectedVisitorForNote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-[#111827]/60 z-[120] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#faf9f7] dark:bg-[#0B0B0B]">
              <div>
                <h3 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Visitor Note</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  For {selectedVisitorForNote.full_name}
                </p>
              </div>
              <button
                onClick={handleCloseNoteModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {selectedVisitorForNote.lead_id ? (
                <>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Notes
                  </label>
                  <p className="text-[11px] font-medium text-gray-400 mb-3 ml-1">Shared with this visitor's matching lead profile.</p>
                  <NotesThread
                    notes={visitorNotes}
                    loading={visitorNotesLoading}
                    currentUserId={user?.id}
                    onAdd={handleAddVisitorNote}
                    onEdit={handleEditVisitorNote}
                    onDelete={handleDeleteVisitorNote}
                  />
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                      Note Content
                    </label>
                    <textarea
                      value={currentNote}
                      onChange={(e) => setCurrentNote(e.target.value)}
                      className="block w-full px-4 py-3 bg-[#faf9f7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 resize-none font-medium"
                      rows={6}
                      placeholder="Enter notes about this visitor's preferences, feedback, or follow-up needs..."
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={handleCloseNoteModal}
                      className="px-5 py-2.5 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-all duration-200 text-xs uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNoteFromModal}
                      className="px-6 py-2.5 bg-[#151517] dark:bg-white hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-wide"
                    >
                      Save Note
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>, document.body)}
    </div>
  )
}
