// The Email Signature's saved-config rules, in one place: the defaults, how a saved config is read
// back (mergeSignatureConfig), the button rules, the fonts, and the preview wrappers. The Studio
// editor (app/studio/email-signature) and the setup flow's Signature step both use these, so a
// signature made in either place follows exactly the same rules and looks exactly the same.

import { metalOf, LUXE_METALS, type LuxeMetal } from '@/lib/luxeMetals'
import { SIGNATURE_FONT_OPTIONS, signatureFontStack, socialUrlsFrom } from '@/lib/signatureSiteData'

export type SignatureField = { include: boolean; value?: string; label?: string }
export type SignatureFields = Record<string, SignatureField>
// A button either links to one of the agent's own premade forms (formType set - the URL is
// derived, never typed) or is a fully custom link (formType omitted, url/label freeform).
export type CtaButton = { id: string; label: string; formType?: string; url: string; enabled: boolean }

// Default label + display order for the premade-form quick-add chips - every form type Studio >
// Forms actually surfaces (CAMPAIGN_ELIGIBLE_FORM_TYPES on the backend: everything except the
// aesthetics-only showcase_request and the two restricted onboarding forms). "Ready to Buy or
// Sell?" is this product's own framing of the how_can_i_help form (a single intake form with
// branching buy/sell questions) - not that form's stored title, which is the more generic "How
// Can We Help".
export const FORM_BUTTON_DEFAULTS: Record<string, string> = {
  how_can_i_help: 'Ready to Buy or Sell?',
  home_value: "What's My Home Worth?",
  showing: 'Schedule a Showing',
  buying: "I'm Buying",
  selling: "I'm Selling",
  make_me_sell: 'Make Me Sell',
}
export const FORM_BUTTON_ORDER = ['how_can_i_help', 'home_value', 'showing', 'buying', 'selling', 'make_me_sell']
// The two buttons a brand-new signature starts with (when the agent has those forms).
export const SEED_BUTTON_TYPES = ['how_can_i_help', 'home_value']
// "My Agent Hub" always leads (auto-included, not stored in ctaButtons), so this caps the
// agent-chosen extras at 2 - together that's 3 pills, which is what actually fits on one line
// before wrapping.
export const MAX_CTA_BUTTONS = 2

export type SignatureConfig = {
  template: string
  fields: SignatureFields
  ctaButtons: CtaButton[]
  blockVisibility: { banner: boolean }
  banner: { showFeaturedListing: boolean; showRecentSales: boolean; showStats: boolean }
  accentColor: string
  fontFamily: string
  showVerifiedBadge: boolean
  // Whole-signature dark theme - flips every raster asset AND the install HTML's own table
  // colors (see _theme_colors/theme_card_bg in email_signature_service.py). Read fresh from this
  // same saved config by every asset endpoint on every fetch, so toggling it applies to an
  // already-installed signature automatically - no re-copy-paste, same as a listing/sale change.
  darkMode: boolean
  // OpenHousePal Luxe - the premade theme (gold, serif, ivory/midnight light, the Spotlight
  // header's look). On: the accent/font pickers step aside. Off: the regular editor.
  luxe: boolean
  /** Luxe finish - the same Luxe look in gold (default), silver or bronze. */
  luxeMetal: LuxeMetal
  /** The socials from Agent Hub were switched on once (seedSignatureSocials) - later choices stick. */
  socialsSeeded?: boolean
}

// What Luxe locks in - the backend's resolve_signature_config applies the same two values.
export const luxeAccentFor = (metal: LuxeMetal) => LUXE_METALS[metal].base
export const LUXE_FONT = 'georgia'
export const DEFAULT_ACCENT = '#B87943'

export const DEFAULT_SIGNATURE_CONFIG: SignatureConfig = {
  template: 'gallery',
  fields: {
    headshot: { include: true },
    name: { include: true },
    title: { include: true },
    company: { include: true },
    team: { include: false, value: '' },
    phone: { include: true },
    email: { include: true },
    website: { include: true },
    agentHubUrl: { include: true },
    // Matches Agent Hub's own social platform set exactly (Studio > Site's Social Links editor)
    // - no LinkedIn, since Agent Hub doesn't manage one and typing it in here separately would
    // be exactly the duplicate-data-entry problem this feature exists to avoid.
    instagram: { include: false },
    facebook: { include: false },
    youtube: { include: false },
    tiktok: { include: false },
  },
  ctaButtons: [],
  // Listings & sales and stats both start on (user, 10/15) - each shows only once there's
  // something behind it, and each has its own switch.
  blockVisibility: { banner: true },
  banner: { showFeaturedListing: true, showRecentSales: true, showStats: true },
  accentColor: DEFAULT_ACCENT,
  fontFamily: 'system',
  showVerifiedBadge: true,
  darkMode: false,
  luxe: false,
  luxeMetal: 'gold',
}

// Email-safe stacks only (every one of these is preinstalled on Windows/Mac/mobile, so Gmail/
// Outlook/Apple Mail render it directly - no @font-face, which every major email client strips
// anyway). The id is what's saved/sent to the backend; the backend owns the identical id->stack
// map for the install HTML (see FONT_STACKS in email_signature_service.py).
export const FONT_OPTIONS = SIGNATURE_FONT_OPTIONS
export const fontStackFor = signatureFontStack

