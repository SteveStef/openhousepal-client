import { hasAgentHubAccess, hasEmailSignatureAccess, hasStudioDesignAccess, meetsTier } from '@/lib/navAccess'

// Where each premade form shows up across the product - read off the code that opens it (IDX
// SiteChrome / HeroBlock / ContactPageView / TownPage / HomeCard..., the Agent Hub app/[slug],
// lib/signatureConfig, blogs ClosingCta, studio designs). Shown at the top of the form editor so an
// agent changing a default form sees everywhere the change lands (user, 10/27). Plan-aware: only
// the places the agent's plan has. Keep in step when a new button starts opening a form.
export interface FormPlacement { where: string; what: string }

type Area = 'idx' | 'hub' | 'signature' | 'blogs' | 'designs' | 'qr'
const ALLOWED: Record<Area, (plan?: string | null) => boolean> = {
  idx: plan => meetsTier(plan, 'IDX'),
  blogs: plan => meetsTier(plan, 'IDX'),
  hub: plan => hasAgentHubAccess(plan),
  signature: plan => hasEmailSignatureAccess(plan),
  designs: plan => hasStudioDesignAccess(plan),
  qr: () => true,
}

const P: Record<string, [Area, string, string][]> = {
  how_can_i_help: [
    ['idx', 'Your website', 'The "Let\'s talk" button in the menu and the main form on your Contact page'],
    ['idx', 'Your website', '"Ask about this home" on every home card, "Ask about [town]" on town pages, "Talk financing" in the payment calculator and "Get in touch" on your Reviews page'],
    ['idx', 'Your website', 'Any Lead Form section you added to a page'],
    ['idx', 'Your website', 'Any button whose own form you don\'t have (it falls back to this one)'],
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['blogs', 'Your articles', 'The "Ready to buy or sell?" button at the end of an article'],
    ['designs', 'Studio designs', 'QR codes on flyers and posts that link to this form'],
  ],
  buying: [
    ['hub', 'Agent Hub', 'The "I\'m Buying" button on your Agent Hub and your Sales page'],
    ['idx', 'Your website', '"Find a home" in the phone menu and footer, "Buying" on your Welcome Screen, "I\'m buying" on your Contact page and "Buying in [town]" on town pages'],
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['designs', 'Studio designs', 'QR codes on flyers and posts that link to this form'],
  ],
  selling: [
    ['hub', 'Agent Hub', 'The "I\'m Selling" button on your Agent Hub and your Sales page'],
    ['idx', 'Your website', '"Sell my home" in the phone menu and footer, "Selling" on your Welcome Screen, "I\'m selling" on your Contact page and "Selling in [town]" on town pages'],
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['designs', 'Studio designs', 'QR codes on flyers and posts that link to this form'],
  ],
  home_value: [
    ['hub', 'Agent Hub', 'The "What\'s My Home Worth?" button on your Agent Hub'],
    ['idx', 'Your website', '"What\'s my home worth?" on your Welcome Screen, in the footer, on your Contact page, your Home Value page and "What\'s my [town] home worth?" on town pages'],
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['blogs', 'Your articles', 'The "What\'s my home worth?" button at the end of an article'],
    ['designs', 'Studio designs', 'QR codes on flyers and posts that link to this form'],
  ],
  showing: [
    ['hub', 'Agent Hub', 'The "Schedule a Showing" button on your Agent Hub and your Sales page'],
    ['idx', 'Your website', '"Book a showing" in the phone menu, the footer and on your Contact page'],
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['blogs', 'Your articles', 'The "See a home in person" button at the end of an article'],
    ['designs', 'Studio designs', 'QR codes on flyers and posts that link to this form'],
  ],
  showcase_request: [
    ['qr', 'Open houses', 'The "Set up my own Showcase" QR code guests scan at your open houses'],
    ['idx', 'Your website', '"Create my free Showcase" on your home page and footer, the hearts ("Get homes like this first") on home cards, "Save this search" on Search and "Get new homes first" on your Contact page'],
  ],
  make_me_sell: [
    ['signature', 'Email signature', 'The button in your signature, if you added it'],
    ['designs', 'Studio designs', 'QR codes on mailers, flyers and posts that link to this form'],
  ],
}

/** Everywhere this kind of form is used, for this plan. Empty for custom forms. */
export function formPlacements(formType: string | null | undefined, planTier?: string | null): FormPlacement[] {
  return (P[formType || ''] || []).filter(([area]) => ALLOWED[area](planTier)).map(([, where, what]) => ({ where, what }))
}
