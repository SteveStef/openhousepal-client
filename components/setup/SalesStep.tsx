'use client'

// The setup flow's Sales step. Only sales questions live here (the Agent Hub isn't made yet - its
// own display choices, like the swipe carousel, are in the Agent Hub step). Every answer is the
// feature's own saved setting, so changing it later in Agent Hub / Signature / Website shows here:
//   Sold stats      -> Agent Hub config showSalesStats (hub header, Sales page, Brag Sheet, website
//                      About page) + Email Signature banner.showStats (signature + its card).
//   Where they show -> hub section "sales" (layoutSections), the website's Recently Sold sections
//                      (GET/PUT /setup/website-sales) and Email Signature banner.showRecentSales.
//   Order           -> Agent Hub config salesSort (hub, Sales page, website).
//   Minimum price   -> Agent Hub config salesMinPrice (hub, Sales page, website, signature).
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BarChart3, CalendarClock, FileText, Globe, Home, LayoutTemplate, Loader2, Mail } from 'lucide-react'
import api from '@/lib/api-service'
import { applySalesDisplay, getEligibleSales, getSaleSummary, salesSortOf, type AgentSale, type SalesSort } from '@/lib/agentSales'
import { planHasBragSheet } from '@/lib/bragSheetData'
import { hasAgentHubAccess } from '@/lib/navAccess'
import { mergeSignatureConfig } from '@/lib/signatureConfig'
import RecentSalesPanel from '@/components/agent-hub/RecentSalesPanel'
import { HubPanelsOpen } from '@/components/agent-hub/HubPanelChrome'
import { MiniFlow, StepCtx, SubHead, useGate, useMiniFlow } from './SetupUi'
import { BigChoices, fmtMoney, hubSectionOn, hubSectionPatch, MiniLabel, Note, patchHubConfig, patchSignature, PlaceList, PlaceTile, QuestionCard, useSerialSaves } from './FeatureUi'

// Same choices as the Recent Sales editor's "Min price to display" (RecentSalesPanel).
const MIN_PRICES = [0, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000]
const minLabel = (v: number) => (v === 0 ? 'Show all' : `${fmtMoney(v)}+`)
const SORTS: { id: SalesSort; label: string; sub: string; icon: typeof CalendarClock }[] = [
  { id: 'newest', label: 'Newest first', sub: 'Your latest closings lead', icon: CalendarClock },
  { id: 'price-high', label: 'Highest price', sub: 'Lead with your biggest sales', icon: ArrowDownWideNarrow },
  { id: 'price-low', label: 'Lowest price', sub: 'Smallest first', icon: ArrowUpNarrowWide },
]

type Places = { hub: boolean; website: boolean | null; signature: boolean | null }

