'use client'

import { useEffect } from 'react'

// Keeps the CMA section (list, Create window, builder, every sheet) from zooming in on a phone
// (user, 10/20: "tapping Continue makes the browser zoom in"). Two layers:
//  1. `cma-touch` on <body> while a CMA page is open, so the globals.css rule reaches EVERY text box,
//     including ones in windows portaled to <body> (the Create window's Client Name box was 14px
//     and outside the builder - focusing it zoomed the page, and the zoom carried into the builder).
//  2. iPhone / iPad only: `maximum-scale=1` on the viewport while here. Safari then never auto-zooms
//     into a focused box, but still lets people pinch-zoom (iOS ignores maximum-scale for pinches),
//     so nothing is taken away. Android is left alone - there maximum-scale would block pinch-zoom.
// Both are undone when the agent leaves the CMA section.
export default function CmaZoomGuard() {
  useEffect(() => {
    document.body.classList.add('cma-touch')
    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const original = meta?.getAttribute('content') ?? null
    if (isIos && meta && original && !/maximum-scale/.test(original)) {
      meta.setAttribute('content', `${original}, maximum-scale=1`)
    }
    return () => {
      document.body.classList.remove('cma-touch')
      if (meta && original != null) meta.setAttribute('content', original)
    }
  }, [])
  return null
}
