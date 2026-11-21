import { notFound } from 'next/navigation'

// An old sample Agent Hub ("Sarah Johnson", a made-up agent) kept for local design work only. On the live site it
// said a real-looking agent page existed at /AgentHub/sarah-johnson (11/21 audit) - now page not found, like the
// other demo pages (app/dev-demos).
export default function SampleHubLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <>{children}</>
}
