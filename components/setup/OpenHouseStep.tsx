'use client'

// Setup -> "Your open house defaults" (owner, 10/22). Two real settings, nothing new invented:
// - The Showcase invite to guests who sign in without an agent: Studio -> Email's
//   "Showcase invite after your open house" switch and its delay (User.email_settings via
//   /api/v1/email-settings) - the same values that page shows.
// - How a new kit starts: the kit print choices the Create Open House Kit wizard pre-fills from
//   (lib/printPrefs - saved to the account, so every computer / phone starts kits the same way).
import { useEffect, useState } from 'react'
import { Loader2, Moon, Sparkles, Sun } from 'lucide-react'
import api, { type EmailSettings } from '@/lib/api-service'
import { syncPrintPrefs, writePrintPref, type PrintPref } from '@/lib/printPrefs'
import { hasMlsAccess, hasShowcaseAccess } from '@/lib/navAccess'
import { planHasBragSheet } from '@/lib/bragSheetData'
import { BigToggle, ChoiceCard, MiniFlow, StepCtx, SubHead, useGate, useMiniFlow } from './SetupUi'
import { SignInPhone } from '@/app/open-houses/components/KitReviewDialog'

const DELAY_LABEL: Record<number, string> = { 0: 'Right away', 15: 'In 15 min', 30: 'In 30 min', 60: 'In 1 hour' }

export function OpenHouseStep({ ctx }: { ctx: StepCtx }) {
  const plan = ctx.plan || undefined
  const showcases = hasShowcaseAccess(plan)
  const mls = hasMlsAccess(plan)
  const brag = planHasBragSheet(plan)
  const [es, setEs] = useState<EmailSettings | null>(null)
  const [prefs, setPrefs] = useState<Record<PrintPref, boolean> | null>(null)
  useEffect(() => {
    let alive = true
    syncPrintPrefs(true).then(p => { if (alive) setPrefs(p) })
    if (showcases) api.emailSettings.get().then(r => { if (r.success && r.data) setEs(r.data) })
    return () => { alive = false }
  }, [showcases])
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'openhouse' }) } }, [])
  // Two short pages when there's a Showcase question (owner, 10/22); just the kit otherwise.
  const hasGuests = showcases && (!es || es.client.some(c => c.key === 'showcase_invite'))
  const flow = useMiniFlow(ctx, hasGuests ? ['Guests', 'Kit'] : ['Kit'])

  if (!prefs || (showcases && !es)) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const setPref = (k: PrintPref, v: boolean) => { writePrintPref(k, v); setPrefs({ ...prefs, [k]: v }) }
  const invite = es?.client.find(c => c.key === 'showcase_invite')
  const saveEs = (patch: Parameters<typeof api.emailSettings.update>[0], local: EmailSettings) => {
    setEs(local)
    ctx.markSaving(api.emailSettings.update(patch).then(r => { if (r.success && r.data) setEs(r.data) }))
  }

  const guestsPage = showcases && es && invite ? (
        <div key="guests">
          <SubHead sub="Someone signs in at your open house and says they don't have an agent.">Guests without an agent</SubHead>
          <div className="rounded-[22px] border-2 border-[#C9A24D]/35 bg-gradient-to-br from-[#fffaf0] to-white p-1.5 dark:from-[#1d1912] dark:to-[#141416]">
            <BigToggle on={invite.on} onChange={on => saveEs({ client: { showcase_invite: { on } } }, { ...es, client: es.client.map(c => (c.key === 'showcase_invite' ? { ...c, on } : c)) })}
              title="Send them a Showcase automatically"
              blurb="A short personal note from you with their own Showcase - homes like the one they just saw, updated as new ones come up. Each guest gets it once." />
            {invite.on && (
              <div className="px-4 pb-3 pt-4">
                <p className="text-[14px] font-black text-[#111827] dark:text-white">When should it go out?</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {es.invite_delays.map(d => {
                    const on = es.invite_delay === d
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => saveEs({ invite_delay: d }, { ...es, invite_delay: d })}
                        className={`min-h-[44px] rounded-2xl border-2 px-3 py-2 text-[14px] font-black transition ${on ? 'border-[#C9A24D] bg-white text-[#111827] shadow-[0_12px_24px_-18px_rgba(139,106,43,.9)] dark:bg-[#141416] dark:text-white' : 'border-[#ece5d6] bg-white/70 text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300'}`}>
                        {DELAY_LABEL[d] || `After ${d} minutes`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-[13.5px] font-medium text-gray-500 dark:text-gray-400">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
            At an open house for your own listing, Showcases start off so guests stay focused on your home - you can turn them on for any open house on its card.
          </p>
        </div>
  ) : null

  const kitPage = (
      <div key="kit">
        <SubHead sub="Every new kit starts with these - you can still change them while you make it.">Your open house kit</SubHead>
        <p className="mb-2.5 text-[14px] font-black text-[#111827] dark:text-white">Sign-in screen guests see</p>
        {/* The two looks on the left (half size), and on the right what a guest's phone shows when
            they scan the QR code, in the look picked - so light vs dark is obvious (owner, 10/24). */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:gap-8">
          <div className="grid gap-3">
            <ChoiceCard on={!prefs.qrDark} onClick={() => setPref('qrDark', false)} title="Ivory" blurb="Light screen">
              <div className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#f3eee3] ring-1 ring-black/5"><Sun className="h-5 w-5 text-amber-500" /></div>
            </ChoiceCard>
            <ChoiceCard on={prefs.qrDark} onClick={() => setPref('qrDark', true)} title="Midnight" blurb="Dark screen">
              <div className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218]"><Moon className="h-5 w-5 text-[#e8c97a]" /></div>
            </ChoiceCard>
          </div>
          <div className="flex flex-col items-center">
            <SignInPhone dark={prefs.qrDark} photo="/home.jpg" street="123 Your Listing Ln" />
            <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">📱 Guest sign-in<br /><span className="text-[#8b6a2b] dark:text-[#e8c97a]">{prefs.qrDark ? 'Midnight' : 'Ivory'}</span></p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <BigToggle on={prefs.flyerBrand} onChange={v => setPref('flyerBrand', v)} title="My photo and name on the sign-in flyer" blurb="A small card with your photo, name and brokerage over the home's photo." />
          {mls && <BigToggle on={prefs.matchScore} onChange={v => setPref('matchScore', v)} title='"% match" on Similar Homes' blurb="Shows how close each home is to the one they're standing in." />}
          {mls && <BigToggle on={prefs.recap} onChange={v => setPref('recap', v)} title="Short highlights on the Cheat Sheet" blurb="An easy-to-read summary of the home instead of the full MLS description." />}
          {brag && <BigToggle on={prefs.bragStats} onChange={v => setPref('bragStats', v)} title="My sales numbers on the Brag Sheet" blurb="Homes sold, total volume and average price." />}
        </div>
        <p className="mt-3 text-[13px] font-medium text-gray-500 dark:text-gray-400">Saved to your account - every computer and phone you sign in on starts new kits this way.</p>
      </div>
  )

  return <MiniFlow flow={flow} pages={hasGuests ? [guestsPage, kitPage] : [kitPage]} />
}
