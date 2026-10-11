// Decorative line-art placed in a corner of each homepage section, behind the real content.
// Each one is a small themed composition tied to what that section is actually about (not a
// generic icon), built from a gradient-stroked outline plus solid accent dots for depth. Every
// shape draws itself in (stroke-dashoffset) the first time its section scrolls into view, reusing
// the same `seenSections` tracking that already drives the text reveals in app/page.tsx, so it
// only ever plays once.

interface MotifProps {
  visible: boolean
  className?: string
}

const shared = 'ohp-motif pointer-events-none select-none'
const gold = '#C9A24D'

// Small secondary accent badge (ring + one glyph) for the opposite corner of a section from its
// main composition - a second, quieter beat of the same style so each section reads as more than
// a single decoration without turning into a second competing centerpiece.
function badgeGradient(id: string) {
  return (
    <linearGradient id={id} x1="0" y1="100" x2="100" y2="0">
      <stop offset="0%" stopColor="#a9791f" />
      <stop offset="100%" stopColor="#f0d494" />
    </linearGradient>
  )
}

// House + an ascending trend line trailing off it - "less busywork, more business" made literal.
export function HouseMotif({ visible, className = '' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${shared} ${visible ? 'is-visible' : ''} ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id="ohpHeroGrad" x1="0" y1="200" x2="200" y2="0">
          <stop offset="0%" stopColor="#a9791f" />
          <stop offset="100%" stopColor="#f0d494" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity="0.05" stroke="none" />
      <path d="M22 118 L58 84 L94 118" stroke="url(#ohpHeroGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 108 V158 H84 V108" stroke="url(#ohpHeroGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '0.33s' }} />
      <path d="M50 158 V132 H66 V158" stroke="url(#ohpHeroGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '0.66s' }} />
      <path d="M100 150 L128 122 L148 136 L178 88" stroke="url(#ohpHeroGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '0.99s' }} />
      <circle cx="100" cy="150" r="4" fill={gold} stroke="none" style={{ transitionDelay: '1.10s' }} />
      <circle cx="128" cy="122" r="4" fill={gold} stroke="none" style={{ transitionDelay: '1.21s' }} />
      <circle cx="148" cy="136" r="4" fill={gold} stroke="none" style={{ transitionDelay: '1.32s' }} />
      <circle cx="178" cy="88" r="5.5" fill={gold} stroke="none" style={{ transitionDelay: '1.43s' }} />
    </svg>
  )
}

// A dashboard frame holding a QR glyph and a checklist - "one platform, every tool" (sign-in +
// forms are the two tools every agent touches first), instead of an abstract blueprint.
export function BlueprintMotif({ visible, className = '' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${shared} ${visible ? 'is-visible' : ''} ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id="ohpToolsGrad" x1="0" y1="200" x2="200" y2="0">
          <stop offset="0%" stopColor="#a9791f" />
          <stop offset="100%" stopColor="#f0d494" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity="0.05" stroke="none" />
      <rect x="20" y="35" width="160" height="130" rx="10" stroke="url(#ohpToolsGrad)" strokeWidth="4" />
      <path d="M20 60 H180" stroke="url(#ohpToolsGrad)" strokeWidth="3" style={{ transitionDelay: '0.33s' }} />
      <circle cx="35" cy="47" r="3.5" fill={gold} stroke="none" />
      <circle cx="47" cy="47" r="3.5" fill={gold} stroke="none" />
      <circle cx="59" cy="47" r="3.5" fill={gold} stroke="none" />
      <rect x="36" y="85" width="14" height="14" stroke="url(#ohpToolsGrad)" strokeWidth="3" style={{ transitionDelay: '0.66s' }} />
      <rect x="58" y="85" width="14" height="14" stroke="url(#ohpToolsGrad)" strokeWidth="3" style={{ transitionDelay: '0.77s' }} />
      <rect x="36" y="107" width="14" height="14" stroke="url(#ohpToolsGrad)" strokeWidth="3" style={{ transitionDelay: '0.88s' }} />
      <rect x="58" y="107" width="14" height="14" fill={gold} stroke="none" style={{ transitionDelay: '0.99s' }} />
      <path d="M108 92 l6 6 l12 -14" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '1.10s' }} />
      <path d="M134 92 H164" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" style={{ transitionDelay: '1.10s' }} />
      <path d="M108 118 l6 6 l12 -14" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '1.21s' }} />
      <path d="M134 118 H164" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" style={{ transitionDelay: '1.21s' }} />
      <path d="M108 144 l6 6 l12 -14" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '1.32s' }} />
      <path d="M134 144 H154" stroke="url(#ohpToolsGrad)" strokeWidth="3" strokeLinecap="round" style={{ transitionDelay: '1.32s' }} />
    </svg>
  )
}

