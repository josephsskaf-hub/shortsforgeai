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
      // PUSH #34 — the strongest stale branded-search result still points to
      // /auth.html?mode=signup. The old catch-all sent that signup intent to
      // /login, adding a needless dead end for traffic we already earned.
      // Query values not consumed by the rule (prompt, plan, redirect, etc.)
      // are preserved by Next.js, so old campaign/bookmark links keep working.
      {
        source: '/auth.html',
        has: [{ type: 'query', key: 'mode', value: '(?<legacySignup>signup|register)' }],
        destination: '/signup?intent_campaign=push34_legacy_auth',
        permanent: true,
      },
      { source: '/auth.html', destination: '/login', permanent: true },
      // Retire the remaining paths from the pre-Next static site. These are
      // exact compatibility redirects, not indexable duplicate pages.
      { source: '/signup.html', destination: '/signup?intent_campaign=push34_legacy_auth', permanent: true },
      { source: '/login.html', destination: '/login', permanent: true },
      { source: '/dashboard.html', destination: '/dashboard', permanent: true },
      { source: '/generate.html', destination: '/generate', permanent: true },
      { source: '/pricing.html', destination: '/pricing', permanent: true },
      { source: '/history.html', destination: '/history', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
      // KINEO-RECOVERY-2026-07-15 — retire the stale campaign page at the
      // edge. A config redirect produces a real HTTP Location header even
      // when /start was previously statically generated.
      { source: '/start', destination: '/signup?utm_source=start', permanent: true },
      // Retire the stale public founding offer without touching legacy buyer
      // entitlements or private checkout handling.
      { source: '/founding', destination: '/pricing', permanent: true },
      // Push #116 — legacy short alias for the thumbnail tool. The
      // sidebar + footer + every internal link uses /thumbnail-generator,
      // but a few external pings still hit /thumbnail.
      { source: '/thumbnail', destination: '/thumbnail-generator', permanent: true },
    ]
  },
}

module.exports = nextConfig
