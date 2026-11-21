// State-required CMA disclosures (11/20 audit). Some states prescribe exact words a licensee's comparative market
// analysis must carry, and where. Wording is verbatim from the official text - never edit it here without the source:
//   PA  49 Pa. Code § 35.340         - "printed conspicuously and without change on the first page"
//   MD  COMAR 09.11.02.02F(1)       - "printed conspicuously and without change on the first page"
//   DE  24 Del. C. § 2931            - "at least a 12-point bold face type font and located immediately following
//                                       the estimated market price"
//   NJ  N.J.A.C. 11:5-6.1(m)(1)(i)    - a statement that the CMA "is not an appraisal and should not be considered the
//                                       equivalent of an appraisal", in print as large as the predominant print (no fixed words)
// Checked and found no prescribed wording: VA (Code § 54.1-2100, 2142.1; 18VAC135-20-190), DC (Code 47-28 titles).
// First-page statements print at the report's body-text size or larger (NJ's rule; PA / MD "conspicuously").
// The home's state decides (the CMA is about a property there). Every CMA - buyer and seller - carries it.

export type CmaStateDisclosure = {
  state: 'PA' | 'MD' | 'DE' | 'NJ'
  heading: string | null
  text: string
  /** first_page: on the cover; after_value: right under the headline value, 12-point bold */
  where: 'first_page' | 'after_value'
}

const DISCLOSURES: Record<CmaStateDisclosure['state'], CmaStateDisclosure> = {
  PA: {
    state: 'PA',
    heading: null,
    text: 'This analysis has not been performed in accordance with the Uniform Standards of Professional Appraisal '
      + 'Practice which requires valuers to act as unbiased, disinterested third parties with impartiality, objectivity '
      + 'and independence and without accommodation of personal interest. It is not to be construed as an appraisal '
      + 'and may not be used as such for any purpose.',
    where: 'first_page',
  },
  MD: {
    state: 'MD',
    heading: 'COMPETITIVE MARKET ANALYSIS DISCLOSURE',
    text: 'This analysis is not an appraisal. It is intended only for the purpose of assisting buyers or sellers or '
      + 'prospective buyers or sellers in deciding the listing, offering, or sale price of the real property.',
    where: 'first_page',
  },
  DE: {
    state: 'DE',
    heading: null,
    text: 'Notwithstanding any language to the contrary contained herein, this Competitive Market Analysis is NOT an '
      + 'appraisal of the market value for property and is not intended to be used for any legal purpose including '
      + 'approval of a mortgage loan, modification of a mortgage loan, divorce/property separation, estate settlement, '
      + 'bankruptcy proceedings or any other purpose where real estate value is needed. If an appraisal is desired, '
      + 'the services of a licensed or certified appraiser must be obtained.',
    where: 'after_value',
  },
  NJ: {
    state: 'NJ',
    heading: null,
    text: 'This comparative market analysis is not an appraisal and should not be considered the equivalent of an appraisal.',
    where: 'first_page',
  },
}

/** Plain names for the states our agents work in (Bright MLS and neighbours), for messages to the agent. */
export const US_STATE_NAMES: Record<string, string> = {
  PA: 'Pennsylvania', NJ: 'New Jersey', DE: 'Delaware', MD: 'Maryland', VA: 'Virginia', DC: 'Washington, DC',
  WV: 'West Virginia', NY: 'New York', OH: 'Ohio', NC: 'North Carolina',
}

const STATE_NAMES: Record<string, CmaStateDisclosure['state']> = {
  PA: 'PA', PENNSYLVANIA: 'PA', MD: 'MD', MARYLAND: 'MD', DE: 'DE', DELAWARE: 'DE', NJ: 'NJ', 'NEW JERSEY': 'NJ',
}

/** The disclosure the home's state requires, or null when it prescribes none. */
export function cmaStateDisclosure(state: string | null | undefined): CmaStateDisclosure | null {
  const k = STATE_NAMES[String(state || '').trim().toUpperCase().replace(/\./g, '')]
  return k ? DISCLOSURES[k] : null
}
