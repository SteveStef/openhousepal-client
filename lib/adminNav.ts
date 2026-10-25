import {
  Activity, AlertOctagon, BarChart3, Building2, ClipboardSignature, Cpu, FileSearch, FlaskConical, HardDrive, HelpCircle, Inbox,
  LayoutDashboard, LifeBuoy, Mail, MailWarning, MousePointerClick, Layout, Receipt, Ticket, Users, Wallet, Workflow, Wrench, Gauge,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// The admin account's menu - one source for the top bar (Header) and the admin pages (AdminShell).
// Each section is its own page at /admin/<section>, with its tabs at /admin/<section>/<tab>.

type Icon = LucideIcon

export type AdminTab = { key: string; label: string; icon: Icon; blurb: string }
export type AdminSection = { key: string; label: string; icon: Icon; title: string; subtitle: string; tabs: AdminTab[] }

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'overview', label: 'Overview', icon: LayoutDashboard, title: 'Run OpenHousePal.', subtitle: 'Everything that needs you, at a glance.',
    tabs: [{ key: 'overview', label: 'Overview', icon: LayoutDashboard, blurb: 'Everything that needs you, at a glance.' }],
  },
  {
    key: 'people', label: 'People', icon: Users, title: 'Agents & deals.', subtitle: 'Approve agents, change plans, brokerage deals and sign-up codes.',
    tabs: [
      { key: 'agents', label: 'Agents', icon: Users, blurb: 'Approve agents, change plans and see how each one pays.' },
      { key: 'groups', label: 'Brokerage groups', icon: Building2, blurb: 'Custom deals where a brokerage pays for its agents.' },
      { key: 'codes', label: 'Codes', icon: Ticket, blurb: 'Sign-up codes for teams and deals - a special PayPal plan, or billed by you.' },
      { key: 'activity', label: 'Agent activity', icon: Activity, blurb: 'What every agent uses, how often, and whether it works for them.' },
    ],
  },
  {
    key: 'insights', label: 'Insights', icon: BarChart3, title: 'How the site is used.', subtitle: 'What agents and their guests actually do - so we know what to make better.',
    tabs: [
      { key: 'summary', label: 'Summary', icon: Gauge, blurb: 'Agents in the app, sign-ups and the big numbers.' },
      { key: 'signins', label: 'Sign-ins & forms', icon: ClipboardSignature, blurb: 'Open house sign-ins - how many, how long they take, how many finish.' },
      { key: 'showcases', label: 'Showcases', icon: Layout, blurb: 'How many are made, how many clients open, and how many are in use now.' },
      { key: 'emails', label: 'Emails', icon: Mail, blurb: 'Every email sent - opened, clicked, bounced.' },
      { key: 'emailhealth', label: 'Email health', icon: MailWarning, blurb: 'Pick a day or a range - who got what, what gets opened, what is repetitive, agent by agent.' },
      { key: 'tools', label: 'Agent tools', icon: Wrench, blurb: 'Which tools agents use, and how much - agent by agent.' },
      { key: 'guests', label: 'Guests', icon: MousePointerClick, blurb: 'What agents\' guests and clients do - visits, likes, tours, leads.' },
    ],
  },
  {
    key: 'inbox', label: 'Inbox', icon: Inbox, title: 'Messages.', subtitle: 'Support tickets from agents and questions from the public site.',
    tabs: [
      { key: 'support', label: 'Support', icon: LifeBuoy, blurb: 'Messages from agents.' },
      { key: 'questions', label: 'Questions', icon: HelpCircle, blurb: 'Questions from the public site.' },
    ],
  },
  {
    key: 'costs', label: 'Costs', icon: Receipt, title: 'Costs & health.', subtitle: 'What we spend, and anything that failed for an agent.',
    tabs: [
      { key: 'failures', label: 'Recent failures', icon: AlertOctagon, blurb: 'Anything that failed for an agent - who, which feature, when, and the error.' },
      { key: 'ai', label: 'AI usage & cost', icon: Cpu, blurb: 'AI spend by agent and feature, and the spending limits.' },
      { key: 'providers', label: 'Provider billing', icon: Wallet, blurb: 'Balances with the services we pay for.' },
      { key: 'storage', label: 'Storage', icon: HardDrive, blurb: 'How much each agent is storing.' },
    ],
  },
  {
    key: 'tools', label: 'Tools', icon: Wrench, title: 'Admin tools.', subtitle: 'CMA lookup, the CMA accuracy test and how each feature works.',
    tabs: [
      { key: 'cma', label: 'CMA lookup', icon: FileSearch, blurb: 'Find any CMA by its code.' },
      { key: 'cmatest', label: 'CMA accuracy test', icon: FlaskConical, blurb: 'Re-run real past sales through the CMA and score it against what they sold for.' },
      { key: 'flows', label: 'Feature flows', icon: Workflow, blurb: 'How each feature works, step by step.' },
    ],
  },
]

export const adminSection = (key?: string | null) => ADMIN_SECTIONS.find(s => s.key === key)

/** Where a tab lives: '/admin', '/admin/people' (first tab) or '/admin/people/groups'. */
export function adminHref(tabKey: string): string {
  for (const s of ADMIN_SECTIONS) {
    const i = s.tabs.findIndex(t => t.key === tabKey)
    if (i < 0) continue
    if (s.key === 'overview') return '/admin'
    return i === 0 ? `/admin/${s.key}` : `/admin/${s.key}/${tabKey}`
  }
  return '/admin'
}

/** The section + tab an /admin path points at (unknown -> the section's first tab). */
export function adminLocation(sectionKey?: string | null, tabKey?: string | null): { section: AdminSection; tab: AdminTab } {
  const section = adminSection(sectionKey) || ADMIN_SECTIONS[0]
  return { section, tab: section.tabs.find(t => t.key === tabKey) || section.tabs[0] }
}
