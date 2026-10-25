// How many homes a Showcase holds (owner, 10/24) - mirrors backend app/services/showcase_limit.py.
// A search that matches more keeps the best 100 (closest for a distance search) and every screen
// says "100+" instead of a number, with a note to tighten the search.
export const SHOWCASE_MAX_HOMES = 100

/** "100+" when the Showcase (or a preview) is at the limit, else the number. */
export function homesLabel(count: number | null | undefined, atLimit?: boolean | null): string {
  if (atLimit || (count ?? 0) > SHOWCASE_MAX_HOMES) return `${SHOWCASE_MAX_HOMES}+`
  return (count ?? 0).toLocaleString()
}

export const SHOWCASE_LIMIT_NOTE = `${SHOWCASE_MAX_HOMES}+ homes match - that's the most a Showcase holds. Tighten the search (price, beds, towns or the map area) so the right homes make the cut.`
