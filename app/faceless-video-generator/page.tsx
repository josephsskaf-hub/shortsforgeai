import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const CAMPAIGN = 'push66_faceless_video_generator'
const FORM_ID = 'faceless-video-generator-form'
const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[0]
const PUBLICATION_DATE = '2026-07-23T00:00:00.000Z'

const STEPS = [
  ['1', 'Describe one video idea', 'Enter a topic, hook, or complete script. No source video or recorded footage is required.'],
  ['2', 'Generate the complete Short', 'Kineo creates the script, AI voiceover, scene-matched visuals, captions, and pacing.'],
  ['3', 'Watch, download, and post', 'Export a vertical MP4 for YouTube Shorts, TikTok, or Instagram Reels.'],
] as const

const FAQ = [
  {
    q: 'What is a faceless video generator?',
    a: 'A faceless video generator creates a narrated video without requiring the creator to appear on camera. Kineo starts from one topic and builds the script, AI voiceover, vertical visuals, captions, and MP4 export.',
  },
  {
    q: 'Does Kineo need a long video first?',
    a: 'No. Kineo is topic-first, not a long-video clipper. You can start with a sentence, an idea, or your own script.',
  },
  {
    q: 'Can I test the faceless video generator for free?',
    a: 'Yes. New accounts can create, watch, download, and share up to three watermarked Fast videos every 24 hours without a credit card.',
  },
  {
    q: 'How do I remove the Kineo watermark?',
    a: 'Paid plans unlock clean MP4 exports. Starter is $4.90 for the first month and renews at $9.90 per month. The free Fast workflow keeps a Kineo watermark.',
  },
  {
    q: 'Which faceless video formats can I make?',
    a: 'Kineo is designed for 9:16 narrated Shorts, Reels, and TikToks, including mystery, money, history, geography, AI, psychology, facts, and educational formats.',
  },
] as const

