'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, cascade, panelMotion, riseItem } from './modalMotion'
import { refreshFormsActionCount } from '@/hooks/useFormsActionCount'
import {
  BarChart3, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Info, Loader2, Mail,
  Megaphone, Pencil, Plus, QrCode as QrCodeIcon, Trash2, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { AgentFormConfig, FormCampaign, FormSubmissionListItem, Site, SiteDomain } from '@/types'
import { openHousePalPublicUrl, websitePublicHostname, websitePublicUrl } from '@/lib/publicResourceLinks'
import FormQrCode from '@/components/forms/FormQrCode'
import { FormStatsContent } from '@/components/forms/FormStatsModal'
import { ShowcaseFormInfoBlock } from './ShowcaseFormInfo'
import UnfinishedResponses from '@/components/forms/UnfinishedResponses'
import FormResultsModal from '@/components/forms/FormResultsModal'
import NewCampaignModal from '@/components/forms/NewCampaignModal'
import CampaignRedirectPicker, { CampaignRedirect, campaignRedirectError, campaignRedirectLabel, campaignRedirectPayload } from '@/components/forms/CampaignRedirectPicker'
import ConfirmationModal from '@/components/ConfirmationModal'
import { copyText } from '@/lib/copyText'

function withCampaignToken(url: string, token: string | null) {
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}c=${encodeURIComponent(token)}`
}

type Tab = 'campaigns' | 'stats' | 'results'
// Stats scope: unset = "All Campaigns" combined, 'general' = General only, a real id = one named
// campaign (works for deleted campaigns too, since history stays fully queryable by name).
type StatsScope = string | 'general' | null | undefined
// Results scope: 'all' = every submission (the collective Results tab). 'general' = General only.
// A string = one named campaign, matched by name (FormSubmissionListItem only carries the name,
// not the campaign id).
type ResultsScope = 'all' | 'general' | string

function HoverInfo({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-gray-400 hover:text-[#8b7355] dark:hover:text-[#e8cf8a]" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 text-[11px] font-medium leading-snug text-gray-600 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
        {text}
      </span>
    </span>
  )
}

function InfoPopover() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="inline-flex items-center gap-1 text-xs font-bold text-[#8b7355] hover:text-[#6b5a43] dark:text-[#e8cf8a] dark:hover:text-[#f0dca6]"
      >
        <Info className="h-3.5 w-3.5" /> What's a campaign?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[85vw] rounded-xl border border-gray-200 bg-white p-4 text-xs font-medium leading-relaxed text-gray-600 shadow-xl dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            A campaign gives you a separate link and QR code for the same form, so you know where your leads came from. Example: use one link for a Villanova mailer and another for a Facebook ad. Both show the exact same form — OpenHousePal just tracks the results separately.
            <p className="mt-2 font-black text-[#111827] dark:text-white">Same form. Different tracking link.</p>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Want to change the questions instead? Use Duplicate to make your own editable copy.</p>
          </div>
        </>
      )}
    </div>
  )
}

// One link's Open/Copy/QR row - a campaign shows one of these per link surface it has (OpenHousePal
// always, Website only if the agent has IDX), so it's never ambiguous which link a click affects.
function LinkActionRow({ label, url, onQr }: { label: string; url: string; onQr: () => void }) {
  const [justCopied, setJustCopied] = useState(false)
  return (
    <div className={`-mx-1 flex items-center justify-between gap-2 rounded-lg px-1 py-1 transition-colors duration-500 ${justCopied ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
      <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title={`Open ${label}`} aria-label={`Open ${label}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { copyText(url); setJustCopied(true); setTimeout(() => setJustCopied(false), 1200) }}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white"
          title={`Copy ${label}`}
          aria-label={`Copy ${label}`}
        >
          {justCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onQr} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title={`QR code for ${label}`} aria-label={`QR code for ${label}`}>
          <QrCodeIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// "After submitting: X · Change" under a campaign's links - edits apply to the next visit, so
// QR codes already printed follow the new choice.
function CampaignRedirectRow({ campaign, formId, formGoesToHub, onSaved }: { campaign: FormCampaign; formId: string; formGoesToHub: boolean; onSaved: () => void }) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<CampaignRedirect>({ mode: (campaign.redirect_mode as CampaignRedirect['mode']) || null, url: campaign.redirect_url || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    const linkError = campaignRedirectError(value)
    if (linkError) { setError(linkError); return }
    if (!campaign.id) return
    setSaving(true)
    const res = await api.forms.updateCampaign(formId, campaign.id, campaignRedirectPayload(value))
    setSaving(false)
    if (res.success) { setEditing(false); setError(''); onSaved(); showToast('Saved - this campaign now sends people there', 'success') }
    else setError(res.error || 'Could not save. Please try again.')
  }
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 pt-1" data-testid="campaign-redirect-row">
        <p className="min-w-0 truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          <span className="font-black uppercase tracking-widest text-gray-400">After submitting:</span>{' '}
          {campaignRedirectLabel(campaign.redirect_mode, campaign.redirect_url, formGoesToHub)}
        </p>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black text-[#8b7355] hover:text-[#6b5a43] dark:text-[#e8cf8a]">
          <Pencil className="h-3 w-3" /> Change
        </button>
      </div>
    )
  }
  return (
    <div className="pt-2">
      <CampaignRedirectPicker value={value} onChange={v => { setValue(v); setError('') }} formGoesToHub={formGoesToHub} compact />
      {error && <p className="mt-1.5 text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => { setEditing(false); setError(''); setValue({ mode: (campaign.redirect_mode as CampaignRedirect['mode']) || null, url: campaign.redirect_url || '' }) }} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}

function CampaignRow({
  campaign, formUrl, websiteUrl, websiteLabel, isDeleted, onDelete, onStats, onResults, onQr, formId, formGoesToHub, onRedirectSaved,
}: {
  formId?: string
  formGoesToHub?: boolean
  onRedirectSaved?: () => void
  campaign: FormCampaign
  formUrl: string
  websiteUrl: string | null
  websiteLabel: string
  isDeleted: boolean
  onDelete?: () => void
  onStats: () => void
  onResults: () => void
  onQr: (url: string, label: string) => void
}) {
  const campaignUrl = withCampaignToken(formUrl, campaign.token)
  const campaignWebsiteUrl = websiteUrl ? withCampaignToken(websiteUrl, campaign.token) : null

  return (
    <div className={`rounded-xl border px-4 py-3 ${isDeleted ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{campaign.name}</p>
            {campaign.is_general && (
              <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355] dark:bg-[#C9A24D]/20 dark:text-[#e8cf8a]">Default</span>
            )}
            {isDeleted && (
              <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">Deleted</span>
            )}
          </div>
          {campaign.description && <p className="mt-0.5 text-xs font-medium text-gray-400">{campaign.description}</p>}
          <p className="mt-0.5 text-xs font-semibold text-gray-400">{campaign.views} views · {campaign.leads} leads</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            onClick={onResults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D]/50 hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400 dark:hover:border-[#C9A24D]/40 dark:hover:text-[#e8cf8a]"
            title={`View results for ${campaign.name}`}
          >
            <Mail className="h-3.5 w-3.5" /> Results
          </button>
          <button
            onClick={onStats}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D]/50 hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400 dark:hover:border-[#C9A24D]/40 dark:hover:text-[#e8cf8a]"
            title={`View stats for ${campaign.name}`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Stats
          </button>
          {onDelete && (
            <button onClick={onDelete} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete campaign" aria-label="Delete campaign">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {!isDeleted && (
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 dark:border-gray-800">
          <LinkActionRow label="OpenHousePal Link" url={campaignUrl} onQr={() => onQr(campaignUrl, `${campaign.name} · OpenHousePal`)} />
          {campaignWebsiteUrl && (
            <LinkActionRow label={websiteLabel} url={campaignWebsiteUrl} onQr={() => onQr(campaignWebsiteUrl, `${campaign.name} · ${websiteLabel}`)} />
          )}
          {!campaign.is_general && campaign.id && formId && (
            <CampaignRedirectRow campaign={campaign} formId={formId} formGoesToHub={!!formGoesToHub} onSaved={() => onRedirectSaved?.()} />
          )}
        </div>
      )}
    </div>
  )
}

export default function FormCampaignsModal({
  form, onClose, onEdit, onDuplicate, initialView, onReviewedChange,
}: {
  form: AgentFormConfig
  onClose: () => void
  /** A response was marked reviewed / new here - lets the Forms page update its card count. */
  onReviewedChange?: (submissionId: string, isReviewed: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  /** Open straight on Results -> Unfinished (deep link from a lead). */
  initialView?: 'unfinished'
}) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>(initialView ? 'results' : 'campaigns')
  // Results tab: submitted responses, or people who started but never pressed Submit.
  const [resultsView, setResultsView] = useState<'submitted' | 'unfinished'>(initialView || 'submitted')
  const showUnfinished = () => { setResultsView('unfinished'); setTab('results') }

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  const [campaigns, setCampaigns] = useState<FormCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  const [agentHubSlug, setAgentHubSlug] = useState('')

  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<FormCampaign | null>(null)
  const [deletingCampaign, setDeletingCampaign] = useState(false)
  const [qrTarget, setQrTarget] = useState<{ url: string; label: string } | null>(null)
  const [showDeletedSection, setShowDeletedSection] = useState(false)

  const [statsScope, setStatsScope] = useState<StatsScope>(undefined)

  const [submissions, setSubmissions] = useState<FormSubmissionListItem[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(true)
  const [showFullResults, setShowFullResults] = useState(false)
  const [resultsScope, setResultsScope] = useState<ResultsScope>('all')
  const [deleteSubmissionTarget, setDeleteSubmissionTarget] = useState<FormSubmissionListItem | null>(null)
  const [deletingSubmission, setDeletingSubmission] = useState(false)

  useEffect(() => {
    Promise.all([
      api.forms.getCampaigns(form.id),
      api.sites.getMine(),
      api.sites.getDomains(),
      api.agentHub.getMine(),
      api.forms.getSubmissions(form.id),
    ]).then(([campaignsRes, siteRes, domainsRes, hubRes, submissionsRes]) => {
      if (campaignsRes.success && campaignsRes.data) setCampaigns(campaignsRes.data)
      if (siteRes.success && siteRes.data) setIdxSite(siteRes.data)
      if (domainsRes.success && domainsRes.data) setIdxDomains(domainsRes.data)
      if (hubRes.success && hubRes.data?.slug) setAgentHubSlug(hubRes.data.slug)
      if (submissionsRes.success && submissionsRes.data) setSubmissions(submissionsRes.data)
      setCampaignsLoading(false)
      setSubmissionsLoading(false)
    })
  }, [form.id])

  const refreshCampaigns = async () => {
    const response = await api.forms.getCampaigns(form.id)
    if (response.success && response.data) setCampaigns(response.data)
  }

  const handleCreateCampaign = async (name: string, redirect: CampaignRedirect) => {
    const response = await api.forms.createCampaign(form.id, name, campaignRedirectPayload(redirect))
    if (response.success) {
      await refreshCampaigns()
      setShowNewCampaignModal(false)
      showToast('Campaign created', 'success')
      return true
    }
    return false
  }

  const handleConfirmDeleteCampaign = async () => {
    if (!deleteCampaignTarget?.id) return
    setDeletingCampaign(true)
    const response = await api.forms.deleteCampaign(form.id, deleteCampaignTarget.id)
    if (response.success) {
      await refreshCampaigns()
      setDeleteCampaignTarget(null)
      showToast('Campaign deleted', 'success')
    } else {
      showToast(response.error || 'Unable to delete this campaign. Please try again.', 'error')
    }
    setDeletingCampaign(false)
  }

  const handleToggleReviewed = async (submissionId: string, isReviewed: boolean) => {
    setSubmissions(current => current.map(s => s.id === submissionId ? { ...s, is_reviewed: isReviewed } : s))
    onReviewedChange?.(submissionId, isReviewed)
    const response = await api.forms.markReviewed(submissionId, isReviewed)
    if (!response.success) {
      setSubmissions(current => current.map(s => s.id === submissionId ? { ...s, is_reviewed: !isReviewed } : s))
      onReviewedChange?.(submissionId, !isReviewed)
    }
    // Nav + Dash badges re-count now (the backend also cleared the lead's "new" flag).
    refreshFormsActionCount()
  }

  const handleConfirmDeleteSubmission = async () => {
    if (!deleteSubmissionTarget) return
    setDeletingSubmission(true)
    const response = await api.forms.deleteSubmission(deleteSubmissionTarget.id)
    if (response.success) {
      setSubmissions(current => current.filter(s => s.id !== deleteSubmissionTarget.id))
      setDeleteSubmissionTarget(null)
    }
    setDeletingSubmission(false)
  }

  const openResultsFor = (scope: ResultsScope) => {
    setResultsScope(scope)
    setShowFullResults(true)
  }

  const [resultsFilter, setResultsFilter] = useState<ResultsScope>('all')
  const resultsFilterOptions: { value: ResultsScope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'general', label: 'General' },
    ...Array.from(new Set(submissions.map(s => s.campaign_name).filter((name): name is string => Boolean(name))))
      .map(name => ({ value: name as ResultsScope, label: name })),
  ]
  const filteredResultsSubmissions = resultsFilter === 'all'
    ? submissions
    : resultsFilter === 'general'
      ? submissions.filter(s => !s.campaign_name)
      : submissions.filter(s => s.campaign_name === resultsFilter)
  const filteredPendingCount = filteredResultsSubmissions.filter(s => !s.is_reviewed).length
  const resultsPreview = filteredResultsSubmissions.slice(0, 4)

  const agentHubPublicUrl = openHousePalPublicUrl(`/${agentHubSlug}`)
  const formUrl = `${agentHubPublicUrl}/${form.slug}`
  const websiteFormUrl = websitePublicUrl(idxSite, idxDomains, `/forms/${form.slug}`)
  const websiteHostname = websitePublicHostname(idxSite, idxDomains)
  const websiteLabel = `${websiteHostname || 'Website'} Link`

  const activeCampaigns = campaigns.filter(c => !c.is_general && !c.deleted_at)
  const deletedCampaigns = campaigns.filter(c => !c.is_general && c.deleted_at)
  const general = campaigns.find(c => c.is_general) || { id: null, name: 'General', token: null, is_general: true, description: 'Your everyday link for this form.', views: 0, leads: 0 }

  const pendingSubmissions = submissions.filter(s => !s.is_reviewed).length

  const statsScopeOptions: { value: StatsScope; label: string }[] = [
    { value: undefined, label: 'All Campaigns' },
    { value: 'general', label: 'General' },
    ...activeCampaigns.map(c => ({ value: c.id as StatsScope, label: c.name })),
  ]

  const scopedSubmissions = resultsScope === 'all'
    ? submissions
    : resultsScope === 'general'
      ? submissions.filter(s => !s.campaign_name)
      : submissions.filter(s => s.campaign_name === resultsScope)
  const resultsFormForModal = resultsScope === 'all'
    ? form
    : { ...form, title: `${form.title} · ${resultsScope === 'general' ? 'General' : resultsScope}` }

  return (
    <motion.div {...backdropMotion} className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 sm:p-6">
      <motion.div {...panelMotion} className={`mx-auto flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-gray-800 dark:bg-[#0B0B0B] ${tab === 'stats' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-[#0B0B0B]">
          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-[#111827] dark:text-white">{form.title}</p>
            <p className="truncate text-xs font-semibold text-gray-400 dark:text-gray-500">{form.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Form
            </button>
            <button
              onClick={onDuplicate}
              className="hidden items-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a] sm:inline-flex"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* When this form builds the person their own Showcase (only the 3 premade ones that do). */}
        <ShowcaseFormInfoBlock formType={form.form_type} />

        <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-white px-5 pt-2 dark:border-gray-800 dark:bg-[#0B0B0B]">
          {([
            { id: 'campaigns' as const, label: 'Campaigns', icon: Megaphone },
            { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
            { id: 'results' as const, label: 'Results', icon: Mail, badge: pendingSubmissions },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-sm font-black transition-colors ${
                tab === t.id
                  ? 'text-[#111827] dark:text-white'
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              {tab === t.id && (
                <motion.span layoutId={`form-tab-${form.id}`} className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[#C9A24D]" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />
              )}
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {Boolean(t.badge) && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{t.badge! > 9 ? '9+' : t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#FAFAF7] p-5 dark:bg-[#0B0B0B] sm:p-6">
          <AnimatePresence mode="wait">
          <motion.div key={tab} variants={cascade} initial="hidden" animate="show" exit="leave">
          {tab === 'campaigns' && (
            campaignsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
            ) : (
              <motion.div variants={cascade}>
                <motion.button
                  variants={riseItem}
                  onClick={() => setShowNewCampaignModal(true)}
                  className="group flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.06] p-4 text-left transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/[0.05] sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow-sm transition group-hover:scale-105">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-[#111827] dark:text-white">New Campaign</span>
                      <HoverInfo text="Creates a brand-new tracking link for this exact same form - identical questions and design, just its own link, QR code, and stats. Nothing about the form itself changes." />
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Same form, new tracking link — track a mailer, ad, or flyer separately.</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5" />
                </motion.button>

                <motion.div variants={riseItem} className="mt-4 rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#C9A24D]/[0.07] via-white to-white p-5 dark:border-[#C9A24D]/20 dark:from-[#C9A24D]/[0.06] dark:via-[#111113] dark:to-[#111113] sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">Your Campaigns</p>
                    <InfoPopover />
                  </div>

                  <motion.div variants={cascade} className="mt-4 space-y-2.5">
                    <motion.div variants={riseItem}>
                    <CampaignRow
                      campaign={general as FormCampaign}
                      formUrl={formUrl}
                      websiteUrl={websiteFormUrl}
                      websiteLabel={websiteLabel}
                      isDeleted={false}
                      onStats={() => { setStatsScope('general'); setTab('stats') }}
                      onResults={() => openResultsFor('general')}
                      onQr={(url, label) => setQrTarget({ url, label })}
                    />
                    </motion.div>
                    {activeCampaigns.map(campaign => (
                      <motion.div key={campaign.id} variants={riseItem}>
                      <CampaignRow
                        campaign={campaign}
                        formUrl={formUrl}
                        websiteUrl={websiteFormUrl}
                        websiteLabel={websiteLabel}
                        isDeleted={false}
                        onDelete={() => setDeleteCampaignTarget(campaign)}
                        onStats={() => { setStatsScope(campaign.id); setTab('stats') }}
                        onResults={() => openResultsFor(campaign.name)}
                        onQr={(url, label) => setQrTarget({ url, label })}
                        formId={form.id}
                        formGoesToHub={form.redirect_to_agent_hub}
                        onRedirectSaved={refreshCampaigns}
                      />
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>

                {deletedCampaigns.length > 0 && (
                  <motion.div variants={riseItem} className="mt-4">
                    <button
                      onClick={() => setShowDeletedSection(current => !current)}
                      className="inline-flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDeletedSection ? 'rotate-180' : ''}`} />
                      Deleted campaigns ({deletedCampaigns.length})
                    </button>
                    {showDeletedSection && (
                      <div className="mt-2.5 space-y-2.5">
                        {deletedCampaigns.map(campaign => (
                          <CampaignRow
                            key={campaign.id}
                            campaign={campaign}
                            formUrl={formUrl}
                            websiteUrl={websiteFormUrl}
                            websiteLabel={websiteLabel}
                            isDeleted
                            onStats={() => { setStatsScope(campaign.id); setTab('stats') }}
                            onResults={() => openResultsFor(campaign.name)}
                            onQr={(url, label) => setQrTarget({ url, label })}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )
          )}

          {tab === 'stats' && (
            <div>
              <motion.div variants={riseItem} className="flex flex-wrap gap-1.5">
                {statsScopeOptions.map(option => (
                  <button
                    key={option.label}
                    onClick={() => setStatsScope(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                      statsScope === option.value
                        ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                        : 'border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-[#151517]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
              <motion.div variants={riseItem} className="mt-5">
                <FormStatsContent formId={form.id} campaignId={statsScope} onShowUnfinished={showUnfinished} />
              </motion.div>
            </div>
          )}

          {tab === 'results' && (
            <motion.div variants={riseItem} className="mb-4 inline-flex rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-[#151517]">
              {([['submitted', 'Submitted'], ['unfinished', 'Unfinished']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setResultsView(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${resultsView === key ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}

          {tab === 'results' && (
          <AnimatePresence mode="wait" initial={false}>
          <motion.div key={resultsView} variants={cascade} initial="hidden" animate="show" exit="leave">
          {resultsView === 'unfinished' && <motion.div variants={riseItem}><UnfinishedResponses formId={form.id} /></motion.div>}

          {resultsView === 'submitted' && (
            submissionsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
            ) : submissions.length === 0 ? (
              <motion.div variants={riseItem} className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Mail className="h-6 w-6 text-gray-300" />
                <p className="text-sm font-semibold text-gray-400">No submissions yet.</p>
              </motion.div>
            ) : (
              <motion.div variants={cascade}>
                {resultsFilterOptions.length > 2 && (
                  <motion.div variants={riseItem} className="flex flex-wrap gap-1.5">
                    {resultsFilterOptions.map(option => (
                      <button
                        key={option.label}
                        onClick={() => setResultsFilter(option.value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                          resultsFilter === option.value
                            ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                            : 'border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-[#151517]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
                <motion.p variants={riseItem} className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${resultsFilterOptions.length > 2 ? 'mt-3' : ''}`}>
                  {resultsFilter === 'all' ? 'All campaigns combined' : resultsFilter === 'general' ? 'General only' : `"${resultsFilter}" campaign`} · {filteredPendingCount === 0 ? `${filteredResultsSubmissions.length} response${filteredResultsSubmissions.length === 1 ? '' : 's'} · no new` : `${filteredPendingCount} new response${filteredPendingCount === 1 ? '' : 's'} of ${filteredResultsSubmissions.length}`}
                </motion.p>
                <div className="mt-3 space-y-2">
                  {resultsPreview.map(submission => (
                    <motion.button
                      variants={riseItem}
                      key={submission.id}
                      onClick={() => openResultsFor(resultsFilter)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-[#151517]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{submission.contact_name || 'Anonymous'}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{submission.contact_email || submission.contact_phone || submission.property_address || 'No contact details'}</p>
                        <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8cf8a]">{submission.campaign_name || 'General'}</p>
                      </div>
                      <AnimatePresence initial={false}>
                        {!submission.is_reviewed && (
                          <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">New</motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  ))}
                </div>
                <motion.button
                  variants={riseItem}
                  onClick={() => openResultsFor(resultsFilter)}
                  className="mt-4 w-full rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
                >
                  View {resultsFilter === 'all' ? 'All' : ''} Results{resultsFilter === 'general' ? ' — General' : resultsFilter !== 'all' ? ` — ${resultsFilter}` : ''}
                </motion.button>
              </motion.div>
            )
          )}
          </motion.div>
          </AnimatePresence>
          )}
          </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {showNewCampaignModal && (
        <NewCampaignModal onClose={() => setShowNewCampaignModal(false)} onCreate={handleCreateCampaign} formGoesToHub={form.redirect_to_agent_hub} />
      )}

      {qrTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setQrTarget(null) }}>
          <div className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-[#111827] dark:text-white">{qrTarget.label}</p>
              <button onClick={() => setQrTarget(null)} className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <FormQrCode url={qrTarget.url} size={168} />
            </div>
          </div>
        </div>
      )}

      <FormResultsModal
        isOpen={showFullResults}
        onClose={() => setShowFullResults(false)}
        form={resultsFormForModal}
        submissions={scopedSubmissions}
        isLoading={submissionsLoading}
        onToggleReviewed={handleToggleReviewed}
        onDeleteSubmission={(submission) => setDeleteSubmissionTarget(submission)}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteSubmissionTarget)}
        onClose={() => setDeleteSubmissionTarget(null)}
        onConfirm={handleConfirmDeleteSubmission}
        isLoading={deletingSubmission}
        title="Delete this submission?"
        message={`This submission from ${deleteSubmissionTarget?.contact_name || 'this visitor'} will be permanently deleted. This can't be undone.`}
        confirmText="Delete Submission"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg"
      />

      <ConfirmationModal
        isOpen={Boolean(deleteCampaignTarget)}
        onClose={() => setDeleteCampaignTarget(null)}
        onConfirm={handleConfirmDeleteCampaign}
        isLoading={deletingCampaign}
        title="Delete this campaign?"
        message={`"${deleteCampaignTarget?.name}"'s link will stop tracking new visits and fall back to General. Its past stats and leads stay exactly where they are.`}
        confirmText="Delete Campaign"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-600/30"
      />
    </motion.div>
  )
}
