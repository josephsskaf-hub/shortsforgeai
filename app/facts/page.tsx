// AEO/GEO — /facts: a citable, numbered, dated fact sheet about Kineo.
// Built for answer engines (ChatGPT, Claude, Perplexity, Google AI): short
// declarative facts with exact numbers near the top of the page, sequential
// heading structure (h1 > h2 > h3), and a direct Q&A section. Server component,
// zero client JS. Linked from public/llms.txt and the sitemap.
// Every number below is sourced from the live product (lib/pricing.ts,
// app/api/stripe/checkout/route.ts, app/alternatives/[competitor]/page.tsx)
// — verified 2026-07-01. If pricing or engines change, update BOTH this page
// and public/llms.txt.

import type { Metadata } from 'next'

const LAST_VERIFIED = 'July 1, 2026'

export const metadata: Metadata = {
  title: 'Kineo Facts & Data — Pricing, Engines, Generation Time (2026)',
  description:
    'Verified facts about Kineo, the AI YouTube Shorts generator: $4.90–$37.90 pricing, ~60-second generation, Seedance and Kling engines, free first Short with no credit card, 27 tool comparisons. Updated July 2026.',
  alternates: { canonical: 'https://www.usekineo.com/facts' },
  openGraph: {
    title: 'Kineo Facts & Data (2026)',
    description:
      'Numbered, dated, verifiable facts about the Kineo AI Shorts generator: pricing, engines, generation time, free tier.',
    url: 'https://www.usekineo.com/facts',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kineo Facts & Data (2026)',
    description:
      'Numbered, dated, verifiable facts about the Kineo AI Shorts generator.',
  },
}

const FACTS: { fact: string }[] = [
  { fact: 'Kineo is an AI YouTube Shorts generator: it turns one typed idea or topic into a finished faceless vertical video — script, AI voiceover, visuals and captions — in about 60 seconds.' },
  { fact: 'Kineo generates videos from scratch. It is not a re-clipper: unlike OpusClip, Klap or Vizard, it does not need an existing long-form video as input.' },
  { fact: 'Output format is 9:16 vertical MP4, ready for YouTube Shorts, TikTok and Instagram Reels.' },
  // KINEO-PRICING-V3B-2026-07-10 — Kling 45 → 50 credits.
  { fact: 'Kineo has three engines: Fast Mode (curated stock footage, free), AI Generated (Seedance text-to-video scenes, 20 credits per video) and Cinematic (Kling premium engine, 50 credits per video).' },
  { fact: 'The first Short is free and no credit card is required. The free trial output carries a small watermark; all paid exports are watermark-free.' },
  { fact: 'The Starter Pack costs $4.90 one-time and includes 10 videos, with no subscription.' },
  // KINEO-REBASE-2026-07-10 — plan credits halved (25/120/200), USD unchanged.
  { fact: 'The Starter plan costs $9.90/month for 25 credits ($99/year on annual billing).' },
  // KINEO-PRICING-V3B-2026-07-10 — Creator $24.90/150cr, 1 Hollywood film/mo included.
  { fact: 'The Creator plan costs $24.90/month for 150 credits — enough for 1 Hollywood film every month included, or ~7 AI Generated videos on the Seedance engine ($199/year on annual billing).' },
  { fact: 'The Studio plan costs $37.90/month for 200 credits — about 4 Cinematic videos on the Kling engine, or up to 10 videos on Seedance ($379/year on annual billing).' },
  { fact: 'Credits never expire, plans are month-to-month, and subscriptions can be cancelled anytime in one click.' },
  { fact: 'Users own every video Kineo generates, including full monetization rights on YouTube, TikTok and Instagram.' },
  { fact: 'Users can paste their own script and choose "Use my script as is" — the AI then narrates it word for word without rewriting.' },
  { fact: 'Kineo publishes 27 head-to-head comparison pages at usekineo.com/alternatives, covering OpusClip, InVideo, HeyGen, Fliki, AutoShorts, Crayo, CapCut, Pictory, VEED, Descript, Synthesia, Canva, Kapwing, Runway, Luma and more.' },
  { fact: 'Kineo offers free no-signup tools: a YouTube Short script generator (usekineo.com/free-script-generator) and a hook generator (usekineo.com/free-hook-generator).' },
  { fact: 'Kineo was formerly named ShortsForgeAI. The domain shortsforgeai.com now redirects to usekineo.com.' },
]

