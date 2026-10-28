'use client'

// Every lead button on the IDX website ("What's my home worth?", "Start my home search", "Book a
// consultation", a home's "Request a tour"...) opens one of the agent's real forms in a window
// over the page - visitors never leave the site or get a new tab.
//
// Any element can ask for one, server- or client-rendered, with plain attributes:
//   <a href="/contact" data-ohp-form="home_value" data-ohp-form-title="Home value"
//      data-ohp-prefill='{"property_of_interest":"12 Main St"}'>
// The href is the no-JavaScript fallback. Form types are the agent's form_type values (buying,
// selling, home_value, showing, how_can_i_help, showcase_request, make_me_sell,
// buyer_onboarding, seller_onboarding); a type the agent doesn't have falls back to their general
// "How can I help" form, then their first form, then the link itself.
import { useCallback, useEffect, useState } from 'react'
import FormWindow from '@/components/forms/FormWindow'
import SaveSearchWindow, { type SavedSearch } from './SaveSearchWindow'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'

export interface SiteFormRef { slug: string; title: string; form_type: string }

export const FORM_FALLBACK_ORDER = ['how_can_i_help', 'buying', 'selling']

export function pickSiteForm(forms: SiteFormRef[], type: string): SiteFormRef | null {
  return forms.find(f => f.form_type === type)
    || FORM_FALLBACK_ORDER.map(t => forms.find(f => f.form_type === t)).find(Boolean)
    || forms[0]
    || null
}

// siteId: "Save this search" and the hearts (data-ohp-criteria = the search as JSON) open the short
// SaveSearchWindow instead of the full Showcase form - same Showcase form underneath.
export default function SiteFormLauncher({ forms, hubSlug, siteId }: { forms: SiteFormRef[]; hubSlug?: string | null; siteId?: string }) {
  const [open, setOpen] = useState<{ url: string; title: string; prefill?: Record<string, string> } | null>(null)
  const [saved, setSaved] = useState<SavedSearch | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const closeSaved = useCallback(() => setSaved(null), [])

  useEffect(() => {
    if (!hubSlug || !forms.length) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const el = (e.target as HTMLElement | null)?.closest?.('[data-ohp-form]') as HTMLElement | null
      if (!el) return
      if (siteId && el.dataset.ohpCriteria && forms.some(f => f.form_type === 'showcase_request')) {
        try {
          const criteria = JSON.parse(el.dataset.ohpCriteria) as SavedSearch
          e.preventDefault(); e.stopPropagation()
          setSaved(criteria)
          return
        } catch { /* fall through to the full form */ }
      }
      // A section can ask for one exact form (data-ohp-form-slug - the Lead Form section), else a kind.
      const form = (el.dataset.ohpFormSlug && forms.find(f => f.slug === el.dataset.ohpFormSlug)) || pickSiteForm(forms, el.dataset.ohpForm || '')
      if (!form) return
      e.preventDefault()
      // A form button inside a clickable card (a home card's "Ask") must not also open the card.
      e.stopPropagation()
      let prefill: Record<string, string> | undefined
      try { prefill = el.dataset.ohpPrefill ? JSON.parse(el.dataset.ohpPrefill) : undefined } catch { prefill = undefined }
      setOpen({ url: openHousePalPublicUrl(`/${hubSlug}/${form.slug}`), title: el.dataset.ohpFormTitle || form.title, prefill })
    }
    // Capture phase: runs before a link navigates, and before any card's own click handler.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [forms, hubSlug, siteId])

  return (
    <>
      <FormWindow url={open?.url || null} title={open?.title} prefill={open?.prefill} onClose={close} />
      {siteId && <SaveSearchWindow siteId={siteId} criteria={saved} onClose={closeSaved} />}
    </>
  )
}
