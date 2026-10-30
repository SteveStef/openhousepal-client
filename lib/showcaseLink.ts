import { isPropertyAvailableStatus } from '@/lib/utils'

// The path of a client's Showcase link: the short personal one (/showcase/dana-k7q2) when it has a
// code, otherwise the long /showcase/<token> (both work). Backend: services/showcase_links.py.
export function showcaseLinkPath(c: { shortCode?: string | null; shareToken?: string | null }): string {
  return `/showcase/${c.shortCode || c.shareToken}`
}

// '732 Buck Ln' -> '732-buck-ln': the end of a one-home link (/showcase/dana-k7q2/732-buck-ln).
// Must match home_slug() in the backend's showcase_links.py.
export function homeSlug(street?: string | null): string {
  return (street || '').split(',')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

// How many homes a client's Showcase holds, the way their page counts them ("12 homes - Match
// right now": for sale and not passed on). Over SHOWN_MAX it reads "20+ homes" (owner, 10/30) -
// used by the one-home link preview and the line Send adds after the agent's message.
const SHOWN_MAX = 20
export function showcaseHomeCount(homes: { disliked?: boolean | null; MlsStatus?: string | null }[] | null | undefined): number {
  return (homes || []).filter(p => !p.disliked && isPropertyAvailableStatus(p.MlsStatus)).length
}
export function showcaseHomesLabel(n: number): string {
  return n > SHOWN_MAX ? `${SHOWN_MAX}+ homes` : `${n} ${n === 1 ? 'home' : 'homes'}`
}
/** The one-home preview's pill (owner, 10/30): the other homes waiting in the Showcase -
 *  "+2 More Inside", "20+ More Inside"; '' when this is the only one. */
export function showcaseMoreLabel(n: number): string {
  const more = n - 1
  if (more < 1) return ''
  return more > SHOWN_MAX ? `${SHOWN_MAX}+ More Inside` : `+${more} More Inside`
}