export function mergeSignatureConfig(saved: any): SignatureConfig {
  const fields: SignatureFields = {}
  for (const key of Object.keys(DEFAULT_SIGNATURE_CONFIG.fields)) {
    fields[key] = { ...DEFAULT_SIGNATURE_CONFIG.fields[key], ...(saved?.fields?.[key] || {}) }
  }
  // Only form-linked buttons are editable now (see the Buttons tab) - a button saved before that
  // change with no formType (a free-text custom link) has nothing valid to show in the picker, so
  // it's dropped here rather than displayed as a mislabeled/blank row. It still worked fine as a
  // link right up until this load (the install HTML's own fallback for a bare `url` still exists),
  // this only affects what's editable going forward.
  const rawButtons: CtaButton[] = Array.isArray(saved?.ctaButtons) ? saved.ctaButtons : []
  const ctaButtons = rawButtons.filter(b => b && b.formType).slice(0, MAX_CTA_BUTTONS)
  return {
    template: saved?.template || DEFAULT_SIGNATURE_CONFIG.template,
    fields,
    ctaButtons,
    blockVisibility: { ...DEFAULT_SIGNATURE_CONFIG.blockVisibility, ...(saved?.blockVisibility || {}) },
    banner: { ...DEFAULT_SIGNATURE_CONFIG.banner, ...(saved?.banner || {}) },
    accentColor: saved?.accentColor || DEFAULT_SIGNATURE_CONFIG.accentColor,
    fontFamily: saved?.fontFamily || DEFAULT_SIGNATURE_CONFIG.fontFamily,
    showVerifiedBadge: Boolean(saved?.showVerifiedBadge),
    darkMode: Boolean(saved?.darkMode),
    luxe: Boolean(saved?.luxe),
    luxeMetal: metalOf(saved?.luxeMetal),
    socialsSeeded: Boolean(saved?.socialsSeeded),
  }
}

/** First time only: every social the agent already added (Agent Hub / setup's "Your socials")
 *  goes on the signature too, like the Agent Hub shows them - null when nothing changes. After
 *  this, whatever they switch off stays off. */
export function seedSignatureSocials(config: SignatureConfig, hubConfig: any): SignatureConfig | null {
  if (config.socialsSeeded) return null
  const urls = socialUrlsFrom(hubConfig)
  const fields = { ...config.fields }
  for (const net of ['website', 'instagram', 'facebook', 'youtube', 'tiktok']) {
    if (urls[net]) fields[net] = { ...fields[net], include: true }
  }
  return { ...config, fields, socialsSeeded: true }
}

/** The smart starting buttons for a signature with none yet: the two most useful premade forms. */
export function seedSignatureButtons(forms: { form_type: string; title: string }[]): CtaButton[] {
  return SEED_BUTTON_TYPES
    .map(formType => forms.find(f => f.form_type === formType))
    .filter((f): f is { form_type: string; title: string } => Boolean(f))
    .map(f => ({ id: `cta-${f.form_type}`, label: FORM_BUTTON_DEFAULTS[f.form_type] || f.title, formType: f.form_type, url: '', enabled: true }))
}

/** Fields switched on whose value has since gone (a social link or the Team name cleared in
 *  Settings) - they get switched off rather than showing something blank or going nowhere. */
export function staleSignatureFields(config: SignatureConfig, hubConfig: any): string[] {
  const socialUrls = socialUrlsFrom(hubConfig)
  const nets = ['website', 'instagram', 'facebook', 'youtube', 'tiktok'] as const
  const stale: string[] = nets.filter(net => config.fields[net]?.include && !socialUrls[net])
  if (config.fields.team?.include && !String(hubConfig?.profile?.team || '').trim()) stale.push('team')
  return stale
}

export function withoutFields(config: SignatureConfig, keys: string[]): SignatureConfig {
  if (!keys.length) return config
  const fields = { ...config.fields }
  for (const key of keys) fields[key] = { ...fields[key], include: false }
  return { ...config, fields }
}

// The photo/stats/listing/badge images the install HTML points at are served with a real
// Cache-Control: max-age=3600 (see email_signature_routes.py's _CACHE_HEADERS) - deliberate for a
// signature actually pasted into Gmail (that's what lets an already-installed one auto-update
// without a re-paste, while not re-fetching on every single open), but it means a preview re-fetch
// just re-fetches the HTML TEXT while the browser keeps serving its cached copy of each image. A
// cache-busting query param on just a preview's own image URLs (never in the HTML actually offered
// for copy-paste, which keeps its real caching) forces a genuine re-fetch.
export const bustImageCache = (html: string) => {
  const cb = Date.now()
  return html.replace(/(\/email-signature\/public\/[^"']+)(["'])/g, (_m, url: string, quote: string) => `${url}${url.includes('?') ? '&' : '?'}_cb=${cb}${quote}`)
}

// Wraps the bare install-HTML table (no <html>/<body> of its own - see build_signature_html) in
// a minimal zero-margin document that reports its real content height back to the page via
// postMessage ('signature-real-preview-height'), so the preview iframe sizes itself to the actual
// card. Preview-only wrapping - copying makes its own separate, unwrapped fetch.
export const wrapRealHtmlForPreview = (html: string) => `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}body{display:flex;justify-content:center;align-items:flex-start;padding:2px 0 26px;}</style></head>
<body>${html}
<script>
  function reportHeight() {
    var h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'signature-real-preview-height', height: h }, '*');
  }
  window.addEventListener('load', reportHeight);
  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.body);
  else setTimeout(reportHeight, 200);
</script>
</body></html>`
