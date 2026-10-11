'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Film, PlaySquare } from 'lucide-react'
import api from '@/lib/api-service'
import { MediaSettings } from '@/types'
import OhpSwitch from '@/components/ui/OhpSwitch'

interface HubItem { id: string; title?: string; link?: string }

// Drives the public /blog ("Media") page's Videos and House Tours sections. Blog posts always
// come from the real Blog table (nothing to configure - see content_adapters.get_blog_posts);
// videos/tours are a read-only mirror of this agent's own Agent Hub "Videos"/"House Tours"
// sections (AgentHub.config.videoLinks/houseTourLinks) - editing which videos/tours exist still
// happens in Agent Hub (one source of truth, never a second copy to maintain here), these two
// toggles just control whether the website's Media page also surfaces them.
export default function MediaSettingsPanel({
  value, onChange,
}: {
  value: MediaSettings
  onChange: (next: MediaSettings) => void
}) {
  const [videoCount, setVideoCount] = useState<number | null>(null)
  const [tourCount, setTourCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agentHub.getMine().then(res => {
      if (res.success && res.data?.config) {
        const videos = (res.data.config.videoLinks || []) as HubItem[]
        const tours = (res.data.config.houseTourLinks || []) as HubItem[]
        setVideoCount(videos.filter(v => v.link?.trim()).length)
        setTourCount(tours.filter(t => t.link?.trim()).length)
      }
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]">
          <PlaySquare className="h-3.5 w-3.5" /> Media Page
        </p>
        <p className="mt-1 text-[10px] font-semibold text-gray-400">
          Controls what shows on your site&apos;s public &quot;Media&quot; tab (yoursite.com/blog). Blog articles always
          show automatically - videos and house tours are synced from your Agent Hub.
        </p>

        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <div>
              <p className="text-xs font-black text-[#111827] dark:text-white">Show Videos</p>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
                {loading ? 'Checking Agent Hub...' : videoCount ? `${videoCount} video${videoCount === 1 ? '' : 's'} in your Agent Hub` : 'No videos linked in your Agent Hub yet'}
              </p>
            </div>
            <OhpSwitch on={value.show_videos} onChange={v => onChange({ ...value, show_videos: v })} label="Show Videos" testId="site-media-videos" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <div>
              <p className="text-xs font-black text-[#111827] dark:text-white">Show House Tours</p>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
                {loading ? 'Checking Agent Hub...' : tourCount ? `${tourCount} tour${tourCount === 1 ? '' : 's'} in your Agent Hub` : 'No house tours linked in your Agent Hub yet'}
              </p>
            </div>
            <OhpSwitch on={value.show_tours} onChange={v => onChange({ ...value, show_tours: v })} label="Show House Tours" testId="site-media-tours" />
          </div>
        </div>

        <a
          href="/studio/site"
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-800"
        >
          <Film className="h-3.5 w-3.5" /> Manage Videos &amp; Tours in Agent Hub <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
