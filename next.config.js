/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Enable standalone output for Docker
  output: 'standalone',
}

module.exports = nextConfig

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   
//   images: {
//     unoptimized: true,
//     domains: ['photos.zillowstatic.com', 'maps.googleapis.com'], // Add the allowed domain(s) here
//   },
// };
//
//export default nextConfig;
