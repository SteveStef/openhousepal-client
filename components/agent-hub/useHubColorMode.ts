'use client'

import { useEffect } from 'react'

// Agent Hub pages follow THE HUB'S own light/dark choice, never the OpenHousePal app's: the app's
// dark mode puts "dark" on <html> for this whole browser (same site), which turned a light hub
// dark for anyone who uses the app in dark mode (and in the setup preview frame). While a hub page
// is open its choice sits on <html>; the app's comes back when leaving. The app's theme provider
// sets <html> after page effects run, and again whenever it re-applies the theme - so keep watching
// and put the hub's choice back each time. `enabled` = false until the hub's config has loaded.
export default function useHubColorMode(dark: boolean, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    const had = root.classList.contains('dark')
    const prevScheme = root.style.colorScheme
    const apply = () => {
      if (root.classList.contains('dark') !== dark) root.classList.toggle('dark', dark)
      if (root.style.colorScheme !== (dark ? 'dark' : 'light')) root.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    const watch = new MutationObserver(apply)
    watch.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => { watch.disconnect(); root.classList.toggle('dark', had); root.style.colorScheme = prevScheme }
  }, [dark, enabled])
}
