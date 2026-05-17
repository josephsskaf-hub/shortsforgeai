/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/auth.html', destination: '/login', permanent: true },
      // Push #116 — legacy short alias for the thumbnail tool. The
      // sidebar + footer + every internal link uses /thumbnail-generator,
      // but a few external pings still hit /thumbnail.
      { source: '/thumbnail', destination: '/thumbnail-generator', permanent: true },
    ]
  },
}

module.exports = nextConfig
