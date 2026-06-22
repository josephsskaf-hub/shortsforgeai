// #484 — Free lead-magnet tool page. Targets high-intent searches like
// "free youtube short script generator", "ai faceless script generator no signup".
// Reuses the existing public, rate-limited /api/demo-script endpoint (no new
// backend, no auth) and funnels the result into signup. This is the #1
// replacement for the suspended Google Ads: a free tool that ranks in search,
// gives instant value, and converts the problem-aware visitor. Server component
// exports the SEO metadata; the interactive tool is the client child.
import type { Metadata } from 'next'
import FreeScriptClient from './FreeScriptClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'Free YouTube Short Script Generator (AI, No Signup) — ShortsForgeAI',
  description:
    'Generate a viral, hook-driven YouTube Short script free with AI — no signup. Type a topic, get a 45-60s faceless script (hook, facts, payoff) instantly. Then turn it into a finished video in 60s.',
  alternates: { canonical: 'https://www.shortsforgeai.com/free-script-generator' },
  openGraph: {
    title: 'Free AI YouTube Short Script Generator — No Signup',
    description:
      'Type a topic, get a viral faceless Short script (hook → facts → payoff) free, instantly. Then make it a finished video in 60s.',
    url: 'https://www.shortsforgeai.com/free-script-generator',
    type: 'website',
  },
}

export default function FreeScriptGeneratorPage() {
  return <FreeScriptClient />
}
