// SEO hub page — owns the high-intent "make a YouTube Short from a topic /
// from a script / cheapest" buyer cluster that no competitor targets.
// Static page; added to sitemap. FAQ JSON-LD for rich results.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'

export const metadata: Metadata = {
  title: 'Make a YouTube Short From a Topic — AI Writes, Voices & Edits It | Kineo',
  description:
    'Type a topic and get a finished faceless YouTube Short — script, AI voiceover, footage and captions, generated in about 60 seconds. The cheapest way to make Shorts from just an idea, from $9.90/mo.',
  alternates: { canonical: 'https://www.shortsforgeai.com/youtube-shorts-from-topic' },
  openGraph: {
    title: 'Make a YouTube Short From a Topic — generated in 60 seconds',
    description:
      'One topic in, a ready-to-post 9:16 Short out: script, voiceover, footage and captions. From $9.90/mo.',
    url: 'https://www.shortsforgeai.com/youtube-shorts-from-topic',
    type: 'website',
  },
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '1', t: 'Type a topic (or paste a script)', d: 'One sentence is enough — "the island too dangerous to visit", "how compound interest works". Or paste your own script and it narrates it word-for-word.' },
  { n: '2', t: 'AI builds the whole video', d: 'It writes a hook-first script, generates the voiceover, finds footage matched to each line, and burns in captions — automatically.' },
  { n: '3', t: 'Download a ready-to-post Short', d: 'A finished 9:16 video for YouTube Shorts, TikTok and Reels in about 60 seconds. No editor, no timeline.' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'Is there an AI that makes a YouTube Short from just a topic?', a: 'Yes. Kineo turns a single topic into a finished faceless Short — it writes the script, records the AI voiceover, finds matching footage and adds captions, then renders a ready-to-post 9:16 video in about 60 seconds. You never film anything.' },
  { q: 'Can I make a YouTube Short from a script, narrated word-for-word?', a: 'Yes. Paste your own script and Kineo narrates it verbatim, matches footage to each line and captions it — no editing or timeline required.' },
  { q: 'What is the cheapest AI to make YouTube Shorts from an idea?', a: 'Kineo starts at $9.90/month with a 7-day money-back guarantee, and your first Short is free with no credit card. It is built only for faceless short-form, so it undercuts general-purpose AI video tools.' },
  { q: 'How is this different from OpusClip or Submagic?', a: 'OpusClip and Submagic re-clip or caption a long video you already filmed. Kineo generates the entire video from a topic — ideal for faceless creators who start with nothing but an idea.' },
  { q: 'Do I need any editing skills?', a: 'No. There is no timeline to learn. You type a topic (or paste a script) and download a finished 9:16 Short ready to post on YouTube, TikTok and Reels.' },
]

export default function YouTubeShortsFromTopicPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  const h2: CSSProperties = { fontSize: 'clamp(1.3rem, 3.5vw, 1.7rem)', fontWeight: 800, margin: '44px 0 12px' }
  const p: CSSProperties = { fontSize: '1rem', color: '#86868b', lineHeight: 1.65, margin: '0 0 12px' }
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '64px 20px 88px' }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2997ff', border: '1px solid rgba(41,151,255,0.4)', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 12px' }}>
          AI YouTube Shorts Generator
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.12, margin: '18px 0 0' }}>
          Turn Any Topic Into a Finished YouTube Short
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#86868b', lineHeight: 1.6, margin: '16px 0 0' }}>
          Type one topic — or paste a script — and Kineo generates the whole faceless Short for you: the hook and script, an AI voiceover, footage matched to every line, and captions. A ready-to-post 9:16 video in about 60 seconds. No camera, no editing, no timeline to learn.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <Link href="/generate" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>Make your first Short free →</Link>
          <Link href="/pricing" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>See pricing</Link>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          🎁 First Short free · No credit card · From $9.90/mo · 7-day money-back
        </p>

        <h2 style={h2}>From a topic to a Short in 3 steps</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: 'flex', gap: 14, background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(41,151,255,0.18)', color: '#2997ff', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{s.n}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#f5f5f7' }}>{s.t}</div>
                <div style={{ fontSize: 14, color: '#86868b', marginTop: 3, lineHeight: 1.55 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={h2}>It generates the video — it doesn’t re-clip one</h2>
        <p style={p}>
          Most “AI Shorts” tools (OpusClip, Submagic, Klap) take a long video you already filmed and chop it into clips. That’s useless if you’re faceless and starting from just an idea. Kineo works the other way around: it <strong style={{ color: '#f5f5f7' }}>creates the entire video from a topic</strong> — so you never need source footage, a camera, or an editing app.
        </p>

        <h2 style={h2}>Make Shorts from a topic, a script, or a whole niche</h2>
        <p style={p}>
          Give it a single idea and it writes a viral hook-driven script. Or paste your own script and it narrates it <strong style={{ color: '#f5f5f7' }}>word-for-word</strong>. It’s strongest in the niches that convert best on Shorts — money and billionaire habits, mystery and weird history, geography and extreme places, finance, and quick-learning facts — and it matches specific footage to each line instead of dropping in random stock.
        </p>

        <h2 style={h2}>Frequently asked questions</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((f) => (
            <div key={f.q} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#f5f5f7' }}>{f.q}</div>
              <div style={{ fontSize: 14, color: '#86868b', marginTop: 6, lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 44, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, rgba(41,151,255,0.14), #0c0c0e 70%)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 18, padding: '34px 22px' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900 }}>Type a topic. Get a finished Short.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>Your first one is free — no credit card.</p>
          <Link href="/generate" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Make my first Short →</Link>
        </div>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}
