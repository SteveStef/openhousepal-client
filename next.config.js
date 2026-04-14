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
    ],
  },
  // Enable standalone output for Docker
  output: 'standalone',
}

module.exports = nextConfig