// An ascending results bar chart with the tallest bar highlighted - the success-story section is
// literally about the numbers an agent hit, so show the numbers instead of a map pin.
export function PinRouteMotif({ visible, className = '' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${shared} ${visible ? 'is-visible' : ''} ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id="ohpStoryGrad" x1="0" y1="200" x2="200" y2="0">
          <stop offset="0%" stopColor="#a9791f" />
          <stop offset="100%" stopColor="#f0d494" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity="0.05" stroke="none" />
      <rect x="30" y="130" width="24" height="35" rx="3" stroke="url(#ohpStoryGrad)" strokeWidth="3.5" />
      <rect x="68" y="105" width="24" height="60" rx="3" stroke="url(#ohpStoryGrad)" strokeWidth="3.5" style={{ transitionDelay: '0.33s' }} />
      <rect x="106" y="75" width="24" height="90" rx="3" stroke="url(#ohpStoryGrad)" strokeWidth="3.5" style={{ transitionDelay: '0.66s' }} />
      <rect x="144" y="45" width="24" height="120" rx="3" fill={gold} fillOpacity="0.18" stroke="url(#ohpStoryGrad)" strokeWidth="3.5" style={{ transitionDelay: '0.99s' }} />
      <path d="M140 40 L156 24 L172 38" stroke="url(#ohpStoryGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '1.32s' }} />
      <circle cx="156" cy="24" r="4.5" fill={gold} stroke="none" style={{ transitionDelay: '1.43s' }} />
    </svg>
  )
}

// Key with an "included" checkmark badge - unlocking value at a simple price.
export function KeyMotif({ visible, className = '' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${shared} ${visible ? 'is-visible' : ''} ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id="ohpPricingGrad" x1="0" y1="200" x2="200" y2="0">
          <stop offset="0%" stopColor="#a9791f" />
          <stop offset="100%" stopColor="#f0d494" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity="0.05" stroke="none" />
      <circle cx="55" cy="100" r="30" stroke="url(#ohpPricingGrad)" strokeWidth="4.5" />
      <path d="M85 100 H160 M145 100 V120 M160 100 V113" stroke="url(#ohpPricingGrad)" strokeWidth="4.5" strokeLinecap="round" style={{ transitionDelay: '0.33s' }} />
      <circle cx="55" cy="100" r="9" fill={gold} stroke="none" style={{ transitionDelay: '0.66s' }} />
      <circle cx="148" cy="148" r="17" fill="currentColor" fillOpacity="0.12" stroke="url(#ohpPricingGrad)" strokeWidth="3" style={{ transitionDelay: '0.99s' }} />
      <path d="M140 148 l6 6 l11 -13" stroke="url(#ohpPricingGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '1.32s' }} />
    </svg>
  )
}

