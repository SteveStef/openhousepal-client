// The form a Studio piece should open (user 10/12): picked by the moment, and for the open-ended Social
// Ad (whose headline can ask anything) by what the headline actually asks - "Find out what your home is
// really worth" belongs on the home-value form, "See new listings before anyone else" on the buyer form.
// Used by the create flow ("Best fit", pre-picked) and the editor's Leads card.

const BY_SITUATION: Record<string, string[]> = {
  just_listed: ['showing', 'how_can_i_help'], coming_soon: ['showing', 'how_can_i_help'], open_house: ['showing', 'how_can_i_help'],
  price_improvement: ['showing', 'how_can_i_help'], under_contract: ['home_value', 'selling'], just_sold: ['home_value', 'selling'],
  home_valuation: ['home_value', 'selling'], make_me_sell: ['make_me_sell', 'selling'], find_your_dream_home: ['buying', 'how_can_i_help'],
  social_ad: ['how_can_i_help', 'home_value', 'buying'],
}

/** Form types in order of fit. */
export function bestFormTypes(situationId: string | null | undefined, headline?: string | null): string[] {
  const base = BY_SITUATION[situationId || ''] || []
  if (situationId !== 'social_ad' || !headline) return base
  const h = headline.toLowerCase()
  if (/worth|value|valuation|apprais/.test(h)) return ['home_value', 'selling', 'how_can_i_help']
  if (/make (you )?move|price (were|was) right|your number/.test(h)) return ['make_me_sell', 'selling', 'how_can_i_help']
  if (/\bsell/.test(h)) return ['selling', 'home_value', 'how_can_i_help']
  if (/listing|next home|dream home|home search|\bbuy|find (a|your) home/.test(h)) return ['buying', 'how_can_i_help']
  return base
}

/** The agent's form that fits best (falls back to the buy-or-sell intake, then the first form). */
export function pickBestForm<F extends { form_type: string }>(forms: F[], situationId: string | null | undefined, headline?: string | null): F | undefined {
  for (const type of bestFormTypes(situationId, headline)) {
    const f = forms.find(x => x.form_type === type)
    if (f) return f
  }
  return forms.find(f => f.form_type === 'how_can_i_help') || forms[0]
}
