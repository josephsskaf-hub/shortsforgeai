// ROBO2-SEO-2026-06-28 — high-intent SEO page for the "cheapest AI shorts maker"
// buyer cluster (cheapest AI YouTube Shorts generator / affordable faceless shorts AI /
// make AI YouTube Shorts cheap). Honest angle: AI Gen (Seedance) is SFA's cheapest
// AI engine at 40 credits/video; first Short free, no card; generates from a topic —
// not a re-clipper. No invented prices: pricing claims link to /pricing.
// Static page; added to sitemap. FAQ JSON-LD for rich results.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'

export const metadata: Metadata = {
  title: 'Cheapest AI Shorts Maker — Make YouTube Shorts Cheap, First One Free | ShortsForgeAI',
  description:
    'The cheapest AI YouTube Shorts generator that builds a faceless Short from a single idea — script, AI voiceover, footage and captions in about 60 seconds. AI Gen (Seedance) is the lowest-cost AI engine at 40 credits per video. First Short free, no credit card.',
  alternates: { canonical: 'https://www.shortsforgeai.com/cheapest-ai-shorts-maker' },
  openGraph: {
    title: 'Cheapest AI Shorts Maker — make AI YouTube Shorts cheap',
    description:
      'Make affordable faceless Shorts from just an idea: script, voiceover, footage and captions. AI Gen (Seedance) is the cheapest engine at 40 credits/video. First Short free, no card.',
    url: 'https://www.shortsforgeai.com/cheapest-ai-shorts-maker',
    type: 'website',
  },
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '1', t: 'Type one idea or topic', d: 'No source footage, no long video to re-clip. One line is enough — "the island too dangerous to visit", "how compound interest works".' },
  { n: '2', t: 'Pick the cheapest AI engine', d: 'AI Gen (Seedance) is the lowest-cost AI tier at 40 credits per video — real generated scenes, not a premium engine you don’t need yet.' },
  { n: '3', t: 'Download a ready-to-post Short', d: 'A finished 9:16 video — script, AI voiceover, footage matched to each line and captions — in about 60 seconds. No editor, no timeline.' },
]

const WHY_CHEAPER: { t: string; d: string }[] = [
  { t: 'Built only for faceless Shorts', d: 'It does one job — turn an idea into a short-form video — so you’re not paying for a bloated general-purpose video suite you’ll never fully use.' },
  { t: 'AI Gen (Seedance) is the lowest-cost AI engine', d: 'You choose the engine. The cheapest AI tier, AI Gen / Seedance, runs at 40 credits per video — premium engines like Kling cost more, but you only reach for them when you actually want to.' },
  { t: 'No camera, no editor, no extra subscriptions', d: 'Script, AI voiceover, footage and captions are all generated in one pass — so the price of a Short is the credits, not a stack of separate tools.' },
  { t: 'Try before you pay anything', d: 'Your first Short is free with no credit card, so you confirm it’s worth it before a single dollar leaves your account.' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'What is the cheapest AI shorts maker?', a: 'ShortsForgeAI is built only for faceless short-form, so it stays cheaper than general-purpose AI video suites. Its lowest-cost AI engine, AI Gen (Seedance), generates a full Short at 40 credits per video, and your first Short is free with no credit card. See current plans on the pricing page.' },
  { q: 'How do I make AI YouTube Shorts cheap?', a: 'Type a single idea, choose the AI Gen (Seedance) engine — the cheapest AI tier at 40 credits per video — and download a finished 9:16 Short with script, AI voiceover, footage and captions in about 60 seconds. No camera and no editing app to pay for separately.' },
  { q: 'Is there an affordable faceless shorts AI that builds the video from just a topic?', a: 'Yes. ShortsForgeAI generates the entire video from one topic — it writes the script, records the AI voiceover, matches footage to each line and adds captions. It’s made for faceless creators who start with nothing but an idea, so you never film anything.' },
  { q: 'Why is the cheapest AI YouTube Shorts generator not just a clip cutter?', a: 'Clip cutters like OpusClip or Submagic re-clip a long video you already filmed — useless if you’re faceless and starting from scratch. ShortsForgeAI creates the video from an idea, so the low price gets you a finished Short, not chopped-up footage.' },
  { q: 'Do I have to use the most expensive AI engine?', a: 'No. You pick the engine per video. AI Gen (Seedance) is the cheapest AI engine at 40 credits per video and is the default for most creators; premium engines cost more credits and are optional.' },
  { q: 'Can I really make a Short for free first?', a: 'Yes. Your first Short is free and requires no credit card, so you can see the quality and the workflow before choosing a paid plan on the pricing page.' },
]

export default function CheapestAiShortsMakerPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  const h2: CSSProperties = { fontSize: 'clamp(1.3rem, 3.5vw, 1.7rem)', fontWeight: 800, margin: '44px 0 12px' }
  const p: CSSProperties = { fontSize: '1rem', color: '#9D96B8', lineHeight: 1.65, margin: '0 0 12px' }
  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '64px 20px 88px' }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)', borderRadius: 999, padding: '6px 12px' }}>
          Cheapest AI Shorts Maker
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.12, margin: '18px 0 0' }}>
          The Cheapest AI Shorts Maker That Builds the Whole Video
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#C9C4DE', lineHeight: 1.6, margin: '16px 0 0' }}>
          ShortsForgeAI is an affordable, faceless AI YouTube Shorts generator that turns a single idea into a finished Short — the hook and script, an AI voiceover, footage matched to every line, and captions. Its cheapest AI engine, AI Gen (Seedance), runs at 40 credits per video, and your first Short is free with no credit card. A ready-to-post 9:16 video in about 60 seconds. No camera, no editing, no timeline.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <Link href="/start" style={{ background: '#8B5CF6', color: '#fff', fontWeight: 800, padding: '14px 26px', borderRadius: 12, textDecoration: 'none' }}>Make your first Short free →</Link>
          <Link href="/pricing" style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#F1F5F9', fontWeight: 700, padding: '14px 22px', borderRadius: 12, textDecoration: 'none' }}>See pricing</Link>
        </div>
        <p style={{ fontSize: 13, color: '#34D399', fontWeight: 700, margin: '12px 0 0' }}>
          🎁 First Short free · No credit card · AI Gen engine from 40 credits/video
        </p>

        <h2 style={h2}>Make AI YouTube Shorts cheap in 3 steps</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: 'flex', gap: 14, background: '#101016', border: '1px solid #1f1f27', borderRadius: 14, padding: '16px 18px' }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(139,92,246,0.18)', color: '#C4B5FD', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{s.n}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{s.t}</div>
                <div style={{ fontSize: 14, color: '#9D96B8', marginTop: 3, lineHeight: 1.55 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Why it’s the cheaper way to make Shorts</h2>
        <p style={p}>
          You’re not buying a general-purpose AI video suite and using a fraction of it. ShortsForgeAI does one thing — turn an idea into a faceless Short — and lets you pick the lowest-cost engine for the job.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {WHY_CHEAPER.map((w) => (
            <div key={w.t} style={{ background: '#101016', border: '1px solid #1f1f27', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{w.t}</div>
              <div style={{ fontSize: 14, color: '#9D96B8', marginTop: 6, lineHeight: 1.6 }}>{w.d}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>An affordable faceless shorts AI — not a clip cutter</h2>
        <p style={p}>
          Most “AI Shorts” tools (OpusClip, Submagic, Klap) take a long video you already filmed and chop it into clips. That’s useless if you’re faceless and starting from just an idea. ShortsForgeAI works the other way around: it <strong style={{ color: '#F1F5F9' }}>creates the entire video from a topic</strong> — so the low price gets you a finished Short, not chopped-up footage, and you never need source video, a camera, or an editing app. Want the full breakdown of that workflow? See <Link href="/youtube-shorts-from-topic" style={{ color: '#C4B5FD' }}>making a YouTube Short from a topic</Link>.
        </p>

        <h2 style={h2}>Pick the cheapest engine — pay only when you scale up</h2>
        <p style={p}>
          Every video lets you choose the engine. <strong style={{ color: '#F1F5F9' }}>AI Gen (Seedance) is the lowest-cost AI tier at 40 credits per video</strong> and is all most creators need to ship daily Shorts in money, mystery, geography and finance niches. Premium engines like Kling exist for when you want them — but they’re optional, so you’re never forced into the expensive path. Compare the full plans on the <Link href="/pricing" style={{ color: '#C4B5FD' }}>pricing page</Link>, or see how it stacks up against other tools under <Link href="/alternatives" style={{ color: '#C4B5FD' }}>alternatives</Link>.
        </p>

        <h2 style={h2}>Frequently asked questions</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((f) => (
            <div key={f.q} style={{ background: '#101016', border: '1px solid #1f1f27', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#F1F5F9' }}>{f.q}</div>
              <div style={{ fontSize: 14, color: '#9D96B8', marginTop: 6, lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 44, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.18), #0c0c12 70%)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 18, padding: '34px 22px' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900 }}>Make an AI Short for cheap — the first one’s free.</div>
          <p style={{ color: '#9D96B8', margin: '8px 0 18px' }}>One idea in, a ready-to-post Short out. No credit card.</p>
          <Link href="/start" style={{ background: '#8B5CF6', color: '#fff', fontWeight: 800, padding: '14px 30px', borderRadius: 12, textDecoration: 'none' }}>Make my first Short →</Link>
        </div>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}
