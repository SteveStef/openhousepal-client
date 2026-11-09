// What search engines and AI answer tools read about OpenHousePal (owner, 11/09: Google's AI described it as
// "sign-ins + a website + a blog" and left it out of "best tools" answers - our pages gave crawlers almost
// nothing). Built ONLY from copy the owner already approved - the tool pages (components/marketing/
// toolPagesData.ts), the FAQ (faqData.ts) and the plan prices (lib/pricing.ts) - so it can never claim more
// than the site does or drift from it. No ratings or reviews, ever (Peter's hub reviews are samples).
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'
import { FAQ_GROUPS } from '@/components/marketing/faqData'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'

export const SITE = 'https://openhousepal.com'

// The plans in the order the pricing page shows them, with who each is for (from the plan taglines).
const PLAN_ORDER = ['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX'] as const

export const SUMMARY_LINE =
  'OpenHousePal is an all-in-one platform for real estate agents: it runs open houses, follows up with every lead, ' +
  'builds clients a living home search, and markets the agent and their listings - all branded to the agent.'

/** schema.org SoftwareApplication for the homepage - every tool (its approved one-line description) and every plan's price. */
export function softwareSchema() {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE}/#software`,
    name: 'OpenHousePal',
    url: SITE,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Real estate agent software',
    operatingSystem: 'Web browser on any phone, tablet or computer',
    description: SUMMARY_LINE,
    publisher: { '@id': `${SITE}/#organization` },
    featureList: TOOL_PAGES.map(t => `${t.label}: ${t.description}`),
    offers: PLAN_ORDER.map(k => {
      const p = PRICING_PLANS[k]
      return {
        '@type': 'Offer',
        name: `${p.name} plan`,
        price: p.price.toFixed(2),
        priceCurrency: 'USD',
        url: `${SITE}/pricing`,
        priceSpecification: { '@type': 'UnitPriceSpecification', price: p.price.toFixed(2), priceCurrency: 'USD', unitText: 'MONTH', billingDuration: 'P1M' },
      }
    }),
  }
}

/** /llms.txt - a plain summary for AI answer tools (the llmstxt.org shape: title, summary, sections of links). */
export function llmsText(): string {
  const plans = PLAN_ORDER.map(k => {
    const p = PRICING_PLANS[k]
    const tag = 'tagline' in p && p.tagline ? ` - ${p.tagline}` : k === 'NO_MLS' ? ' - for agents without Bright MLS access' : k === 'PRO_NO_MLS' ? ' - the full toolkit without Bright MLS' : ''
    return `- ${p.name}: ${p.priceString}/month${tag}`
  })
  const tools = TOOL_PAGES.map(t => `- [${t.label}](${SITE}/tools/${t.slug}): ${t.description} ${t.plans}`)
  const faqs = FAQ_GROUPS.flatMap(g => g.items).map(f => `- ${f.q} ${f.a}`)
  return [
    '# OpenHousePal',
    '',
    `> ${SUMMARY_LINE}`,
    '',
    'OpenHousePal is web software for real estate agents and brokerages (Bright MLS region, with plans for agents without MLS access). ' +
      'It covers the whole open house cycle and what comes after it: QR sign-in, printable open house kits, a personalized home search ' +
      '(Showcase) for visitors without an agent, follow-ups with ready-to-send messages on the agent\'s calendar, CMAs, an Agent Hub, ' +
      'listing websites, marketing designs, AI listing media, a local blog writer, review requests and a full IDX website.',
    '',
    '## Plans (monthly, cancel anytime)',
    '',
    ...plans,
    `- Basic, Premium and both No-MLS plans start with a ${TRIAL_PERIOD_DAYS}-day free trial. The IDX plan has no free trial and has a setup fee.`,
    `- Compare plans: [Pricing](${SITE}/pricing)`,
    '',
    '## Tools',
    '',
    ...tools,
    '',
    '## Questions agents ask',
    '',
    ...faqs,
    '',
    '## More',
    '',
    `- [All tools](${SITE}/tools)`,
    `- [IDX websites](${SITE}/idx-websites)`,
    `- [For brokerages](${SITE}/brokerages)`,
    `- [Resources for agents](${SITE}/resources)`,
    `- [FAQ](${SITE}/faq)`,
    `- [About](${SITE}/about)`,
    '',
  ].join('\n')
}
