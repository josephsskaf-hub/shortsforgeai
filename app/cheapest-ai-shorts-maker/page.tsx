// KINEO-REBASE-2026-07-10 — 2:1 credit rebase: every "40 credits" → 20 (Seedance).
// ROBO2-SEO-2026-06-28 — high-intent SEO page for the "cheapest AI shorts maker"
// buyer cluster (cheapest AI YouTube Shorts generator / affordable faceless shorts AI /
// make AI YouTube Shorts cheap). Honest angle: a local-currency calculator uses
// the real plan credits and prices; Fast is 1 credit, Seedance 20, Kling 50;
// visitors can test Fast without a card. Generates from a topic, not a re-clipper.
// Static page; added to sitemap. FAQ JSON-LD for rich results.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'
import ShortCostCalculator from './ShortCostCalculator'

const CALCULATOR_CAMPAIGN = 'push77_short_cost_calculator'
const CALCULATOR_FORM_ID = 'try-costed-workflow'
const CALCULATOR_EXAMPLES = [
  'The island nobody is allowed to visit',
  'The money habit that quietly keeps people broke',
  'Why the Door to Hell is still burning',
] as const

export const metadata: Metadata = {
  title: 'Affordable AI Shorts Maker — 3 Fast Videos Every 24h | Kineo',
  description:
    'Calculate the local cost per AI Short by visual engine and monthly volume. Then build a complete faceless video from one idea and test Fast Mode free.',
  alternates: { canonical: 'https://www.usekineo.com/cheapest-ai-shorts-maker' },
  openGraph: {
    title: 'Cheapest AI Shorts Maker — make AI YouTube Shorts cheap',
    description:
      'Calculate your local cost per Short, compare Fast, Seedance and Kling, then test a complete faceless video from one idea free.',
    url: 'https://www.usekineo.com/cheapest-ai-shorts-maker',
    type: 'website',
  },
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '1', t: 'Type one idea or topic', d: 'No source footage, no long video to re-clip. One line is enough — "the island too dangerous to visit", "how compound interest works".' },
  { n: '2', t: 'Pick the right-cost visual engine', d: 'Fast Mode costs 1 credit per video. AI Generated uses 20 credits for original Seedance scenes, while Cinematic uses 50 credits for premium Kling scenes.' },
  { n: '3', t: 'Download a ready-to-post Short', d: 'A finished 9:16 video — script, AI voiceover, footage matched to each line and captions — usually in 2–4 minutes. No editor, no timeline.' },
]

const WHY_CHEAPER: { t: string; d: string }[] = [
  { t: 'Built only for faceless Shorts', d: 'It does one job — turn an idea into a short-form video — so you’re not paying for a bloated general-purpose video suite you’ll never fully use.' },
  { t: 'Start at 1 credit with Fast Mode', d: 'You choose the engine. Fast Mode uses matched stock footage for 1 credit per video. Original AI Generated scenes use 20 credits, while premium Cinematic scenes use 50.' },
  { t: 'No camera, no editor, no extra subscriptions', d: 'Script, AI voiceover, footage and captions are all generated in one pass — so the price of a Short is the credits, not a stack of separate tools.' },
  { t: 'Try before you pay anything', d: 'Create, watch, download and share up to 3 watermarked Fast videos every 24 hours with no credit card, so you can confirm the workflow fits before paying.' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'What is the cheapest AI shorts maker?', a: 'The answer depends on visual engine and monthly volume. Kineo Fast Mode uses 1 credit per complete faceless Short, while AI Generated uses 20 and Cinematic uses 50. A new account can test up to 3 watermarked Fast videos every 24 hours without a card; the calculator on this page uses the current local subscription prices.' },
  { q: 'How do I make AI YouTube Shorts cheap?', a: 'Type a single idea, choose Fast Mode for the lowest-cost workflow, and download a finished 9:16 Short with script, AI voiceover, matched footage and captions, usually in 2–4 minutes. No camera and no editing app to pay for separately.' },
  { q: 'Is there an affordable faceless shorts AI that builds the video from just a topic?', a: 'Yes. Kineo generates the entire video from one topic — it writes the script, records the AI voiceover, matches footage to each line and adds captions. It’s made for faceless creators who start with nothing but an idea, so you never film anything.' },
  { q: 'Why is the cheapest AI YouTube Shorts generator not just a clip cutter?', a: 'Clip cutters like OpusClip or Submagic re-clip a long video you already filmed — useless if you’re faceless and starting from scratch. Kineo creates the video from an idea, so the low price gets you a finished Short, not chopped-up footage.' },
  { q: 'Do I have to use the most expensive AI engine?', a: 'No. You pick the engine per video. Fast Mode uses 1 credit with matched stock footage, AI Generated uses 20 credits for Seedance scenes, and Cinematic uses 50 credits for premium Kling scenes.' },
  { q: 'Can I really make a Short for free first?', a: 'Yes. A new account can create, download and share up to 3 watermarked Fast videos every 24 hours without a credit card. Paid plans unlock clean exports and premium AI engines.' },
]

