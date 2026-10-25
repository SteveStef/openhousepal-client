import { fmtMoney, fmtNumber, fmtPhone, type SpotlightModel } from './model'
import { prettyFeature } from './features'

// What the one-page fact sheet ("cheat sheet") shows - shared by the printable page and its PDF so
// the two can never differ. Sized to always fit ONE letter page (user, 10/24).
export function factSheetData(m: SpotlightModel) {
  const { p } = m
  const stats = [
    p.beds != null && [fmtNumber(p.beds), 'Beds'],
    p.baths != null && [fmtNumber(p.baths), 'Baths'],
    p.sqft && [fmtNumber(p.sqft), 'Sq ft'],
    p.lot_size_acres && [fmtNumber(p.lot_size_acres), 'Acres'],
    p.year_built && [String(p.year_built), 'Built'],
  ].filter(Boolean) as [string, string][]
  // The facts a buyer compares on, not every MLS field.
  const facts = m.keyFacts
    .filter(f => !['Status', 'Bedrooms', 'Bathrooms', 'Interior', 'Year built', 'MLS #', 'Days on market', 'Subdivision', 'Property type'].includes(f.label))
    .slice(0, 12)
  const features = m.featured.slice(0, 8).map(x => prettyFeature(x))
  const agent = m.agent
  return {
    street: p.address.split(',')[0],
    place: m.fullAddress.split(',').slice(1).join(',').trim(),
    kicker: [m.status?.label, m.cityState].filter(Boolean).join(' · '),
    price: fmtMoney(p.price),
    priceLabel: m.status?.kind === 'sold' ? 'Sold for' : 'Offered at',
    hero: m.heroImage,
    stats, facts, features, schools: m.schools,
    agent: agent ? {
      name: agent.name, photo: agent.photo_url || null,
      line: [agent.brokerage, fmtPhone(agent.phone)].filter(Boolean).join(' · '),
      email: agent.email || '',
      license: agent.license_number || '',
    } : null,
    mls: m.isMls && p.mls_number ? `MLS# ${p.mls_number}` : '',
  }
}

export type FactSheet = ReturnType<typeof factSheetData>