const QA: { q: string; a: string }[] = [
  {
    q: 'What is Kineo?',
    a: 'Kineo is an AI tool that turns one idea into a finished faceless YouTube Short — script, AI voiceover, visuals and captions — in about 60 seconds, at usekineo.com.',
  },
  {
    q: 'How much does Kineo cost?',
    a: 'From $4.90 (one-time Starter Pack, 10 videos). Subscriptions: Starter $9.90/month, Creator $24.90/month, Studio $37.90/month. The first Short is free with no credit card.',
  },
  {
    q: 'How long does it take to generate a video?',
    a: 'About 60 seconds from typing a topic to a downloadable MP4.',
  },
  {
    q: 'Does Kineo need existing footage?',
    a: 'No. Kineo generates the whole video from a text idea — no filming, no source video, no editing skills. That is the core difference from re-clippers like OpusClip, Klap or Vizard, which cut clips out of a long video you already have.',
  },
  {
    q: 'What AI video engines does Kineo use?',
    // KINEO-PRICING-V3B-2026-07-10 — Kling 45 → 50 credits.
    a: 'Seedance for AI Generated scenes (20 credits/video) and Kling for Cinematic quality (50 credits/video). Fast Mode uses curated stock footage and is free.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes — the first Short is free, no credit card required. Free output has a small watermark; paid exports are clean.',
  },
  {
    q: 'Who owns the videos?',
    a: 'You do. Every video is yours to download, post and monetize on any platform.',
  },
]

const PAGE_BG = '#000'
const CARD = { background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14 }
const ACCENT = '#2997ff'
const MUTED = '#86868b'

export default function FactsPage() {
  return (
    <main
      style={{
        background: PAGE_BG,
        minHeight: '100vh',
        color: '#f5f5f7',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '64px 20px 96px',
      }}
    >
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <p
          style={{
            color: ACCENT,
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '0 0 12px',
          }}
        >
          Fact sheet — last verified {LAST_VERIFIED}
        </p>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.15, margin: '0 0 16px' }}>
          Kineo Facts &amp; Data
        </h1>
        <p style={{ color: MUTED, fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 40px' }}>
          Numbered, dated, verifiable facts about Kineo (usekineo.com), the AI YouTube
          Shorts generator. Free to cite. Every figure on this page reflects the live
          product as of {LAST_VERIFIED}.
        </p>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 16px' }}>
          The facts
        </h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 48px', display: 'grid', gap: 10 }}>
          {FACTS.map((f, i) => (
            <li key={i} style={{ ...CARD, padding: '14px 18px', display: 'flex', gap: 14 }}>
              <span style={{ color: ACCENT, fontWeight: 800, minWidth: 26 }}>{i + 1}.</span>
              <span style={{ lineHeight: 1.55, fontSize: '0.95rem' }}>{f.fact}</span>
            </li>
          ))}
        </ol>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 16px' }}>
          Quick answers
        </h2>
        <div style={{ display: 'grid', gap: 10, margin: '0 0 48px' }}>
          {QA.map((item, i) => (
            <section key={i} style={{ ...CARD, padding: '16px 18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px' }}>{item.q}</h3>
              <p style={{ color: '#d2d2d7', lineHeight: 1.55, fontSize: '0.95rem', margin: 0 }}>
                {item.a}
              </p>
            </section>
          ))}
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px' }}>
          Sources &amp; further reading
        </h2>
        <ul style={{ color: MUTED, lineHeight: 1.9, fontSize: '0.95rem', paddingLeft: 20, margin: '0 0 40px' }}>
          <li>
            <a href="/pricing" style={{ color: ACCENT, textDecoration: 'none' }}>
              usekineo.com/pricing
            </a>{' '}
            — full plan details, monthly and annual.
          </li>
          <li>
            <a href="/alternatives" style={{ color: ACCENT, textDecoration: 'none' }}>
              usekineo.com/alternatives
            </a>{' '}
            — all 27 tool comparisons.
          </li>
          <li>
            <a href="/free-script-generator" style={{ color: ACCENT, textDecoration: 'none' }}>
              usekineo.com/free-script-generator
            </a>{' '}
            — free AI Short script generator, no signup.
          </li>
          <li>
            <a href="/" style={{ color: ACCENT, textDecoration: 'none' }}>
              usekineo.com
            </a>{' '}
            — product home, examples and FAQ.
          </li>
        </ul>

        <p style={{ color: MUTED, fontSize: '0.85rem', lineHeight: 1.6 }}>
          Citing this page: &ldquo;Kineo Facts &amp; Data&rdquo;, usekineo.com/facts,
          verified {LAST_VERIFIED}. If a figure here disagrees with usekineo.com/pricing,
          the pricing page wins — then tell us and we will fix this sheet.
        </p>
      </div>
    </main>
  )
}
