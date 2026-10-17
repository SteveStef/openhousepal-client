'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { API_BASE_URL } from '@/lib/api-service'
import { ohpHostUrl } from '@/lib/publicResourceLinks'
import { agentFormUrl } from '@/lib/ownDomainLinks'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { getTemplate } from '@/lib/studio/designTemplates'
import { designAgentFrom } from '@/lib/studio/designAgent'
import DesignCanvas, { DesignCanvasContext } from '@/components/studio/design/DesignCanvas'
import { AgentFormConfig, BrandKit, CampaignLookup, DesignColorMode, DesignProject, DesignStyleId, OpenHouse, User } from '@/types'
import { qrCenterReady, setQrOwner } from '@/lib/qr'

// A bare, chrome-less render of a single design at full resolution - not reachable through normal
// navigation. Exists for exactly one consumer: the backend's PDF export (see
// backend/app/services/design_export_service.py), which launches a headless browser against this
// exact route so print exports are pixel-identical to the editor - same DesignCanvas component,
// no separate rendering path to keep in sync. Auth is a short-lived, single-purpose export token
// in the URL (backend/app/api/design_routes.py's create_export_token), not the normal session -
// a headless browser has no access to the agent's browser cookies/localStorage.
async function fetchWithToken<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function DesignPrintPageInner() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [design, setDesign] = useState<DesignProject | null>(null)
  const [ctx, setCtx] = useState<DesignCanvasContext | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!token) { setFailed(true); return }
    let cancelled = false
    ;(async () => {
      const [designRes, brandKit, user, hub, forms] = await Promise.all([
        fetchWithToken<DesignProject>(`/studio/designs/${params.id}`, token),
        fetchWithToken<BrandKit>('/studio/brand-kit', token),
        fetchWithToken<User>('/auth/me', token),
        fetchWithToken<{ slug: string; config?: Record<string, any> | null }>('/agent-hub/me', token),
        fetchWithToken<AgentFormConfig[]>('/agent-hub/forms/me', token),
      ])
      if (cancelled) return
      if (!designRes) { setFailed(true); return }
      // The QR in the design uses this agent's centre logo choice - wait for it before painting.
      if (user?.id) { setQrOwner(user.id); await qrCenterReady() }
      const format = getDesignFormat(designRes.design_type)
      if (!format) { setFailed(true); return }

      const listingKey = designRes.linked_property?.listing_key
      const openHouses = listingKey ? await fetchWithToken<OpenHouse[]>(`/api/open-houses?listing_key=${encodeURIComponent(listingKey)}`, token) : null
      const openHouseBlock = designRes.blocks.find(b => b.type === 'open_house_details')
      const linkedOpenHouse = openHouseBlock?.data?.open_house_event_id
        ? (openHouses || []).find(oh => oh.openHouseEventId === openHouseBlock.data.open_house_event_id)
        : null

      let campaignUrl: string | null = null
      if (designRes.campaign_id) {
        const campaignInfo = await fetchWithToken<CampaignLookup>(`/agent-hub/forms/campaigns/${designRes.campaign_id}`, token)
        // Same address the editor shows: the agent's own domain (/forms/<slug>) when they have one.
        const pub = await fetchWithToken<{ base_url: string; is_idx_site?: boolean }>('/studio/sites/me/public-base-url', token)
        const ownBase = pub?.is_idx_site && pub.base_url ? ohpHostUrl(new URL(pub.base_url).hostname) : null
        if (campaignInfo) campaignUrl = `${agentFormUrl(ownBase, hub?.slug || '', campaignInfo.form_slug)}?c=${encodeURIComponent(campaignInfo.token)}`
      }

      const buyerForm = (forms || []).find(f => f.form_type === 'buying')
      const sellerForm = (forms || []).find(f => f.form_type === 'selling')

      if (cancelled) return
      const templateDef = designRes.template_id ? getTemplate(designRes.template_id) : undefined
      setDesign(designRes)
      setCtx({
        format,
        styleId: designRes.style_id as DesignStyleId,
        colorMode: (designRes.color_mode || 'light') as DesignColorMode,
        composition: templateDef?.composition,
        layoutHints: templateDef?.layoutHints,
        situation: designRes.situation || null,
        property: designRes.linked_property || null,
        ...designAgentFrom(user, hub),
        brandKit: brandKit || null,
        agentHubSlug: hub?.slug || null,
        brandingMode: designRes.branding_mode,
        linkedOpenHouseFormUrl: linkedOpenHouse?.formUrl || null,
        buyerFormSlug: buyerForm?.slug || null,
        sellerFormSlug: sellerForm?.slug || null,
        campaignUrl,
      })
    })()
    return () => { cancelled = true }
  }, [params.id, token])

  // Tells the headless exporter (design_export_service.py) the page is fully painted: web fonts
  // loaded and every photo/logo decoded - so an export never captures a half-loaded image or a
  // fallback font.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!design || !ctx) return
    let cancelled = false
    ;(async () => {
      try { await (document as any).fonts?.ready } catch {}
      const root = document.querySelector('[data-design-canvas]')
      const urls = new Set<string>()
      root?.querySelectorAll<HTMLElement>('*').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage
        const m = bg && bg.match(/url\(["']?(.*?)["']?\)/)
        if (m && m[1] && !m[1].startsWith('data:')) urls.add(m[1])
      })
      root?.querySelectorAll('img').forEach(img => { if (img.src) urls.add(img.src) })
      await Promise.all(Array.from(urls).map(src => new Promise<void>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = src
      })))
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [design, ctx])

  if (failed) {
    return <div style={{ width: '100vw', height: '100vh', background: '#fff', color: '#b91c1c', fontFamily: 'sans-serif', padding: 24 }}>Could not load this design for export.</div>
  }
  if (!design || !ctx) {
    return <div style={{ width: '100vw', height: '100vh', background: '#fff' }} />
  }

  return (
    <div data-design-ready={ready ? '1' : '0'} style={{ position: 'fixed', inset: 0, margin: 0, padding: 0, background: '#fff', overflow: 'hidden', zIndex: 2147483647 }}>
      {/* A scrollbar (or the page background) must never eat into the export's edge. */}
      <style>{'html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important}::-webkit-scrollbar{display:none!important}nextjs-portal{display:none!important}'}</style>
      <DesignCanvas blocks={design.blocks} ctx={ctx} />
    </div>
  )
}

export default function DesignPrintPage() {
  return (
    <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: '#fff' }} />}>
      <DesignPrintPageInner />
    </Suspense>
  )
}
