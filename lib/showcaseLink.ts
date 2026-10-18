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
