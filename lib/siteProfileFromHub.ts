// The website header/footer's agent details, built in the browser from the agent's own Agent Hub
// config + account - the same merge the backend does for the live site
// (content_adapters.get_agent_profile), so the website editor's preview and the setup flow's mini
// site show the agent's real name, photo and contact details even before the site is published.

export type SiteChromeProfile = {
  name: string
  title: string
  market: string
  brokerage: string
  license_number: string
  photo_url: string
  phone: string
  email: string
  social_links: { id?: string; label?: string; url: string }[]
}

export function siteProfileFromHub(hubConfig: any, user: any): SiteChromeProfile {
  const config = hubConfig || {}
  const profile = config.profile || {}
  const contact = config.contact || {}
  const u = user || {}
  return {
    name: profile.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    title: profile.title || u.professional_title || '',
    market: profile.market || u.market || '',
    brokerage: profile.brokerage || u.brokerage || '',
    license_number: profile.licenseNumber || contact.licenseNumber || u.license_number || '',
    photo_url: config.profilePhotoUrl || u.photo_url || u.profile_photo_url || '',
    phone: contact.call || '',
    email: contact.email || u.email || '',
    social_links: (config.socialLinks || [])
      .filter((l: any) => l && l.enabled && String(l.url || '').trim())
      .map((l: any) => ({ id: l.id, label: l.label, url: String(l.url).trim() })),
  }
}
