// Change the address bar without a page load, in a way Next.js keeps.
//
// Next.js 16 patches window.history.replaceState: when the state handed in already carries its own
// marker (__NA / _N - i.e. someone passed window.history.state straight back), it assumes the call
// is its own and does NOT copy the new address into its router. Its router then still holds the old
// address and writes it back the next time it re-syncs (any router update), so a lead that was just
// opened dropped off the address, or the email marker (?ce=) reappeared in a link a client copies
// (deep audit, 11/18). Passing only the page's own keys lets Next add its keys and keep the address.
export function replaceAddress(url: string) {
  const cur = window.history.state
  const own: Record<string, unknown> = {}
  if (cur && typeof cur === 'object') {
    for (const [k, v] of Object.entries(cur)) if (!k.startsWith('__') && k !== '_N') own[k] = v
  }
  window.history.replaceState(Object.keys(own).length ? own : null, '', url)
}
