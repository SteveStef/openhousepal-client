'use client'

import { ReactNode, useEffect } from 'react'

export default function HomeScrollEffects({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('ohp-home-snap-active')

    const observedSections = new Set<HTMLElement>()
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('ohp-section-visible')
        })
      },
      { threshold: 0.18, rootMargin: '0px 0px -12% 0px' },
    )
    const observeSections = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('.ohp-home-scroll-section'))
      sections.forEach(section => {
        if (observedSections.has(section)) return
        observedSections.add(section)
        section.classList.add('ohp-section-observed')
        observer.observe(section)
      })
    }

    observeSections()
    const mutationObserver = new MutationObserver(observeSections)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
      observedSections.forEach(section => {
        section.classList.remove('ohp-section-observed', 'ohp-section-visible')
      })
      document.documentElement.classList.remove('ohp-home-snap-active')
    }
  }, [enabled])

  return <>{children}</>
}
