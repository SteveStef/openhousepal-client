'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clapperboard, LayoutGrid, Lightbulb, Loader2, Moon, Sofa, Sparkles, Video,
} from 'lucide-react'
import LuxeHero, { LuxeTabs } from '@/components/ui/LuxeHero'
import AuthGuard from '@/components/AuthGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import StorageMeter from '@/components/StorageMeter'
import ConfirmationModal from '@/components/ConfirmationModal'
import api from '@/lib/api-service'
import type { StudioMediaAsset } from '@/types'
import { OHP_MEDIA_STYLE, ProjectCard, mediaGroup, type MediaGroup } from '@/components/studio/media/shared'

// This is now purely a list page, mirroring /studio/cma - the actual create wizard lives at its
// own route (/studio/media/new) and a finished/in-progress project at its own
// (/studio/media/[id]), matching CMA's "New CMA" -> its own page pattern instead of a modal
// floating on top of this list. Splitting these apart (rather than one page mounting the list +
// wizard + result together, with the wizard just an overlay on top) means opening a project no
// longer keeps this list's own polling/rendering alive underneath it - the reported lag.
function MediaLabListPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<StudioMediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof api.mediaLab.usage>>['data'] | null>(null)
  const [usageTick, setUsageTick] = useState(0)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StudioMediaAsset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | MediaGroup>('all')

  const refreshUsage = useCallback(() => setUsageTick(t => t + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.mediaLab.listAssets({ limit: 60 }).then(r => {
      if (alive && r.success && r.data) setProjects(r.data.assets)
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [usageTick])

  useEffect(() => {
    let alive = true
    api.mediaLab.usage().then(r => { if (alive && r.success && r.data) setUsage(r.data) })
    return () => { alive = false }
  }, [usageTick])

  // Some still-processing videos in the list never get a live poll here (that's the [id] page's
  // job while it's open) - a plain focus-triggered refetch is enough for the list itself to catch
  // up once the agent comes back, without running a poll loop for every card at once.
  useEffect(() => {
    const onFocus = () => refreshUsage()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUsage])

  const storageFull = !!usage && usage.storage_cap_bytes > 0 && usage.storage_used_bytes >= usage.storage_cap_bytes

  const downloadAsset = async (asset: StudioMediaAsset) => {
    setDownloadingId(asset.id)
    setError('')
    const isVid = asset.kind === 'video'
    const tc = asset.options?.title_card
    const br = asset.options?.branding
    const overlayOn = isVid && (!!tc?.enabled || !!br?.enabled)
    const { success, blob } = overlayOn
      ? await api.mediaLab.exportVideo(asset.id, { title_card: tc?.enabled ? tc : null, branding: br?.enabled ? br : null })
      : await api.mediaLab.download(asset.id)
    setDownloadingId(null)
    if (!success || !blob) { setError('Download failed. Try again in a moment.'); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${asset.action.replace(/\+/g, '-')}-${asset.id.slice(0, 8)}.${isVid ? 'mp4' : 'png'}`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const confirmDelete = async () => {
    const asset = pendingDelete
    if (!asset) return
    setDeleting(true)
    const { success, error: e } = await api.mediaLab.remove(asset.id)
    setDeleting(false)
    setPendingDelete(null)
    if (!success) { setError(e || 'Could not delete that item.'); return }
    setProjects(prev => prev.filter(a => a.id !== asset.id))
    refreshUsage()
  }

  const goCreate = () => router.push('/studio/media/new')

  return (
    <div className="ohp-media-lab min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style>{OHP_MEDIA_STYLE}</style>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">

        {/* Header - the shared luxe header: live AI usage + storage + Create, and the project
            filters built into its bottom edge */}
        <LuxeHero
          compact
          backHref="/studio"
          backLabel="Tools"
          kicker="Media Lab"
          icon={Clapperboard}
          title={<>Every photo, <em>at its best.</em></>}
          subtitle="Twilight, virtual staging, lights-on and video - from any listing photo or your own."
          aside={
            // AI usage lines up with the title, storage with the line under it
            <div className="w-full space-y-1.5 lg:mt-0.5">
              <MonthlyAiUsageMeter variant="inline" compact stretch refreshKey={usageTick} />
              <StorageMeter variant="inline" compact stretch refreshKey={usageTick} />
            </div>
          }
          tabs={
            <LuxeTabs
              label="Filter projects"
              active={filter}
              onChange={setFilter}
              items={[
                { id: 'all', label: 'All', icon: LayoutGrid },
                { id: 'twilight', label: 'Twilight', icon: Moon },
                { id: 'staging', label: 'Staging', icon: Sofa },
                { id: 'lights', label: 'Lights On', icon: Lightbulb },
                { id: 'video', label: 'Videos', icon: Video },
              ]}
              pinEnd
              end={
                <button
                  onClick={goCreate}
                  disabled={storageFull}
                  className="lx-shine relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/30 hover:shadow-lg hover:shadow-[#C9A24D]/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Create New
                </button>
              }
            />
          }
        />

        {storageFull && (
          <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            Storage full — delete some uploads or projects below to make room.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>
        )}

        {loading ? (
          <div className="mt-16 flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your projects...
          </div>
        ) : projects.length > 0 ? (
          (() => {
            const shown = filter === 'all' ? projects : projects.filter(p => mediaGroup(p) === filter)
            return (
              <div className="mt-6">
                <div className="mb-3">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Your projects</h2>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[11px] font-semibold text-gray-500 sm:truncate dark:text-gray-400">
                      Open one to compare, download or make another version - or delete it to free storage.
                    </p>
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">
                      {filter === 'all' ? projects.length : `${shown.length} of ${projects.length}`} {projects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                </div>
                <div className="mb-4 h-px bg-gradient-to-r from-[#C9A24D]/55 via-[#C9A24D]/15 to-transparent" />
                {shown.length === 0 ? (
                  <div key={filter} className="ohp-card-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#C9A24D]/40 bg-[#C9A24D]/[0.04] px-6 py-12 text-center">
                    {(() => {
                      const Icon = { twilight: Moon, staging: Sofa, lights: Lightbulb, video: Video, enhance: Sparkles }[filter as MediaGroup] || Sparkles
                      return <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-[#e8c97a] shadow-md dark:bg-white/10"><Icon className="h-5 w-5" /></span>
                    })()}
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                      No {({ twilight: 'twilight', staging: 'staged', lights: 'lights-on', video: 'video', enhance: 'enhanced' } as Record<string, string>)[filter] || ''} projects yet.
                    </p>
                    <button onClick={goCreate} disabled={storageFull} className="lx-shine relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-5 py-2.5 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/25 hover:shadow-lg hover:shadow-[#C9A24D]/40 disabled:opacity-40">
                      <Sparkles className="h-3.5 w-3.5" /> Create one
                    </button>
                  </div>
                ) : (
                  <div key={filter} className="grid grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {shown.map((p, i) => (
                      <ProjectCard
                        key={p.id}
                        asset={p}
                        active={false}
                        index={i}
                        downloading={downloadingId === p.id}
                        onOpen={() => router.push(`/studio/media/${p.id}`)}
                        onDownload={() => downloadAsset(p)}
                        onDelete={() => setPendingDelete(p)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()
        ) : (
          <div className="animate-fadeIn relative mt-5 overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-white shadow-sm dark:border-[#C9A24D]/20 dark:bg-[#151517]">
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f]" />
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#C9A24D]/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-6 px-6 py-10 text-center sm:px-10 sm:py-14">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                {[
                  { icon: Moon, label: 'Twilight', rot: '-rotate-6' },
                  { icon: Sofa, label: 'Staging', rot: 'rotate-3' },
                  { icon: Lightbulb, label: 'Lights On', rot: '-rotate-3' },
                  { icon: Video, label: 'AI Video', rot: 'rotate-6' },
                ].map(({ icon: Icon, label, rot }, i) => (
                  <div
                    key={label}
                    className={`ohp-reveal flex flex-col items-center gap-1.5 ${rot}`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#C9A24D]/30 bg-gradient-to-br from-[#111827] to-[#2a2116] text-[#C9A24D] shadow-md sm:h-16 sm:w-16">
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
                  </div>
                ))}
              </div>

              <div className="max-w-md">
                <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white sm:text-2xl">
                  Your first project starts here
                </h3>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                  Pick any photo from a listing — or upload your own — and turn it into a twilight
                  exterior, a staged room, a lights-on shot, or a full walkthrough video. Everything
                  you make gets saved right here.
                </p>
              </div>

              <button
                onClick={goCreate}
                disabled={storageFull}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition hover:scale-[1.02] hover:shadow-xl hover:shadow-[#C9A24D]/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                <Sparkles className="h-4 w-4" /> Create Your First Project
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        title="Delete this project?"
        message={`This removes the ${pendingDelete?.kind === 'video' ? 'video' : 'image'} from your storage for good. The original property photo is not touched.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/30"
      />
    </div>
  )
}

export default function MediaLabListPageGuarded() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireStudioMediaAccess>
          <MediaLabListPage />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
