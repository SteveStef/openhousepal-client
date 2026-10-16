// The agent's two non-mobile numbers, kept apart (user, 10/16) - mirrors backend app/services/hub_phones.py:
//   - Brokerage phone (profile.brokeragePhone): the brokerage's main number. Required; printed on
//     designs for compliance. Never on the Save Contact card.
//   - Office phone (contactCard.fields.officePhone): the agent's OWN office line. Optional; Save
//     Contact lists it as "work".
// A config with no brokeragePhone key is the older one-field shape: its officePhone WAS the
// brokerage number, so it counts as the brokerage phone, not an office line.

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const officeValue = (cfg: any) => str(cfg?.contactCard?.fields?.officePhone?.value)

export const isLegacyPhones = (cfg: any) => !cfg?.profile || !('brokeragePhone' in cfg.profile)

export const getBrokeragePhone = (cfg: any) => (isLegacyPhones(cfg) ? officeValue(cfg) : str(cfg?.profile?.brokeragePhone))

export const getOfficePhone = (cfg: any) => (isLegacyPhones(cfg) ? '' : officeValue(cfg))

/** Move an older config to the two-number shape before editing/saving it (no-op when already moved). */
export function upgradeHubPhones<T extends Record<string, any>>(cfg: T): T {
  if (!cfg || !isLegacyPhones(cfg)) return cfg
  const fields = { ...(cfg.contactCard?.fields || {}) }
  const brokeragePhone = officeValue(cfg)
  if (fields.officePhone) fields.officePhone = { ...fields.officePhone, value: '', include: false }
  return {
    ...cfg,
    profile: { ...(cfg.profile || {}), brokeragePhone },
    contactCard: { ...(cfg.contactCard || {}), fields },
  }
}
