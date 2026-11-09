// Something changed from the chat (a card confirmed, a Showcase home starred / removed, a follow-up added)
// - the page behind it updates right away instead of on its next poll (owner, 11/09: "all features should be
// communicating with each other and auto updating, so everything looks the same in its different places").
// The Dash and the header badges already listen for the first two; Showcases listens for the third.
export const DATA_CHANGED_EVENT = 'ohp:data-changed'

export function announceChange() {
  if (typeof window === 'undefined') return
  for (const name of ['leads-notification-count:refresh', 'openhouse-action-counts:refresh', DATA_CHANGED_EVENT]) {
    window.dispatchEvent(new Event(name))
  }
}
