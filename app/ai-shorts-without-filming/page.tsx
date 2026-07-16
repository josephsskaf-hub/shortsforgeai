// ROBO2-SEO-2026-06-29c — high-intent SEO page for the "without filming / no camera /
// faceless" buyer cluster (make YouTube Shorts without filming / faceless shorts no
// camera / AI shorts without showing your face / no recording). Honest angle: the
// video is generated from a single idea — script, AI voiceover, footage and captions —
// so you never film, never show your face and never record your voice. Idea-first,
// not a re-clipper (clip cutters still need footage you filmed). Static page; added to
// sitemap. FAQ JSON-LD for rich results. No invented prices: pricing links to /pricing.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'

export const metadata: Metadata = {
  title: 'Make YouTube Shorts Without Filming — Faceless AI Shorts, No Camera | Kineo',
  description:
    'Make faceless YouTube Shorts without filming. Type one idea and get script, AI voiceover, footage and captions. Try up to 3 watermarked Fast videos every 24h, no card.',
  alternates: { canonical: 'https://www.usekineo.com/ai-shorts-without-filming' },
  openGraph: {
    title: 'Make YouTube Shorts without filming — faceless AI, no camera',
    description:
      'Turn one idea into a finished faceless Short: script, AI voiceover, footage and captions. No camera. Try Fast free; Starter is $4.90 for the first month.',
    url: 'https://www.usekineo.com/ai-shorts-without-filming',
    type: 'website',
  },
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '1', t: 'Type one idea — never open a camera', d: 'No footage to upload, nothing to record, no face on screen. One line is enough — "the island too dangerous to visit", "the money habit that quietly makes you broke".' },
  { n: '2', t: 'AI builds every layer for you', d: 'It writes the hook and script, generates an AI voiceover so your own voice stays private, matches footage to each line and burns in captions — all without you filming a single frame.' },
  { n: '3', t: 'Download a ready-to-post Short', d: 'A finished 9:16 video in about 60 seconds. Post it to YouTube, TikTok or Reels exactly as-is — no editor, no timeline, no recording session.' },
]

const NO_NEED: { t: string; d: string }[] = [
  { t: 'No camera', d: 'Nothing to set up, point or buy. The visuals are generated and matched to your script, so there is no shot to capture and no lighting to worry about.' },
  { t: 'No face on screen', d: 'It is built for faceless channels. You never appear, so you can run a channel in money, mystery, geography or finance niches while staying completely anonymous.' },
  { t: 'No recording your voice', d: 'A natural AI voiceover narrates the Short. You do not need a microphone, a quiet room, or to like the sound of your own voice — keep your real voice private.' },
  { t: 'No editing skills', d: 'There is no timeline to learn and no clips to drag around. The script, voiceover, footage and captions are assembled in one pass, so a first-timer ships the same quality as a pro.' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'Can I make YouTube Shorts without filming anything?', a: 'Yes. Kineo builds the entire Short from a single idea — it writes the script, generates an AI voiceover, matches footage to each line and adds captions. You never open a camera, upload footage or record your voice, and a new account can create up to 3 watermarked Fast videos every 24 hours with no card.' },
  { q: 'How do I make faceless Shorts with no camera?', a: 'Type one topic, let the AI generate the script, voiceover, footage and captions, then download a finished 9:16 video in about 60 seconds. Because every visual is generated and matched to your script, there is nothing to film and no camera to own.' },
  { q: 'Will my face or voice ever be shown?', a: 'No. The channel format is faceless by design — you never appear on screen, and the narration is an AI voiceover, so your own voice stays private. It is made for anonymous creators who want a channel without being on camera.' },
  { q: 'Is this just a clip cutter like OpusClip or Submagic?', a: 'No. Clip cutters re-clip a long video you already filmed — which still requires you to record footage first. Kineo works the other way around: it creates the video from an idea, so you start with nothing but a topic and never film at all.' },
  { q: 'Do I need editing skills to make a Short without filming?', a: 'No. There is no timeline and no clips to arrange. The script, AI voiceover, footage and captions are generated and assembled automatically, so you get a ready-to-post Short without touching an editor.' },
  { q: 'How much does it cost to make Shorts without filming?', a: 'A new account can create up to 3 watermarked Fast videos every 24 hours with no credit card. Paid plans unlock clean exports and premium AI engines; Starter is $4.90 for the first month and then $9.90/month.' },
]

export default function AiShortsWithoutFilmingPage() {
  const signupUrl = '/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_no_filming'
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
          Shorts Without Filming
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.12, margin: '18px 0 0' }}>
          Make YouTube Shorts Without Filming a Single Frame
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#86868b', lineHeight: 1.6, margin: '16px 0 0' }}>
          Kineo turns one idea into a finished faceless Short — the hook and script, an AI voiceover, footage matched to every line, and captions. No camera, no face on screen, no recording your voice. A ready-to-post 9:16 video in about 60 seconds. Create up to 3 watermarked Fast videos every 24 hours with no card.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <OrganicCtaLink href={signupUrl} source="push22_no_filming" placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>Make a Fast video free →</OrganicCtaLink>
          <Link href="/pricing" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>See pricing</Link>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos / 24h · No card · No camera
        </p>

        <h2 style={h2}>Make a faceless Short without filming in 3 steps</h2>
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

        <h2 style={h2}>What you never need</h2>
        <p style={p}>
          A faceless Short usually means stitching together stock clips, recording a voiceover and fighting an editor. Kineo removes every one of those steps — here is what you can leave behind.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {NO_NEED.map((w) => (
            <div key={w.t} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#f5f5f7' }}>{w.t}</div>
              <div style={{ fontSize: 14, color: '#86868b', marginTop: 6, lineHeight: 1.6 }}>{w.d}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Idea-first — not a clip cutter</h2>
        <p style={p}>
          Most “AI Shorts” tools (OpusClip, Submagic, Klap) re-clip a long video you already filmed — which still means recording footage first. That is the opposite of filming nothing. Kineo <strong style={{ color: '#f5f5f7' }}>creates the entire video from a topic</strong>, so you start with just an idea and never capture a frame. See the full breakdown of <Link href="/youtube-shorts-from-topic" style={{ color: '#2997ff' }}>making a YouTube Short from a topic</Link>, or how it compares under <Link href="/alternatives" style={{ color: '#2997ff' }}>alternatives</Link>.
        </p>

        <h2 style={h2}>Stay anonymous, ship daily</h2>
        <p style={p}>
          Because you never appear and never record your voice, you can run a faceless channel in money, mystery, geography or finance niches while staying completely private. Pick the engine per video — <strong style={{ color: '#f5f5f7' }}>AI Gen (Seedance) is the lowest-cost AI engine</strong> and is all most creators need to post every day. Looking for the most affordable path? See the <Link href="/cheapest-ai-shorts-maker" style={{ color: '#2997ff' }}>cheapest AI shorts maker</Link> breakdown, or compare plans on the <Link href="/pricing" style={{ color: '#2997ff' }}>pricing page</Link>.
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
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900 }}>Make up to 3 watermarked Fast videos every 24h.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>One idea in, a ready-to-post Short out. No camera, no card.</p>
          <OrganicCtaLink href={signupUrl} source="push22_no_filming" placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Make my Fast video →</OrganicCtaLink>
        </div>
      </div>
      <StickyFreeShortCTA />
      <Footer />
    </main>
  )
}
