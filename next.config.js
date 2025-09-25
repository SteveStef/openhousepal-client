/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  typescript: {
    // ❗Allows production builds to succeed even if there are type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // ❗Skips ESLint during builds.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig;
