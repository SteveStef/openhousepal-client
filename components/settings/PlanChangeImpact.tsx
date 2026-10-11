'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import api, { type PlanImpact } from '@/lib/api-service'
import { PRICING_PLANS, type PlanTierId } from '@/lib/pricing'
import {
  hasAgentHubAccess, hasEmailSignatureAccess, hasMlsAccess, hasShowcaseAccess,
  hasStudioDesignAccess, hasStudioMediaAccess,
} from '@/lib/navAccess'

type Target = PlanTierId | 'CANCEL'

// Which plans include each feature - the same rules the backend enforces (auth.py access sets).
// For 'CANCEL' every check is false: nothing survives the end of the paid period.
const has = {
  showcases: (t: Target) => t !== 'CANCEL' && hasShowcaseAccess(t),
  agentHub: (t: Target) => t !== 'CANCEL' && hasAgentHubAccess(t),
  signature: (t: Target) => t !== 'CANCEL' && hasEmailSignatureAccess(t),
  studio: (t: Target) => t !== 'CANCEL' && hasStudioDesignAccess(t),
  media: (t: Target) => t !== 'CANCEL' && hasStudioMediaAccess(t),
  idx: (t: Target) => t === 'IDX',
  mls: (t: Target) => t !== 'CANCEL' && hasMlsAccess(t),
  anyPlan: (t: Target) => t !== 'CANCEL',
}

type Loss = { key: string; title: string; body: string; clientFacing: boolean }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function buildLosses(from: PlanTierId, to: Target, impact: PlanImpact | null): Loss[] {
  const losing = (feature: keyof typeof has) => has[feature](from) && !has[feature](to)
  const i = impact
  const losses: Loss[] = []

  if (losing('showcases')) {
    losses.push({
      key: 'showcases', clientFacing: true, title: 'Your client Showcases pause',
      body: i && i.active_showcases > 0
        ? `${plural(i.active_showcases, 'Showcase')} for ${plural(i.showcase_clients, 'client')} stop getting new matching homes and price-drop alerts, and their links show "paused". New open house guests without an agent won't get a Showcase, and you lose access to the Showcases page.`
        : "Open house guests without an agent will no longer get their own Showcase with instant alerts, and you lose access to the Showcases page.",
    })
  }
  if (losing('idx')) {
    losses.push({
      key: 'idx', clientFacing: true, title: 'Your IDX website and Spotlight sites go offline',
      body: `${i?.idx_site_published ? 'Your published IDX website' : 'The IDX website builder'}${i && i.spotlights_published > 0 ? ` and ${plural(i.spotlights_published, 'published Spotlight site')}` : ' and Spotlight'} stop loading for visitors - including every link and QR code on your custom domain.`,
    })
  }
  if (losing('agentHub')) {
    losses.push({
      key: 'hub', clientFacing: true, title: 'Your Agent Hub page goes offline',
      body: `${i?.agent_hub_slug ? `openhousepal.com/${i.agent_hub_slug}` : 'Your public Agent Hub page'} stops loading - every link and QR code pointing to it (including on printed Brag Sheets and Cheat Sheets) will show "not active".`,
    })
  }
  if (losing('signature')) {
    losses.push({
      key: 'signature', clientFacing: true, title: 'Your email signature links stop working',
      body: 'The listing, sales and contact links inside the signature you installed in Gmail/Outlook stop resolving.',
    })
  }
  if (losing('studio')) {
    losses.push({
      key: 'studio', clientFacing: false, title: 'Studio, Blogs and Review Hub are locked',
      body: `You can't create or edit flyers, mailers and social posts${i && i.designs > 0 ? ` (your ${plural(i.designs, 'design')} are kept)` : ''}, publish blogs${i && i.blogs_published > 0 ? ` (${plural(i.blogs_published, 'published post')})` : ''}, or collect reviews through your review link${i && i.reviews > 0 ? ` (${plural(i.reviews, 'review')} kept)` : ''}.`,
    })
  }
  if (losing('media')) {
    losses.push({
      key: 'media', clientFacing: false, title: 'Media Lab is locked',
      body: `No more twilight, virtual staging or AI videos${i && i.media_assets > 0 ? ` - download anything you need from your ${plural(i.media_assets, 'generated photo/video', 'generated photos/videos')} first; they're kept but locked until you have Media Lab again` : ''}.`,
    })
  }
  if (losing('mls')) {
    losses.push({
      key: 'mls', clientFacing: false, title: 'Bright MLS data is removed',
      body: 'Discovery, Open House Manager, the CMA Builder, Similar Homes flyers and MLS property search go away - open houses and properties have to be entered by hand.',
    })
  }
  if (to === 'CANCEL') {
    losses.push({
      key: 'signin', clientFacing: true, title: 'Open house sign-in QR codes stop working',
      body: `Every sign-in QR code and kiosk${i && i.open_houses > 0 ? ` for your ${plural(i.open_houses, 'open house')}` : ''} - including ones already printed - stops accepting guests.`,
    })
    losses.push({
      key: 'forms', clientFacing: true, title: 'Your forms and their QR codes stop accepting responses',
      body: `${i && i.forms > 0 ? `All ${plural(i.forms, 'form')}` : 'Your forms'} - on your site, in ads, on mailers and printed QR codes - stop taking submissions, so no new leads come in.`,
    })
    losses.push({
      key: 'sync', clientFacing: false, title: 'Leads, calendar and CRM sync stop',
      body: `${i?.calendar_connected ? 'Your connected calendar stops syncing and ' : ''}new leads stop flowing to your CRM. You lose access to your dashboard and leads until you resubscribe.`,
    })
  }
  return losses
}

