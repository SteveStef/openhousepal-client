import '@/app/(sitepublic)/site-theme.css'
import { siteFontVariables } from '@/lib/site-fonts'

// The admin's town page preview draws the real IDX town page, so it gets the public site's own
// stylesheet and fonts - the same wrapper as app/(sitepublic)/layout.tsx. proxy.ts marks these
// requests like a public site page, so the root layout leaves the dashboard header off.
export default function TownPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${siteFontVariables} ohp-site min-h-screen`}>{children}</div>
}
