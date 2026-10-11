// Visit context sent with a form's progress pings (forms_service.record_form_progress) - where
// the visitor came from and on what device, recorded once per visit. Powers the Sources/Devices
// breakdowns on a form's Stats tab (e.g. how many opened it from a mailer's QR code).

export type FormVisitContext = { source: 'qr' | 'link' | 'website'; device: 'mobile' | 'tablet' | 'desktop'; referrer: string | null }

export function formVisitContext(onWebsite = false): FormVisitContext {
  if (typeof window === 'undefined') return { source: onWebsite ? 'website' : 'link', device: 'desktop', referrer: null }
  const params = new URLSearchParams(window.location.search)
  // Every QR we print adds ?src=qr (FormQrCode); a campaign QR carries it too.
  const fromQr = params.get('src') === 'qr' || params.get('utm_medium') === 'qr'
  const ua = navigator.userAgent || ''
  const tablet = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const mobile = !tablet && /Mobi|iPhone|Android/i.test(ua)
  let referrer: string | null = null
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '')
      if (host && host !== window.location.hostname.replace(/^www\./, '')) referrer = host
    }
  } catch { /* ignore */ }
  return { source: fromQr ? 'qr' : onWebsite ? 'website' : 'link', device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', referrer }
}
