// The path of a client's Showcase link: the short personal one (/s/dana-k7q2) when it has a code,
// otherwise the long /showcase/<token> (still works). Backend: services/showcase_links.py.
export function showcaseLinkPath(c: { shortCode?: string | null; shareToken?: string | null }): string {
  return c.shortCode ? `/s/${c.shortCode}` : `/showcase/${c.shareToken}`
}
