'use client'

import { useEffect, useState } from 'react'
import { resolveMediaUrl } from '@/lib/api-service'

// The IDX site's one loading mark, used everywhere something loads (quick look, map search,
// forms...). The agent's monogram - first + last initial - sits inside a slowly turning accent
// ring with a light sweep across the letters; or, when the agent uploaded a loading logo
// (Design tab -> Loading mark), that logo instead. Colors come from the site's own theme
// variables, so it fits Classic/Luxe and light/dark without any props. The initials and logo are
// read from the page's root (#ohp-site-shell data-ohp-initials / data-ohp-loader-logo, set by
// SiteShell on the server), so no component has to pass the agent down.
export function useSiteMark() {
  const [mark, setMark] = useState<{ initials: string; logo: string | null }>({ initials: '', logo: null })
  useEffect(() => {
    const el = document.getElementById('ohp-site-shell')
    if (!el) return
    setMark({ initials: el.dataset.ohpInitials || '', logo: el.dataset.ohpLoaderLogo || null })
  }, [])
  return mark
}

export default function SiteLoader({ label, size = 'md', className = '', mark }: {
  label?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string
  /** Outside a real site page (the website editor's preview) there's no #ohp-site-shell to read. */
  mark?: { initials: string; logo: string | null }
}) {
  const fromPage = useSiteMark()
  const { initials, logo } = mark || fromPage
  const [logoOk, setLogoOk] = useState(true)
  const px = size === 'lg' ? 132 : size === 'sm' ? 64 : 104
  return (
    <div className={`ohp-loader flex flex-col items-center justify-center gap-5 ${className}`} role="status" aria-live="polite" style={{ ['--ohp-loader-size' as any]: `${px}px` }}>
      <div className="ohp-loader-mark">
        <span className="ohp-loader-glow" />
        <span className="ohp-loader-ring" />
        <span className="ohp-loader-ring ohp-loader-ring-2" />
        <span className="ohp-loader-core">
          {logo && logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(logo) || logo} alt="" onError={() => setLogoOk(false)} className="ohp-loader-logo" />
          ) : (
            <span className="ohp-loader-initials ohp-site-heading">{initials || <span className="ohp-loader-dot" />}</span>
          )}
        </span>
      </div>
      {label !== null && (
        <p className="ohp-loader-label">{label || 'Loading'}<span className="ohp-loader-ellipsis"><i>.</i><i>.</i><i>.</i></span></p>
      )}
    </div>
  )
}
