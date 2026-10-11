import type { MetadataRoute } from 'next'

const BASE =
  process.env.NEXT_PUBLIC_CLIENT_URL?.startsWith('https')
    ? process.env.NEXT_PUBLIC_CLIENT_URL
    : `https://${process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'}`

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep crawlers out of the signed-in app and out of private client links (a showcase /
        // CMA / open-house link is meant for one person, not Google's index).
        disallow: [
          '/api/',
          '/dash',
          '/leads',
          '/studio',
          '/settings',
          '/admin',
          '/activity',
          '/assistant',
          '/checkout',
          '/broker-authorization',
          '/open-house/',
          '/showcase/',
          '/showcases',
          '/cma/',
          '/net-sheet/',
          '/cash-needed/',
          '/discovery',
          '/upgrade-required',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
