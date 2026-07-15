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
      // KINEO-RECOVERY-2026-07-15 — retire the stale campaign page at the
      // edge. A config redirect produces a real HTTP Location header even
      // when /start was previously statically generated.
      { source: '/start', destination: '/signup?utm_source=start', permanent: false },
      // Push #116 — legacy short alias for the thumbnail tool. The
      // sidebar + footer + every internal link uses /thumbnail-generator,
      // but a few external pings still hit /thumbnail.
      { source: '/thumbnail', destination: '/thumbnail-generator', permanent: true },
    ]
  },
}

module.exports = nextConfig
