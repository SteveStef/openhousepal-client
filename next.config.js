/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [50, 70, 75, 80, 85, 90, 100],
    // Each resized photo is kept a day (our server's disk copy, Cloudflare's copy of /pimg/... and the
    // visitor's browser). MLS photo addresses change when the photo changes; 1 day keeps a replaced
    // agent headshot from lingering.
    minimumCacheTTL: 86400,
    remotePatterns: [
      // {
      //   protocol: 'https',
      //   hostname: '**.zillowstatic.com',
      // },
      // {
      //   protocol: 'https',
      //   hostname: '**.zillow.com',
      // },
      // {
      //   protocol: 'https',
      //   hostname: 'photos.zillowstatic.com',
      // },
      {
        protocol: 'https',
        hostname: '**.hdpcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
      },
      {
        protocol: 'https',
        hostname: '**.brightmls.com',
      },
      {
        protocol: 'http',
        hostname: '**.brightmls.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'openhousepal-images.s3.us-east-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
  // Photos served through Next's image resizer (agent photos, listing photos in the homepage demos)
  // never appear in Google Images under OpenHousePal (owner, 10/30). Every other path on
  // openhousepal.com gets its noindex from proxy.ts, but /_next/image skips the proxy.
  async headers() {
    return [
      { source: '/_next/image', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/pimg/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      // AI Media Cinematic Video's built-in files (example video, music, sample photos): let
      // browsers keep them a day and Cloudflare a month, so every agent's preview is served from
      // the edge, not our server. Rename a file when it changes.
      { source: '/motion/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800' }] },
    ]
  },
  // /pimg/<w>/<q>/p.webp?u=<photo> (lib/photoUrl.ts) is Next's own resizer under an address Cloudflare
  // stores (it only keeps files ending in a picture extension; /_next/image has none).
  async rewrites() {
    return {
      beforeFiles: [{
        source: '/pimg/:w/:q/p.webp',
        has: [{ type: 'query', key: 'u', value: '(?<u>.+)' }],
        destination: '/_next/image?url=:u&w=:w&q=:q',
      }],
    }
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Dev-only: keep compiled routes in memory. Next's default (5 pages, disposed after 60s idle)
  // made every tab recompile (5-10s with webpack) even after `npm run warm` pre-compiled it.
  onDemandEntries: {
    maxInactiveAge: 4 * 60 * 60 * 1000,
    pagesBufferLength: 200,
  },
}

module.exports = nextConfig
