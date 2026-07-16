// KINEO-PUBLIC-VIRALSCORE-2026-07-08 — public, indexable landing for the free
// "Will it go viral?" grader. Server component (exports metadata for SEO/social)
// wrapping the interactive client.
import type { Metadata } from 'next'
import ViralScoreClient from './ViralScoreClient'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Will It Go Viral? — Free Short Idea Score | Kineo',
  description:
    'Paste any YouTube Shorts / TikTok idea and get an instant viral score — hook, retention, trend-fit and shareability — from Kineo’s viral engine. Free, no signup.',
  alternates: { canonical: 'https://www.usekineo.com/viral-score' },
  openGraph: {
    title: 'Will It Go Viral? — Free Short Idea Score',
    description: 'Score any Short idea in seconds. Free tool by Kineo.',
    url: 'https://www.usekineo.com/viral-score',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Will It Go Viral? — Free Short Idea Score',
    description: 'Score any Short idea in seconds. Free tool by Kineo.',
  },
}

export default function ViralScorePage() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(1200px 600px at 50% -10%, #141826 0%, #0a0b0f 60%)' }}>
      <ViralScoreClient />
      <Footer />
    </main>
  )
}
