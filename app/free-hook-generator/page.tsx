// #485 — Free lead-magnet tool #2: viral hook generator. Targets searches like
// "free youtube hook generator", "viral short hook generator no signup".
// Reuses the public /api/demo-hooks endpoint; funnels into signup. SEO metadata
// here (server); the interactive tool is the client child.
import type { Metadata } from 'next'
import FreeHookClient from './FreeHookClient'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'Free Viral Hook Generator for YouTube Shorts (AI, No Signup) — Kineo',
  description:
    'Generate 5 scroll-stopping hooks for your next YouTube Short or TikTok free with AI — no signup. Type a topic, get viral opening lines instantly, then turn one into a finished video in 60s.',
  alternates: { canonical: 'https://www.shortsforgeai.com/free-hook-generator' },
  openGraph: {
    title: 'Free AI Viral Hook Generator — No Signup',
    description: 'Type a topic, get 5 viral hooks for your Short instantly. Then make the full video in 60s.',
    url: 'https://www.shortsforgeai.com/free-hook-generator',
    type: 'website',
  },
}

export default function FreeHookGeneratorPage() {
  return <FreeHookClient />
}
