import './site-theme.css'
import { siteFontVariables } from '@/lib/site-fonts'

// No imports from AuthContext/ToastContext/AppHeader/AssistantWidget - nothing under
// (sitepublic) ships dashboard JS or makes dashboard-only network calls. Next.js still nests
// this inside the mandatory root layout (frontend/app/layout.tsx), which sets the Inter font +
// cream/dark body background for the dashboard - the .ohp-site wrapper below overrides both
// (background, font-family) for everything rendered under this route group, and carries the
// Playfair Display/DM Sans CSS variables that fontClass.ts's classes consume (see
// site-theme.css). The same font-variable wrapper is applied to the Studio editor's live
// preview in WebsiteEditorShell.tsx so what an agent sees while editing matches what visitors
// see once published.
export default function SitePublicLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${siteFontVariables} ohp-site min-h-screen`}>{children}</div>
}