/**
 * A big, specific warning shown inside the downgrade/cancel confirmation - what the agent (and
 * their clients) actually lose, with their real numbers. Everything listed matches what the
 * backend really enforces once the change takes effect (public pages/links/alerts stop, data kept).
 */
export default function PlanChangeImpact({ from, to }: { from: PlanTierId; to: Target }) {
  const [impact, setImpact] = useState<PlanImpact | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.paypal.getImpact().then(res => {
      if (cancelled) return
      if (res.success && res.data) setImpact(res.data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const losses = buildLosses(from, to, impact)
  if (losses.length === 0) return null
  const clientFacing = losses.filter(l => l.clientFacing)
  const forYou = losses.filter(l => !l.clientFacing)
  const whenText = to === 'CANCEL' ? 'when your current paid period ends' : 'as soon as the switch takes effect'

  return (
    <div className="mt-4 space-y-3 text-left">
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm font-black uppercase tracking-wide text-red-800 dark:text-red-300">
            {to === 'CANCEL' ? 'Here is what stops' : `Moving to ${PRICING_PLANS[to].name} removes`} {whenText}
          </p>
          {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-red-400" />}
        </div>

        {clientFacing.length > 0 && (
          <>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-700/80 dark:text-red-400/80">Your clients will notice</p>
            <ul className="mt-1.5 space-y-2">
              {clientFacing.map(loss => (
                <li key={loss.key} className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                  <p className="text-[13px] font-black text-red-900 dark:text-red-200">{loss.title}</p>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-red-800/80 dark:text-red-300/80">{loss.body}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        {forYou.length > 0 && (
          <>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-700/80 dark:text-red-400/80">You lose access to</p>
            <ul className="mt-1.5 space-y-2">
              {forYou.map(loss => (
                <li key={loss.key} className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                  <p className="text-[13px] font-black text-red-900 dark:text-red-200">{loss.title}</p>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-red-800/80 dark:text-red-300/80">{loss.body}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Cancel: agents are told their data can be lost once the paid period ends (internal
          policy actually retains it ~3 months, but that's deliberately NOT promised). A downgrade
          keeps the subscription, so there the data genuinely stays. */}
      {to === 'CANCEL' ? (
        <div className="flex items-start gap-2 rounded-xl border-2 border-red-300 bg-white px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-xs font-bold leading-relaxed text-red-900 dark:text-red-300">
            Your data may be permanently deleted once your paid period ends if you don&apos;t renew - including your leads, Showcases, forms, open houses and designs. Download anything you want to keep before then.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium leading-relaxed text-emerald-900 dark:text-emerald-300">
            Your data stays in your account. Upgrade again any time and your Showcases, pages, forms and links come right back exactly as they were.
          </p>
        </div>
      )}
    </div>
  )
}
