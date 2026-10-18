// "Recent" sales wording (user rule, 10/18): an agent's sales are called RECENT only while the total
// volume of the sales shown is under $50M - for a smaller agent "recent" explains a modest count;
// past that, plain "Sales" reads truer. Same rule on the Agent Hub, the IDX website, the Brag Sheet
// and the email signature. Backend twin: app/services/sales_wording.py.
export const RECENT_SALES_VOLUME_CAP = 50_000_000

export function salesAreRecent(totalVolume: number | null | undefined): boolean {
  return (totalVolume || 0) < RECENT_SALES_VOLUME_CAP
}

const DROP_RECENT: Record<string, string> = {
  'My Recent Sales': 'My Sales',
  'Recent Sales': 'Sales',
  'Recent Sales Figures': 'Sales Figures',
  'Recently Sold': 'Sold',
  'Recently sold': 'Sold',
  'Recent sale': 'Sold',
  'RECENT SALE': 'SOLD',
  'RECENTLY SOLD': 'SOLD',
}

/** `text` as written while the sales count as recent, without "recent" once they don't. */
export function salesWords(text: string, recent: boolean): string {
  return recent ? text : DROP_RECENT[text] ?? text
}