export const metadata: Metadata = {
  title: 'Faceless Video Generator From a Prompt - AI Shorts Maker | Kineo',
  description:
    'Generate a complete faceless Short from one prompt: script, AI voiceover, scene-matched visuals, captions, and vertical MP4. Test Fast with no card.',
  alternates: { canonical: `${BASE}/faceless-video-generator` },
  openGraph: {
    title: 'Faceless Video Generator From One Prompt | Kineo',
    description: 'Turn one topic into a finished faceless Short without filming or uploading a long video.',
    url: `${BASE}/faceless-video-generator`,
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
    videos: [{ url: FEATURED_EXAMPLE.videoPath, width: 360, height: 640, type: 'video/mp4' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Faceless Video Generator From One Prompt | Kineo',
    description: 'Create a narrated 9:16 Short from an idea - no camera or source footage.',
    images: [FEATURED_EXAMPLE.posterPath],
  },
}

export default function FacelessVideoGeneratorPage() {
  const h2: CSSProperties = { fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontWeight: 850, margin: '44px 0 12px' }
  const p: CSSProperties = { color: '#86868b', fontSize: '1rem', lineHeight: 1.65, margin: '0 0 12px' }
  const card: CSSProperties = { background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '17px 18px' }
  const signupUrl = `/signup?utm_source=seo&utm_medium=organic&utm_campaign=${CAMPAIGN}&create_intent=fast&intent_campaign=${CAMPAIGN}`

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to create a faceless video from a prompt',
    description: 'Create a finished vertical faceless Short from one topic with Kineo.',
    totalTime: 'PT1M',
    step: STEPS.map(([number, title, description]) => ({
      '@type': 'HowToStep',
      position: Number(number),
      name: title,
      text: description,
      url: `${BASE}/faceless-video-generator#step-${number}`,
    })),
  }
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Kineo',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: `${BASE}/faceless-video-generator`,
    description: 'AI faceless video generator that turns one topic into a narrated vertical Short.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Up to three watermarked Fast videos every 24 hours without a credit card.',
    },
    featureList: [
      'Topic-to-video generation',
      'AI script and voiceover',
      'Scene-matched vertical visuals',
      'Automatic captions',
      '9:16 MP4 export',
    ],
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
    embedUrl: `${BASE}/faceless-video-generator#real-output`,
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 20px 88px' }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2997ff', border: '1px solid rgba(41,151,255,0.4)', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 12px' }}>
          Faceless video generator
        </span>
        <h1 style={{ maxWidth: 760, fontSize: 'clamp(2rem, 5.2vw, 3rem)', fontWeight: 900, lineHeight: 1.08, margin: '18px 0 0' }}>
          Turn One Prompt Into a Finished Faceless Video
        </h1>
        <p style={{ maxWidth: 750, fontSize: '1.08rem', color: '#86868b', lineHeight: 1.65, margin: '16px 0 0' }}>
          Kineo creates the script, AI voiceover, scene-matched visuals, captions, and vertical MP4. Start from an idea instead of filming yourself or uploading a long video.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <OrganicCtaLink href={`#${FORM_ID}`} source={CAMPAIGN} placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 850, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>
            Generate a faceless video
          </OrganicCtaLink>
          <OrganicCtaLink href={signupUrl} source={CAMPAIGN} placement="hero_signup" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 750, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>
            Start free with no card
          </OrganicCtaLink>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 750, margin: '12px 0 0' }}>
          Free Fast videos include a Kineo watermark. Paid plans unlock clean exports.
        </p>

        <TopicGeneratorForm
          campaign={CAMPAIGN}
          source={CAMPAIGN}
          formId={FORM_ID}
          examples={[
            'Why the Door to Hell is still burning',
            'The money habit that quietly keeps people broke',
            'Three places on Earth humans are forbidden to visit',
          ]}
          copy={{
            label: 'What should your faceless video be about?',
            placeholder: 'Type one topic, hook, or complete script',
            submit: 'Create my faceless video',
            examplesLabel: 'Faceless video ideas',
            note: 'Your topic stays attached through signup so Kineo can start the first watermarked Fast video without a card.',
          }}
        />

        <section id="real-output" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 26, alignItems: 'center', marginTop: 38, padding: 22, background: '#101012', border: '1px solid #2a2a2d', borderRadius: 18 }}>
          <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 18, background: '#000' }}>
            <ExampleVideoPlayer slug={FEATURED_EXAMPLE.slug} title={FEATURED_EXAMPLE.title} src={FEATURED_EXAMPLE.videoPath} poster={FEATURED_EXAMPLE.posterPath} placement="faceless_video_generator" version="push66" />
          </div>
          <div>
            <p style={{ margin: '0 0 8px', color: '#2997ff', fontSize: 12, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Real Kineo output
            </p>
            <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.9rem)', fontWeight: 900, lineHeight: 1.2, margin: 0 }}>
              This started with one topic, not a source video.
            </h2>
            <p style={{ ...p, marginTop: 12 }}>{FEATURED_EXAMPLE.description}</p>
            <p style={{ ...p, fontSize: 14 }}>This preview demonstrates the output format, not views, virality, or revenue performance.</p>
          </div>
        </section>

        <h2 style={h2}>How the faceless video workflow works</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {STEPS.map(([number, title, description]) => (
            <div id={`step-${number}`} key={number} style={card}>
              <div style={{ color: '#2997ff', fontSize: 12, fontWeight: 850, letterSpacing: '0.1em' }}>STEP {number}</div>
              <h3 style={{ margin: '7px 0 6px', fontSize: '1.04rem' }}>{title}</h3>
              <p style={{ ...p, fontSize: 14, margin: 0 }}>{description}</p>
            </div>
          ))}
        </div>

        <h2 style={h2}>Generator, clipper, or AI clip model?</h2>
        <div style={{ overflowX: 'auto', border: '1px solid #2a2a2d', borderRadius: 14 }}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', background: '#101012', fontSize: 14 }}>
            <thead>
              <tr>
                {['Workflow', 'Starting input', 'What comes out', 'Best for'].map((heading) => (
                  <th key={heading} style={{ padding: 14, textAlign: 'left', borderBottom: '1px solid #2a2a2d', color: '#f5f5f7' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ color: '#a1a1a6' }}>
              {[
                ['Kineo', 'One topic or script', 'Narrated, captioned 9:16 Short', 'Faceless channels from scratch'],
                ['Long-video clipper', 'An existing long video', 'Selected clips from that footage', 'Podcasts, interviews, webinars'],
                ['AI clip model', 'A visual prompt', 'One short generated scene', 'Individual cinematic shots'],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={cell} style={{ padding: 14, borderBottom: '1px solid #232326', color: index === 0 ? '#f5f5f7' : undefined, fontWeight: index === 0 ? 800 : undefined }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...p, marginTop: 12, fontSize: 14 }}>
          If you already have a long recording, a clipper may be the right tool. If you only have an idea and need the complete narrated Short, use Kineo.
        </p>

        <h2 style={h2}>Transparent free and paid output</h2>
        <p style={p}>
          New accounts can test the complete Fast workflow with up to three watermarked videos every 24 hours and no credit card. Starter costs $4.90 for the first month, then $9.90 per month, and unlocks clean MP4 exports. Cancel anytime.
        </p>
        <p style={p}>
          Compare related workflows: <Link href="/free-ai-shorts-generator" style={{ color: '#2997ff' }}>free AI Shorts generator</Link>, <Link href="/text-to-video-shorts" style={{ color: '#2997ff' }}>text-to-video Shorts</Link>, and <Link href="/alternatives" style={{ color: '#2997ff' }}>Kineo alternatives and comparisons</Link>.
        </p>

        <h2 style={h2}>Frequently asked questions</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((item) => (
            <div key={item.q} style={card}>
              <div style={{ fontWeight: 750, color: '#f5f5f7' }}>{item.q}</div>
              <p style={{ ...p, fontSize: 14, margin: '6px 0 0' }}>{item.a}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 44, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, rgba(41,151,255,0.14), #0c0c0e 70%)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 18, padding: '34px 22px' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.85rem)', fontWeight: 900 }}>Create the first faceless video now.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>One topic, no camera, no source footage, and no card for the Fast test.</p>
          <OrganicCtaLink href={`#${FORM_ID}`} source={CAMPAIGN} placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 850, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>
            Generate my video
          </OrganicCtaLink>
        </div>
      </div>
      <Footer />
    </main>
  )
}
