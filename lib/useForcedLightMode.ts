'use client'

import { useEffect } from 'react'

export function useForcedLightMode(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlColorScheme: html.style.colorScheme,
      bodyColorScheme: body.style.colorScheme,
    }

    html.classList.remove('dark')
    body.classList.remove('dark')
    html.dataset.ohpForcedLight = 'true'
    body.dataset.ohpForcedLight = 'true'
    html.style.colorScheme = 'light'
    body.style.colorScheme = 'light'

    return () => {
      delete html.dataset.ohpForcedLight
      delete body.dataset.ohpForcedLight
      html.style.colorScheme = previous.htmlColorScheme
      body.style.colorScheme = previous.bodyColorScheme
    }
  }, [enabled])
}