// Chat bubble with a question mark plus a lightbulb accent - questions and answers, not an
// ambiguous 3-dot "typing" indicator.
export function ChatMotif({ visible, className = '' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${shared} ${visible ? 'is-visible' : ''} ${className}`}
      fill="none"
    >
      <defs>
        <linearGradient id="ohpFaqGrad" x1="0" y1="200" x2="200" y2="0">
          <stop offset="0%" stopColor="#a9791f" />
          <stop offset="100%" stopColor="#f0d494" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity="0.05" stroke="none" />
      <rect x="22" y="35" width="120" height="85" rx="16" stroke="url(#ohpFaqGrad)" strokeWidth="4" />
      <path d="M52 120 L38 142 L68 120 Z" stroke="url(#ohpFaqGrad)" strokeWidth="4" strokeLinejoin="round" style={{ transitionDelay: '0.33s' }} />
      <path d="M70 65 Q70 52 82 52 Q94 52 94 64 Q94 73 82 77 L82 84" stroke="url(#ohpFaqGrad)" strokeWidth="4" strokeLinecap="round" style={{ transitionDelay: '0.66s' }} />
      <circle cx="82" cy="97" r="4" fill={gold} stroke="none" style={{ transitionDelay: '0.77s' }} />
      <circle cx="158" cy="150" r="20" stroke="url(#ohpFaqGrad)" strokeWidth="3.5" style={{ transitionDelay: '1.10s' }} />
      <path d="M150 150 H166 M152 158 H164" stroke="url(#ohpFaqGrad)" strokeWidth="3" strokeLinecap="round" style={{ transitionDelay: '1.32s' }} />
      <path d="M158 130 V138 M144 136 L150 141 M172 136 L166 141" stroke="url(#ohpFaqGrad)" strokeWidth="3" strokeLinecap="round" style={{ transitionDelay: '1.43s' }} />
    </svg>
  )
}

// QR badge (hero's opposite corner) - the actual first action a visitor's guest takes.
export function QrBadge({ visible, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 100 100" className={`${shared} ${visible ? 'is-visible' : ''} ${className}`} fill="none">
      <defs>{badgeGradient('ohpHeroBadgeGrad')}</defs>
      <circle cx="50" cy="50" r="44" stroke="url(#ohpHeroBadgeGrad)" strokeWidth="3" />
      <rect x="30" y="30" width="14" height="14" stroke="url(#ohpHeroBadgeGrad)" strokeWidth="3" style={{ transitionDelay: '0.33s' }} />
      <rect x="56" y="30" width="14" height="14" stroke="url(#ohpHeroBadgeGrad)" strokeWidth="3" style={{ transitionDelay: '0.44s' }} />
      <rect x="30" y="56" width="14" height="14" stroke="url(#ohpHeroBadgeGrad)" strokeWidth="3" style={{ transitionDelay: '0.55s' }} />
      <rect x="56" y="56" width="14" height="14" fill={gold} stroke="none" style={{ transitionDelay: '0.66s' }} />
    </svg>
  )
}

// Lightning-bolt badge (tools' opposite corner) - "automated" is the throughline across every tool.
export function BoltBadge({ visible, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 100 100" className={`${shared} ${visible ? 'is-visible' : ''} ${className}`} fill="none">
      <defs>{badgeGradient('ohpToolsBadgeGrad')}</defs>
      <circle cx="50" cy="50" r="44" stroke="url(#ohpToolsBadgeGrad)" strokeWidth="3" />
      <path d="M54 22 L30 56 H48 L44 80 L72 44 H52 Z" fill={gold} fillOpacity="0.18" stroke="url(#ohpToolsBadgeGrad)" strokeWidth="3.5" strokeLinejoin="round" style={{ transitionDelay: '0.44s' }} />
    </svg>
  )
}

// Sparkle/star badge (story's opposite corner) - the "top agent" payoff of the result shown.
export function StarBadge({ visible, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 100 100" className={`${shared} ${visible ? 'is-visible' : ''} ${className}`} fill="none">
      <defs>{badgeGradient('ohpStoryBadgeGrad')}</defs>
      <circle cx="50" cy="50" r="44" stroke="url(#ohpStoryBadgeGrad)" strokeWidth="3" />
      <path d="M50 22 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z" fill={gold} fillOpacity="0.16" stroke="url(#ohpStoryBadgeGrad)" strokeWidth="3.5" strokeLinejoin="round" style={{ transitionDelay: '0.44s' }} />
      <circle cx="50" cy="50" r="6" fill={gold} stroke="none" style={{ transitionDelay: '0.77s' }} />
    </svg>
  )
}

// Shield-check badge (pricing's opposite corner) - trust/safety behind a straightforward price.
export function ShieldBadge({ visible, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 100 100" className={`${shared} ${visible ? 'is-visible' : ''} ${className}`} fill="none">
      <defs>{badgeGradient('ohpPricingBadgeGrad')}</defs>
      <circle cx="50" cy="50" r="44" stroke="url(#ohpPricingBadgeGrad)" strokeWidth="3" />
      <path d="M50 24 L72 33 V54 Q72 74 50 82 Q28 74 28 54 V33 Z" stroke="url(#ohpPricingBadgeGrad)" strokeWidth="3.5" strokeLinejoin="round" style={{ transitionDelay: '0.44s' }} />
      <path d="M40 53 l8 8 l14 -18" stroke="url(#ohpPricingBadgeGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '0.88s' }} />
    </svg>
  )
}

// Envelope badge (FAQ's opposite corner) - echoes the "ask us a question" card at the bottom.
export function MailBadge({ visible, className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 100 100" className={`${shared} ${visible ? 'is-visible' : ''} ${className}`} fill="none">
      <defs>{badgeGradient('ohpFaqBadgeGrad')}</defs>
      <circle cx="50" cy="50" r="44" stroke="url(#ohpFaqBadgeGrad)" strokeWidth="3" />
      <rect x="26" y="38" width="48" height="32" rx="4" stroke="url(#ohpFaqBadgeGrad)" strokeWidth="3.5" style={{ transitionDelay: '0.44s' }} />
      <path d="M26 41 L50 60 L74 41" stroke="url(#ohpFaqBadgeGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transitionDelay: '0.77s' }} />
    </svg>
  )
}
