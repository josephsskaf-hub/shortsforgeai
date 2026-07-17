// SEO hub page — owns the high-intent "make a YouTube Short from a topic /
// from a script / cheapest" buyer cluster that no competitor targets.
// Static page; added to sitemap. FAQ JSON-LD for rich results.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import TopicGeneratorForm from './TopicGeneratorForm'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[0]
const PUBLICATION_DATE = '2026-07-16T00:00:00.000Z'

export const metadata: Metadata = {
  title: 'Make a YouTube Short From a Topic — AI Writes, Voices & Edits It | Kineo',
  description:
    'Type a topic and get a finished faceless YouTube Short — script, AI voiceover, footage and captions. Try up to 3 watermarked Fast videos every 24h; Starter is $4.90 for the first month.',
  alternates: { canonical: 'https://www.usekineo.com/youtube-shorts-from-topic' },
  openGraph: {
    title: 'Make a YouTube Short From a Topic — generated in 60 seconds',
    description:
      'One topic in, a ready-to-post 9:16 Short out: script, voiceover, footage and captions. Try Fast free; Starter is $4.90 for the first month.',
    url: 'https://www.usekineo.com/youtube-shorts-from-topic',
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
    videos: [{ url: FEATURED_EXAMPLE.videoPath, width: 360, height: 640, type: 'video/mp4' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Make a YouTube Short From a Topic | Kineo',
    description: 'Enter one topic, watch a real output preview and create a finished faceless Short.',
    images: [FEATURED_EXAMPLE.posterPath],
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
  { q: 'What is the cheapest AI to make YouTube Shorts from an idea?', a: 'Kineo lets a new account create, download and share up to 3 watermarked Fast videos every 24 hours without a card. Starter costs $4.90 for the first month, then $9.90/month, with a 7-day money-back guarantee.' },
  { q: 'How is this different from OpusClip or Submagic?', a: 'OpusClip and Submagic re-clip or caption a long video you already filmed. Kineo generates the entire video from a topic — ideal for faceless creators who start with nothing but an idea.' },
  { q: 'Do I need any editing skills?', a: 'No. There is no timeline to learn. You type a topic (or paste a script) and download a finished 9:16 Short ready to post on YouTube, TikTok and Reels.' },
]

export default function YouTubeShortsFromTopicPage() {
  const signupUrl = '/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_topic'
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to make a YouTube Short from a topic',
    description: 'Turn one topic into a scripted, voiced, captioned 9:16 Short with Kineo.',
    totalTime: 'PT1M',
    step: STEPS.map((step) => ({
      '@type': 'HowToStep',
      position: Number(step.n),
      name: step.t,
      text: step.d,
      url: `${BASE}/youtube-shorts-from-topic#step-${step.n}`,
    })),
  }
  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: FEATURED_EXAMPLE.title,
    description: FEATURED_EXAMPLE.description,
    thumbnailUrl: [`${BASE}${FEATURED_EXAMPLE.posterPath}`],
    uploadDate: PUBLICATION_DATE,
    duration: `PT${FEATURED_EXAMPLE.previewDurationSeconds}S`,
    contentUrl: `${BASE}${FEATURED_EXAMPLE.videoPath}`,
    embedUrl: `${BASE}/examples/${FEATURED_EXAMPLE.slug}`,
  }
  const h2: CSSProperties = { fontSize: 'clamp(1.3rem, 3.5vw, 1.7rem)', fontWeight: 800, margin: '44px 0 12px' }
  const p: CSSProperties = { fontSize: '1rem', color: '#86868b', lineHeight: 1.65, margin: '0 0 12px' }
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }} />
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
          <OrganicCtaLink href={signupUrl} source="push22_topic" placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>Make a Fast video free →</OrganicCtaLink>
          <Link href="/pricing" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>See pricing</Link>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos / 24h · No card · Starter $4.90 first month
        </p>

        <TopicGeneratorForm />

        <h2 style={h2}>Watch a real topic-to-Short preview</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', width: '100%', maxWidth: 310, aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 24, border: '1px solid #343438', background: '#000' }}>
            <ExampleVideoPlayer
              slug={FEATURED_EXAMPLE.slug}
              title={FEATURED_EXAMPLE.title}
              src={FEATURED_EXAMPLE.videoPath}
              poster={FEATURED_EXAMPLE.posterPath}
              placement="youtube_shorts_from_topic"
              version="push32"
            />
          </div>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2997ff', margin: 0 }}>
              Real Kineo output · 5-second preview
            </p>
            <h3 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.65rem)', lineHeight: 1.2, margin: '10px 0 10px' }}>
              {FEATURED_EXAMPLE.shortTitle}
            </h3>
            <p style={p}>{FEATURED_EXAMPLE.description}</p>
            <p style={{ ...p, fontSize: 14 }}>
              The preview is five seconds cut from a {FEATURED_EXAMPLE.outputDurationSeconds}-second export. It demonstrates the output format, not views or revenue performance.
            </p>
            <Link href={`/examples/${FEATURED_EXAMPLE.slug}`} style={{ color: '#2997ff', fontSize: 14, fontWeight: 800 }}>
              Open the watch page and remix its prompt →
            </Link>
          </div>
        </div>

        <h2 style={h2}>From a topic to a Short in 3 steps</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {STEPS.map((s) => (
            <div id={`step-${s.n}`} key={s.n} style={{ display: 'flex', gap: 14, background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
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
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>Try up to 3 watermarked Fast videos every 24h — no card.</p>
          <OrganicCtaLink href={signupUrl} source="push22_topic" placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Make my Fast video →</OrganicCtaLink>
        </div>
      </div>
      <StickyFreeShortCTA />
      <Footer />
    </main>
  )
}
