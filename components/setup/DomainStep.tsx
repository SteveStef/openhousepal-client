'use client'

// Setup flow -> "Your web address" (IDX). Right after the website goes live, so nobody has to find
// the domain screen in Settings later (user, 10/20): keep the free address, connect a domain they
// already own (one-click where their company supports it), or buy a new one here. The same
// DomainsPanel the website builder and Settings use - nothing kept separately.
import { useEffect, useState } from 'react'
import { Globe, Loader2, Lock, ShoppingBag, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import DomainsPanel from '@/components/studio/website/DomainsPanel'
import { ChoiceCard, StepCtx, SubHead, useGate } from './SetupUi'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

type Choice = 'free' | 'have' | 'buy'

export function DomainStep({ ctx }: { ctx: StepCtx }) {
  const [slug, setSlug] = useState<string | null>(null)
  const [hasAny, setHasAny] = useState<boolean | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)

  const refresh = () => {
    Promise.all([api.sites.getDomains(), api.sites.getDomainShop()]).then(([d, s]) => {
      const any = (d.data || []).length > 0 || (s.data?.purchases || []).some(p => p.status === 'ACTIVE' || p.status === 'REGISTERING')
      setHasAny(any)
    })
  }
  useEffect(() => {
    api.sites.getMine().then(r => { if (r.success && r.data) setSlug(r.data.subdomain_slug) })
    refresh()
  }, [])
  // Coming back from PayPal / their domain company lands on this step with the domain already there.
  useEffect(() => { if (hasAny && !choice) setChoice('have') }, [hasAny, choice])

  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'domain' }) } }, [])

  if (!slug || hasAny === null) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const free = `${slug}.${OHP_BASE_DOMAIN}`

  return (
    <div className="space-y-8">
      <div>
        <SubHead sub="Where people find your website. You can change this any time.">Pick one</SubHead>
        <div className="grid gap-3 sm:grid-cols-3">
          <ChoiceCard on={choice === 'free'} onClick={() => setChoice('free')} title="Free address" blurb="Already working - nothing to do."
            badge={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Free</span>}>
            <div className="flex h-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fffdf8] to-[#f4ead7] px-2 dark:from-[#111827] dark:to-[#1d1810]">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-bold text-[#111827] shadow-sm dark:bg-black/40 dark:text-white">
                <Lock className="h-3 w-3 shrink-0 text-emerald-500" /><span className="truncate">{free}</span>
              </span>
            </div>
          </ChoiceCard>
          <ChoiceCard on={choice === 'have'} onClick={() => setChoice('have')} title="Use one I own" blurb="Like janesmithhomes.com - we walk you through it.">
            <div className="flex h-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f6f7fb] to-[#e9edf5] dark:from-[#111827] dark:to-[#0b0f0e]">
              <Globe className="h-9 w-9 text-[#8b7355] dark:text-[#e8c97a]" />
            </div>
          </ChoiceCard>
          <ChoiceCard on={choice === 'buy'} onClick={() => setChoice('buy')} title="Get a new one" blurb="Pick a name - we buy it and set it all up."
            badge={<Sparkles className="h-4 w-4 text-[#C9A24D]" />}>
            <div className="flex h-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fffaf0] to-[#f3e3bd] dark:from-[#1d1912] dark:to-[#2a2214]">
              <ShoppingBag className="h-9 w-9 text-[#8b6a2b] dark:text-[#e8c97a]" />
            </div>
          </ChoiceCard>
        </div>
      </div>

      {choice === 'free' && (
        <p className="rounded-2xl bg-[#FAFAF7] p-4 text-[14px] font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-white/65">
          Your website stays at <span className="font-mono font-bold text-[#111827] dark:text-white">{free}</span>. Want your own later? It&apos;s under Settings &gt; IDX Domain.
        </p>
      )}
      {(choice === 'have' || choice === 'buy') && (
        <div className="rounded-3xl border-2 border-[#ece5d6] bg-white p-4 dark:border-white/10 dark:bg-[#141416] sm:p-5">
          <DomainsPanel subdomainSlug={slug} bare back="setup" startWith={choice} hideFree onChanged={refresh} />
        </div>
      )}
    </div>
  )
}
