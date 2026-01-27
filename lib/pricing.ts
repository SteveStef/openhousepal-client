export const TRIAL_PERIOD_DAYS = 30;

export const PRICING_PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 49.95,
    priceString: '$49.95',
    paypalPlanId: process.env.NEXT_PUBLIC_BASIC_PLAN_ID || 'P-DEFAULT_BASIC_ID',
    features: [
      'Generated PDFs for Open Houses',
      'Custom open house sign-in forms',
      'Catalog of all visitors'
    ]
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    price: 99.95,
    priceString: '$99.95',
    paypalPlanId: process.env.NEXT_PUBLIC_PREMIUM_PLAN_ID || 'P-DEFAULT_PREMIUM_ID',
    features: [
      'Automated follow-up emails',
      'Real-time property alerts',
      'Advanced analytics & insights',
      'Personalized property Showcases',
      'Visitor interaction tracking'
    ]
  }
} as const;

export type PricingPlan = typeof PRICING_PLANS.BASIC | typeof PRICING_PLANS.PREMIUM;
