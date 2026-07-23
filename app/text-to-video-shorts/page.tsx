import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const FORM_ID = 'try-text-to-video'
const CAMPAIGN = 'push58_text_to_video_shorts'
const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[0]
const PUBLICATION_DATE = '2026-07-23T00:00:00.000Z'

const STEPS = [
  {
    n: '1',
    t: 'Paste a topic, hook, or full script',
    d: 'Start from plain text. A single idea works, and a complete script can be narrated word-for-word.',
  },
  {
    n: '2',
    t: 'Kineo builds the Short layers',
    d: 'It creates the hook, voiceover, vertical visuals, pacing, and captions for a finished 9:16 video.',
  },
  {
    n: '3',
    t: 'Download and post',
    d: 'Export an MP4 for YouTube Shorts, TikTok, or Reels. No filming, timeline, or editing app required.',
  },
] as const

const FAQ = [
  {
    q: 'Can AI turn text into a YouTube Short?',
    a: 'Yes. Kineo turns a topic, prompt, or script into a finished vertical Short with script, AI voiceover, visuals, captions, and an MP4 export.',
  },
  {
    q: 'Is this different from clipping a long video?',
    a: 'Yes. Long-video clippers need footage you already recorded. Kineo starts from text, so it is built for faceless creators who do not want to film first.',
  },
  {
    q: 'Can I test it before paying?',
    a: 'Yes. New accounts can create up to 3 watermarked Fast videos every 24 hours without a credit card. Paid plans unlock watermark-free exports and higher quality engines.',
  },
  {
    q: 'Can I paste my own script?',
    a: 'Yes. Paste your own script when you want tighter control. Kineo can keep the narration aligned to the text and assemble the visuals around it.',
  },
] as const

