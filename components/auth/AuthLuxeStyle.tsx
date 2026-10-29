import Link from 'next/link'
import { OhpWordmark } from '@/components/brand/OhpBrand'

// The homepage's luxe touches for the sign-in pages (Login, Create Account, Forgot / Reset
// Password): the shimmering gold serif italic, the slowly floating line-art icons, the gold edge on
// the form card and the gold sweep on the main button. Pure CSS - drop it once on the page.
export const AUTH_CSS = `
.ohp-home-em{font-style:italic;font-weight:300;background:linear-gradient(100deg,#8b6a2b 0%,#C9A24D 30%,#f1d58b 50%,#C9A24D 70%,#8b6a2b 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ohpHomeEm 7s ease-in-out infinite;padding-right:.06em}
.dark .ohp-home-em{background-image:linear-gradient(100deg,#C9A24D 0%,#e8c97a 30%,#fff3cf 50%,#e8c97a 70%,#C9A24D 100%)}
@keyframes ohpHomeEm{0%,100%{background-position:100% 0}50%{background-position:0% 0}}
.ohp-motif-float{animation:ohpMotifFloat 9s ease-in-out infinite}
@keyframes ohpMotifFloat{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -12px;rotate:-3deg}}
.ohp-auth-card{position:relative;border-color:rgba(201,162,77,.22)!important;box-shadow:0 30px 70px -40px rgba(139,115,85,.65)!important}
.ohp-auth-card::before{content:"";position:absolute;left:10%;right:10%;top:0;height:1px;background:linear-gradient(90deg,transparent,#C9A24D,transparent);opacity:.8}
.ohp-auth-btn{position:relative;overflow:hidden}
.ohp-auth-btn::after{content:"";position:absolute;inset:0;width:35%;transform:translateX(-120%) skewX(-12deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);animation:ohpAuthSweep 3.6s ease-in-out infinite}
@keyframes ohpAuthSweep{0%{transform:translateX(-120%) skewX(-12deg)}60%,100%{transform:translateX(320%) skewX(-12deg)}}
@media (prefers-reduced-motion:reduce){.ohp-home-em,.ohp-motif-float,.ohp-auth-btn::after{animation:none}}
`

export default function AuthLuxeStyle() {
  return <style>{AUTH_CSS}</style>
}

// The OpenHousePal logo - the same wordmark as the site header and footer.
export function GoldPal({ animate = false }: { animate?: boolean }) {
  return <OhpWordmark animate={animate} />
}

// The top bar on phones (under md) for the sign-in pages: the logo (links home) plus one action
// link (Sign in / Start here). Desktop keeps the split-screen layout with no bar. No backdrop blur
// (big blur layers lag on phones).
export function AuthPhoneHeader({ linkHref, linkLabel, prompt }: { linkHref: string; linkLabel: string; prompt?: string }) {
  return (
    <header className="md:hidden sticky top-0 z-40 shrink-0 border-b border-[#C9A24D]/15 dark:border-[#C9A24D]/10 bg-white dark:bg-[#0B0B0B] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="OpenHousePal home" className="flex min-w-0 items-center">
          <OhpWordmark animate className="text-[21px] text-[#111827] dark:text-white" />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {prompt && <span className="hidden min-[400px]:inline text-[11px] font-semibold text-[#6B7280] dark:text-gray-400">{prompt}</span>}
          <Link href={linkHref} className="rounded-full border border-[#111827]/15 dark:border-white/20 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white transition-colors hover:border-[#C9A24D] hover:text-[#C9A24D] active:border-[#C9A24D]">
            {linkLabel}
          </Link>
        </div>
      </div>
    </header>
  )
}

// The small gold label with hairlines above a heading.
export function AuthKicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 inline-flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]">
      <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#C9A24D]" />{children}<span className="h-px w-7 bg-gradient-to-l from-transparent to-[#C9A24D]" />
    </span>
  )
}
