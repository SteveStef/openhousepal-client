/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [50, 70, 75, 80, 85, 90, 100],
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