export const metadata: Metadata = {
  title: 'Text to Video Shorts Generator - AI YouTube Shorts From Text | Kineo',
  description:
    'Turn text, a topic, or a script into a finished faceless YouTube Short with AI voiceover, vertical visuals, captions, and MP4 export. Try Fast free with no card.',
  alternates: { canonical: `${BASE}/text-to-video-shorts` },
  openGraph: {
    title: 'Text to Video Shorts Generator - Kineo',
    description:
      'Paste text and generate a finished faceless Short: script, AI voiceover, visuals, captions, and MP4 export.',
    url: `${BASE}/text-to-video-shorts`,
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
    videos: [{ url: FEATURED_EXAMPLE.videoPath, width: 360, height: 640, type: 'video/mp4' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Text to Video Shorts Generator | Kineo',
    description: 'Turn text into a finished faceless YouTube Short with AI voiceover, visuals, and captions.',
    images: [FEATURED_EXAMPLE.posterPath],
  },
}

export default function TextToVideoShortsPage() {
  const signupUrl = `/signup?utm_source=seo&utm_medium=organic&utm_campaign=${CAMPAIGN}&create_intent=fast`
  const h2: CSSProperties = { fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)', fontWeight: 850, margin: '44px 0 12px' }
  const p: CSSProperties = { color: '#86868b', fontSize: '1rem', lineHeight: 1.65, margin: '0 0 12px' }
  const card: CSSProperties = { background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to turn text into a YouTube Short',
    description: 'Use Kineo to turn a topic, prompt, or script into a finished 9:16 Short.',
    totalTime: 'PT1M',
    step: STEPS.map((step) => ({
      '@type': 'HowToStep',
      position: Number(step.n),
      name: step.t,
      text: step.d,
      url: `${BASE}/text-to-video-shorts#step-${step.n}`,
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
    embedUrl: `${BASE}/text-to-video-shorts#real-output`,
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '64px 20px 88px' }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2997ff', border: '1px solid rgba(41,151,255,0.4)', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 12px' }}>
          Text to video shorts
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.85rem)', fontWeight: 900, lineHeight: 1.1, margin: '18px 0 0' }}>
          Turn Text Into a Finished YouTube Short
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#86868b', lineHeight: 1.6, margin: '16px 0 0' }}>
          Paste a topic, prompt, or full script. Kineo turns it into a faceless vertical video with AI voiceover, visuals, captions, and an MP4 export for YouTube Shorts, TikTok, and Reels.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <OrganicCtaLink href={`#${FORM_ID}`} source={CAMPAIGN} placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 850, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>
            Try text to video free
          </OrganicCtaLink>
          <OrganicCtaLink href={signupUrl} source={CAMPAIGN} placement="hero_signup" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 750, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>
            Start with a blank prompt
          </OrganicCtaLink>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 750, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos every 24h. No card required.
        </p>

        <TopicGeneratorForm
          campaign={CAMPAIGN}
          source={CAMPAIGN}
          formId={FORM_ID}
          examples={[
            'Why the Door to Hell is still burning',
            'The money mistake most people repeat',
            'Three facts that make the ocean terrifying',
          ]}
          copy={{
            label: 'What text should become a Short?',
            placeholder: 'Paste a topic, hook, or complete script',
            submit: 'Generate my Short',
            examplesLabel: 'Text to video examples',
            note: 'Your text is carried into signup so you can generate the first watermarked Fast video without a card.',
          }}
        />

        <section id="real-output" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, alignItems: 'center', marginTop: 38, padding: 22, background: '#101012', border: '1px solid #2a2a2d', borderRadius: 18 }}>
          <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 18, background: '#000' }}>
            <ExampleVideoPlayer slug={FEATURED_EXAMPLE.slug} title={FEATURED_EXAMPLE.title} src={FEATURED_EXAMPLE.videoPath} poster={FEATURED_EXAMPLE.posterPath} />
          </div>
          <div>
            <p style={{ margin: '0 0 8px', color: '#2997ff', fontSize: 12, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Real Kineo output
            </p>
            <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.9rem)', fontWeight: 900, lineHeight: 1.2, margin: 0 }}>
              Text in. Vertical video out.
            </h2>
            <p style={{ ...p, marginTop: 12 }}>{FEATURED_EXAMPLE.description}</p>
            <p style={{ ...p, fontSize: 14 }}>This preview demonstrates output format, not views or revenue performance.</p>
          </div>
        </section>

        <h2 style={h2}>How text becomes a Short</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {STEPS.map((s) => (
            <div id={`step-${s.n}`} key={s.n} style={card}>
              <div style={{ color: '#2997ff', fontSize: 12, fontWeight: 850, letterSpacing: '0.1em' }}>STEP {s.n}</div>
              <h3 style={{ margin: '7px 0 6px', fontSize: '1.04rem' }}>{s.t}</h3>
              <p style={{ ...p, fontSize: 14, margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>

        <h2 style={h2}>Built for creators who start from text</h2>
        <p style={p}>
          This is the workflow for faceless channels, explainers, mystery videos, money facts, history clips, and educational Shorts. If you already have a long video, a clipper may be enough. If you only have an idea, Kineo creates the Short from scratch.
        </p>
        <p style={p}>
          For adjacent workflows, compare <Link href="/youtube-shorts-from-topic" style={{ color: '#2997ff' }}>YouTube Shorts from a topic</Link>, <Link href="/ai-shorts-without-filming" style={{ color: '#2997ff' }}>Shorts without filming</Link>, and the <Link href="/cheapest-ai-shorts-maker" style={{ color: '#2997ff' }}>affordable AI Shorts maker</Link> breakdown.
        </p>

        <h2 style={h2}>Frequently asked questions</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((f) => (
            <div key={f.q} style={card}>
              <div style={{ fontWeight: 750, color: '#f5f5f7' }}>{f.q}</div>
              <p style={{ ...p, fontSize: 14, margin: '6px 0 0' }}>{f.a}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 44, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, rgba(41,151,255,0.14), #0c0c0e 70%)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 18, padding: '34px 22px' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.85rem)', fontWeight: 900 }}>Paste text. Get a Short.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>No camera, no editing timeline, no credit card for the free Fast test.</p>
          <OrganicCtaLink href={`#${FORM_ID}`} source={CAMPAIGN} placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 850, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>
            Try my text
          </OrganicCtaLink>
        </div>
      </div>
      <Footer />
    </main>
  )
}
