import { siteModeStorageKey, siteThemeVars } from '@/lib/siteTheme'
import type { SiteTheme } from './types'
import { initialsOf } from './siteMark'

// The root of every public site page: puts the agent's accent/brand colors on as CSS variables
// and marks the look (data-template) and the light/dark mode (data-mode) that
// app/(sitepublic)/site-theme.css keys on. The visitor's own light/dark choice (the header's
// sun/moon button, kept in localStorage per site) is applied by the tiny inline script BEFORE
// the page paints, so a returning visitor never sees a flash of the other mode. Rendering here
// (not the route-group layout) because the theme only becomes known once the host resolves.
// agentName: its first + last initial become the site's loading mark (SiteLoader) unless the agent
// uploaded a loading logo (theme.loader_logo_url).
export default function SiteShell({ theme, siteKey, agentName, children }: { theme: SiteTheme; siteKey: string; agentName?: string | null; children: React.ReactNode }) {
  const vars = siteThemeVars(theme)
  const allowToggle = theme.allow_mode_toggle !== false
  const key = siteModeStorageKey(siteKey)
  return (
    <div id="ohp-site-shell" className="ohp-site min-h-screen" data-template={vars.template} data-mode={vars.mode} data-ohp-initials={initialsOf(agentName) || undefined} data-ohp-loader-logo={theme.loader_logo_url || undefined} style={vars.style} suppressHydrationWarning>
      {allowToggle && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem(${JSON.stringify(key)});if(m==='light'||m==='dark'){var el=document.currentScript&&document.currentScript.parentElement;if(el){el.setAttribute('data-mode',m)}}}catch(e){}})();`,
          }}
        />
      )}
      {children}
    </div>
  )
}