export function SalesStep({ ctx }: { ctx: StepCtx }) {
  const isIdx = ctx.plan === 'IDX'
  const hasSig = ctx.data.steps.some(s => s.id === 'signature')
  const brag = planHasBragSheet(ctx.plan)
  const serial = useSerialSaves()
  const [ready, setReady] = useState(false)
  const [sales, setSales] = useState<AgentSale[]>([])
  const [showStats, setShowStats] = useState(true)
  const [minPrice, setMinPrice] = useState(0)
  const [sort, setSort] = useState<SalesSort>('newest')
  const [places, setPlaces] = useState<Places>({ hub: true, website: null, signature: null })
  const [webSections, setWebSections] = useState(0)
  // unused by the compact list, but the panel keeps them in its props
  const [carousel, setCarousel] = useState(true)
  const [autoScroll, setAutoScroll] = useState(false)

  useEffect(() => {
    Promise.all([
      api.agentHub.getMine(),
      hasSig ? api.emailSignature.getMine() : Promise.resolve(null),
      isIdx ? api.setup.websiteSales() : Promise.resolve(null),
    ]).then(([h, s, w]) => {
      const c: Record<string, any> = (h.success && h.data?.config) || {}
      if (Array.isArray(c.recentSales)) setSales(c.recentSales)
      setShowStats(c.showSalesStats !== false)
      setMinPrice(Number(c.salesMinPrice) > 0 ? Number(c.salesMinPrice) : 0)
      setSort(salesSortOf(c.salesSort))
      if (typeof c.salesCarousel === 'boolean') setCarousel(c.salesCarousel)
      if (typeof c.salesAutoScroll === 'boolean') setAutoScroll(c.salesAutoScroll)
      const sig = s && s.success ? mergeSignatureConfig(s.data?.config) : null
      const web = w && w.success && w.data?.available ? w.data : null
      setWebSections(web?.sections || 0)
      setPlaces({ hub: hubSectionOn(c, 'sales'), website: web ? !!web.on : null, signature: sig ? sig.blockVisibility.banner !== false && sig.banner.showRecentSales !== false : null })
      setReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'sales' }) } }, [])
  // Four short pages (owner, 10/22) - the sales themselves first, since the stats add them up.
  // No Agent Hub (plain No-MLS): the sales only go on the Brag Sheet - just Sales + Stats.
  const hubPlan = hasAgentHubAccess(ctx.plan)
  const flow = useMiniFlow(ctx, hubPlan ? ['Sales', 'Stats', 'Where', 'Order'] : ['Sales', 'Stats'])

  const run = (job: () => Promise<unknown>) => ctx.markSaving(() => serial(job))
  const saveHub = (patch: Parameters<typeof patchHubConfig>[0]) => run(() => patchHubConfig(patch))

  const setStats = (v: boolean) => {
    setShowStats(v)
    saveHub({ showSalesStats: v })
    if (hasSig) run(() => patchSignature(c => ({ ...c, banner: { ...c.banner, showStats: v } })))
  }
  const setPlace = (key: keyof Places, v: boolean) => {
    setPlaces(p => ({ ...p, [key]: v }))
    if (key === 'hub') saveHub(cfg => hubSectionPatch(cfg, 'sales', v))
    if (key === 'website') run(() => api.setup.setWebsiteSales(v))
    if (key === 'signature') run(() => patchSignature(c => ({ ...c, blockVisibility: v ? { banner: true } : c.blockVisibility, banner: { ...c.banner, showRecentSales: v } })))
  }
  const anyPlace = places.hub || places.website === true || places.signature === true
  const setAll = (v: boolean) => {
    setPlace('hub', v)
    if (places.website !== null && (webSections > 0 || !v)) setPlace('website', v)
    if (places.signature !== null) setPlace('signature', v)
  }

  const eligible = useMemo(() => getEligibleSales(sales), [sales])
  const shown = eligible.filter(s => s.visible)
  const cleared = applySalesDisplay(shown, minPrice, sort)
  const summary = getSaleSummary(sales)

  if (!ready) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>

  const statPlaces = [
    ...(hubPlan ? [{ icon: LayoutTemplate, label: 'Your Agent Hub', sub: 'Across the top under your name, and on your Sales page.' }] : []),
    ...(hasSig ? [{ icon: Mail, label: 'Your email signature', sub: 'Plus your signature card on Cheat Sheets, Spotlights, website articles and Guest Pass pages.' }] : []),
    ...(isIdx ? [{ icon: Globe, label: 'Your website', sub: 'The numbers on your About page.' }] : []),
    ...(brag ? [{ icon: FileText, label: 'Your open house Brag Sheet', sub: 'The printed sheet in your open house kit.' }] : []),
  ]

  const salesPage = (
      <div key="sales">
        <SubHead sub={ctx.data.has_mls ? 'We look them up for you. Tap Shown / Hidden on any you’d rather leave out, or add one by hand.' : 'Add the homes you’ve sold - an address, the price and a photo is plenty.'}>Your sales</SubHead>
        <HubPanelsOpen.Provider value>
          <div className="setup-embed">
            <RecentSalesPanel compact sortOverride={sort === 'newest' ? 'recent' : sort} reLicenseNumber={ctx.data.info.licenseNumber} agentSales={sales} setAgentSales={setSales}
              showStats={showStats} setShowStats={setShowStats} carousel={carousel} setCarousel={setCarousel} autoScroll={autoScroll} setAutoScroll={setAutoScroll}
              minPrice={minPrice} setMinPrice={setMinPrice} onChange={() => {}} plain ready
              onSave={o => { if (o?.recentSales) { const next = o.recentSales; saveHub({ recentSales: next }) } }} />
          </div>
        </HubPanelsOpen.Provider>
      </div>
  )

  return (
    <MiniFlow flow={flow} pages={[
      salesPage,
      // 1. Sold stats - one switch for every place they appear
      <QuestionCard key="stats" icon={BarChart3} testId="sales-stats-question" on={showStats} onChange={setStats} title="Show my sold stats"
        blurb="Homes sold, total sales volume and average price - added up from your sales below.">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {([['Sold', String(summary.totalSold)], ['Volume', fmtMoney(summary.totalVolume)], ['Avg', fmtMoney(summary.avgPrice)]] as const).map(([k, v]) => (
            <div key={k} className={`rounded-2xl border px-2 py-3 text-center transition-opacity ${showStats ? 'border-[#C9A24D]/40 bg-white dark:bg-black/30' : 'border-gray-200 bg-gray-50 opacity-50 dark:border-white/10 dark:bg-white/[0.02]'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{k}</p>
              <p className="mt-1 font-serif text-[20px] font-black text-[#111827] dark:text-white">{summary.totalSold ? v : '-'}</p>
            </div>
          ))}
        </div>
        <MiniLabel>{showStats ? 'They show on' : 'Hidden everywhere - turn on to show them on'}</MiniLabel>
        <PlaceList places={statPlaces} />
        {!summary.totalSold && <p className="mt-3 text-[13px] font-semibold text-gray-500 dark:text-gray-400">They appear once you have a sale on the first page - zeros never show.</p>}
      </QuestionCard>,
      ...(hubPlan ? [

      // 2. Recent sales - where they show
      <QuestionCard key="where" icon={Home} testId="sales-show-question" on={anyPlace} onChange={setAll} title="Show my recent sales"
        blurb="Photos of the homes you've sold, with the price. Pick every place you want them.">
        <MiniLabel>Where they show</MiniLabel>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <PlaceTile icon={LayoutTemplate} title="Agent Hub" sub={isIdx ? 'Your Recent Sales row and Sales page - and your website’s About page.' : 'Your Recent Sales row and Sales page.'} on={places.hub} onChange={v => setPlace('hub', v)} />
          {places.website !== null && (
            <PlaceTile icon={Globe} title="Website" sub="The Recently Sold sections on your Home and Sold pages." on={!!places.website && webSections > 0} onChange={v => setPlace('website', v)}
              disabled={webSections === 0} note={webSections === 0 ? 'Your website has no Recently Sold section yet - add one in the website editor.' : undefined} />
          )}
          {places.signature !== null && (
            <PlaceTile icon={Mail} title="Email signature" sub="A strip of your newest sales under your name - it rotates by itself." on={!!places.signature} onChange={v => setPlace('signature', v)} />
          )}
        </div>
      </QuestionCard>,

      // 3. Order + 4. minimum price
      <div key="order" className="space-y-7">
      <div>
        <SubHead sub="The order your sales line up in on your Agent Hub, its Sales page and your website.">Sort my sales</SubHead>
        <BigChoices label="Sort my sales" value={sort} options={SORTS} onChange={v => { setSort(v); saveHub({ salesSort: v }) }} />
        {hasSig && <p className="mt-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">Your email signature always rotates through your newest sales.</p>}
      </div>

      {/* 4. Minimum price */}
      <div data-testid="sales-min-price">
        <SubHead sub="Only want to show off your bigger sales? Pick a price - anything under it is hidden.">Only show sales over a price</SubHead>
        <div role="radiogroup" aria-label="Minimum price" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {MIN_PRICES.map(v => {
            const on = v === minPrice
            return (
              <button key={v} type="button" role="radio" aria-checked={on} onClick={() => { setMinPrice(v); saveHub({ salesMinPrice: v }) }}
                className={`rounded-[16px] border-2 px-1 py-3 text-[13px] font-black transition sm:text-[14px] ${on ? 'border-[#C9A24D] bg-[#111827] text-[#e8c97a] shadow-[0_12px_24px_-18px_rgba(17,24,39,.9)] dark:bg-[#C9A24D] dark:text-[#111827]' : 'border-[#ece5d6] bg-white text-[#111827] hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416] dark:text-white'}`}>
                {minLabel(v)}
              </button>
            )
          })}
        </div>
        <div className="mt-3">
          <Note tone={minPrice ? 'gold' : 'plain'}>
            {minPrice
              ? <>Sales under <b>{fmtMoney(minPrice)}</b> are hidden on your Agent Hub, its Sales page, your website and your email signature. {shown.length ? <><b>{cleared.length} of your {shown.length}</b> shown sales make the cut.</> : null} Your sold stats still count every sale.</>
              : <>Every sale you keep shown on the first page appears. Pick a price to hide smaller ones everywhere at once - your sold stats still count them all.</>}
          </Note>
        </div>
      </div>
      </div>,
      ] : []),
    ]} />
  )
}