export default function CheapestAiShortsMakerPage() {
  const signupUrl = '/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_cheapest'
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
          Cheapest AI Shorts Maker
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.12, margin: '18px 0 0' }}>
          The Cheapest AI Shorts Maker That Builds the Whole Video
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#86868b', lineHeight: 1.6, margin: '16px 0 0' }}>
          Kineo is an affordable, faceless AI YouTube Shorts generator that turns a single idea into a finished Short — the hook and script, an AI voiceover, footage matched to every line, and captions. Try up to 3 watermarked Fast videos every 24 hours with no card. The calculator below shows the local first-month and renewal price. No camera, no editing, no timeline.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <OrganicCtaLink href={signupUrl} source="push22_cheapest" placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>Make a Fast video free →</OrganicCtaLink>
          <Link href="/pricing" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>See pricing</Link>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos / 24h · Local prices matched to Checkout
        </p>

        <ShortCostCalculator />

        <TopicGeneratorForm
          campaign={CALCULATOR_CAMPAIGN}
          source={CALCULATOR_CAMPAIGN}
          examples={CALCULATOR_EXAMPLES}
          formId={CALCULATOR_FORM_ID}
          copy={{
            label: 'What should your first cost-tested Short be about?',
            placeholder: 'Type one topic or paste your script',
            submit: 'Create this Short free →',
            examplesLabel: 'Low-cost topic examples',
            note: 'Your topic stays attached through signup. Fast Mode creates a complete watermarked test without a card.',
          }}
        />

        <h2 style={h2}>Make AI YouTube Shorts cheap in 3 steps</h2>
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

        <h2 style={h2}>Why it’s the cheaper way to make Shorts</h2>
        <p style={p}>
          You’re not buying a general-purpose AI video suite and using a fraction of it. Kineo does one thing — turn an idea into a faceless Short — and lets you pick the lowest-cost engine for the job.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {WHY_CHEAPER.map((w) => (
            <div key={w.t} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, color: '#f5f5f7' }}>{w.t}</div>
              <div style={{ fontSize: 14, color: '#86868b', marginTop: 6, lineHeight: 1.6 }}>{w.d}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>An affordable faceless shorts AI — not a clip cutter</h2>
        <p style={p}>
          Most “AI Shorts” tools (OpusClip, Submagic, Klap) take a long video you already filmed and chop it into clips. That’s useless if you’re faceless and starting from just an idea. Kineo works the other way around: it <strong style={{ color: '#f5f5f7' }}>creates the entire video from a topic</strong> — so the low price gets you a finished Short, not chopped-up footage, and you never need source video, a camera, or an editing app. Want the full breakdown of that workflow? See <Link href="/youtube-shorts-from-topic" style={{ color: '#2997ff' }}>making a YouTube Short from a topic</Link>.
        </p>

        <h2 style={h2}>Pick the right engine — pay only when you scale up</h2>
        <p style={p}>
          Every video lets you choose the engine. <strong style={{ color: '#f5f5f7' }}>Fast Mode uses 1 credit, AI Generated uses 20, and Cinematic uses 50</strong>. Start with the stock-footage workflow when cost matters most, then use original Seedance or premium Kling scenes only when the creative needs them. Compare the full plans on the <Link href="/pricing" style={{ color: '#2997ff' }}>pricing page</Link>, or see how it stacks up against other tools under <Link href="/alternatives" style={{ color: '#2997ff' }}>alternatives</Link>.
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
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>One idea in, a ready-to-post Short out. No credit card.</p>
          <OrganicCtaLink href={signupUrl} source="push22_cheapest" placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Make my Fast video →</OrganicCtaLink>
        </div>
      </div>
      <StickyFreeShortCTA />
      <Footer />
    </main>
  )
}
