export const TRIAL_PERIOD_DAYS = 14;

// Plan METADATA only - name, price, PayPal plan id, the "All of X, plus:" divider label.
// The FEATURE LISTS deliberately do NOT live here anymore. The one canonical description of
// what each plan includes is the card in components/pricing/PricingCards.tsx, which the
// homepage, checkout, /upgrade-required, Settings > Subscription, and the resubscribe modal
// all render. Do not re-add a `features: [...]` array to these objects - it will silently
// drift from the cards, which is exactly the bug this removal fixes.
export const PRICING_PLANS = {
  NO_MLS: {
    id: 'no_mls',
    name: 'No-MLS Basic',
    price: 19.95,
    priceString: '$19.95',
    paypalPlanId: process.env.NEXT_PUBLIC_NO_MLS_PLAN_ID || 'P-DEFAULT_NO_MLS_ID',
    includesLabel: "What's Included:",
  },
  PRO_NO_MLS: {
    id: 'pro_no_mls',
    name: 'No-MLS Premium',
    price: 49.95,
    priceString: '$49.95',
    paypalPlanId: process.env.NEXT_PUBLIC_PRO_NO_MLS_PLAN_ID || 'P-DEFAULT_PRO_NO_MLS_ID',
    includesLabel: 'All of No-MLS Basic, plus:',
  },
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 24.95,
    priceString: '$24.95',
    paypalPlanId: process.env.NEXT_PUBLIC_BASIC_V2_PLAN_ID || 'P-DEFAULT_BASIC_V2_ID',
    tagline: 'Essential Bright MLS access',
    includesLabel: "What's Included:",
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    price: 49.95,
    priceString: '$49.95',
    paypalPlanId: process.env.NEXT_PUBLIC_PREMIUM_V2_PLAN_ID || 'P-DEFAULT_PREMIUM_V2_ID',
    tagline: 'The full toolkit',
    includesLabel: 'All of Basic, plus:',
  },
  IDX: {
    id: 'idx',
    name: 'IDX',
    price: 99.95,
    priceString: '$99.95',
    paypalPlanId: process.env.NEXT_PUBLIC_IDX_PLAN_ID || 'P-DEFAULT_IDX_ID',
    tagline: 'Your own IDX website',
    includesLabel: 'All of Basic, Premium, plus:',
  },
} as const;

export type PlanTierId = keyof typeof PRICING_PLANS;
export type PricingPlan = (typeof PRICING_PLANS)[PlanTierId];

// The Bright MLS upgrade ladder, in order. No-MLS is a separate track (agents without Bright
// coverage), not the bottom rung of this ladder - it's never included here.
export const BRIGHT_TIER_ORDER: readonly PlanTierId[] = ['BASIC', 'PREMIUM', 'IDX'];

// Legacy PayPal plan pricing, still shown to existing grandfathered subscribers on their
// account/settings pages - never offered to new signups. See PAYPAL_BASIC_PLAN_ID /
// PAYPAL_PREMIUM_PLAN_ID on the backend (untouched, original $9.95/$24.95 pricing).
export const LEGACY_PRICE_BY_TIER: Partial<Record<PlanTierId, { price: number; priceString: string }>> = {
  BASIC: { price: 9.95, priceString: '$9.95' },
  PREMIUM: { price: 24.95, priceString: '$24.95' },
};
