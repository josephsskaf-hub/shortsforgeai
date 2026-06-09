// #478 — Programmatic SEO landing pages per niche. Targets long-tail, high-intent
// searches like "free AI [finance] shorts generator" / "faceless [history] video
// maker". Statically generated + in the sitemap so Google indexes them. Each page
// is real content (unique H1, intro, example ideas, how-it-works) + a CTA to
// /signup with niche-tagged UTMs so the funnel dashboard attributes the traffic.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

type Niche = { label: string; h1: string; intro: string; ideas: string[] }

const NICHES: Record<string, Niche> = {
  money: {
    label: 'Money & Finance',
    h1: 'Free AI Money & Finance Shorts Generator',
    intro:
      'Turn any money or finance idea into a ready-to-post YouTube Short in about 60 seconds. The AI writes the script, records the voiceover, adds captions and finds the footage — no filming, no editing, no face on camera.',
    ideas: [
      '$200 a month makes you a millionaire — here’s the exact math',
      'The money habit 90% of millionaires share',
      'Why your savings account is quietly making you poorer',
      '3 assets the rich buy that the middle class ignores',
      'The $850,000 mistake most people make in their 30s',
    ],
  },
  mystery: {
    label: 'Mystery & Unsolved',
    h1: 'Free AI Mystery Shorts Generator',
    intro:
      'Turn any unsolved case or eerie mystery into a binge-worthy YouTube Short in about 60 seconds. The AI writes the script, voices it, adds captions and footage — fully faceless.',
    ideas: [
      'The disappearance nobody solved in 70 years',
      'The signal from space scientists still can’t explain',
      'The island the government bans humans from',
      'The photo that was never supposed to exist',
      'The town that vanished overnight',
    ],
  },
  history: {
    label: 'History',
    h1: 'Free AI History Shorts Generator',
    intro:
      'Turn any historical event into a gripping YouTube Short in about 60 seconds — script, voiceover, captions and footage generated automatically. No editing skills needed.',
    ideas: [
      'Why ancient Rome collapsed in 5 steps',
      'The empire that fell in a single day',
      'The invention that accidentally changed the world',
      'The war that lasted 38 minutes',
      'What daily life was really like 2,000 years ago',
    ],
  },
  motivation: {
    label: 'Motivation & Mindset',
    h1: 'Free AI Motivation Shorts Generator',
    intro:
      'Turn any mindset or discipline idea into a punchy, shareable YouTube Short in about 60 seconds. The AI handles the script, voiceover, captions and visuals — you just pick the idea.',
    ideas: [
      'The 5am habit that rewires your brain',
      'Why discipline beats motivation every time',
      'The 1% rule that compounds into everything',
      'How top performers think differently',
      'The uncomfortable truth about success',
    ],
  },
  facts: {
    label: 'Mind-Blowing Facts',
    h1: 'Free AI Facts Shorts Generator',
    intro:
      'Turn any surprising fact into a scroll-stopping YouTube Short in about 60 seconds. The AI writes, voices, captions and sources the footage automatically — completely faceless.',
    ideas: [
      'The everyday object that’s secretly 1,000 years old',
      'Your body does this 100,000 times a day without you noticing',
      'The animal that’s technically immortal',
      'Why the ocean floor is more mysterious than space',
      'The number that breaks human intuition',
    ],
  },
  ai: {
    label: 'AI & Tech',
    h1: 'Free AI Tech Shorts Generator',
    intro:
      'Turn any AI or tech topic into a timely YouTube Short in about 60 seconds. Script, voiceover, captions and footage are generated for you — post daily without touching an editor.',
    ideas: [
      'The AI tool replacing 10 jobs right now',
      '5 AI tools that feel illegal to know',
      'How AI will change your job in 2 years',
      'The free AI that does what used to cost $5,000',
      'What most people still don’t understand about AI',
    ],
  },
  geography: {
    label: 'Countries & Places',
    h1: 'Free AI Geography Shorts Generator',
    intro:
      'Turn any country, city or place into a fascinating YouTube Short in about 60 seconds. The AI writes the script, adds the voiceover, captions and footage — no filming required.',
    ideas: [
      'The country where it’s illegal to die',
      'The city built on top of another city',
      'The island where snakes outnumber people',
      'The place where the sun never sets',
      'The tiny country richer than most continents',
    ],
  },
  space: {
    label: 'Space',
    h1: 'Free AI Space Shorts Generator',
    intro:
      'Turn any space topic into a mind-bending YouTube Short in about 60 seconds. The AI writes, voices, captions and finds the footage — fully faceless, ready to post.',
    ideas: [
      'What NASA found on Mars they never announced',
      'The sound a black hole actually makes',
      'Why a day on Venus is longer than its year',
      'The object moving too fast to explain',
      'What’s really at the edge of the universe',
    ],
  },
}

export const NICHE_SLUGS = Object.keys(NICHES)

export function generateStaticParams() {
  return NICHE_SLUGS.map((niche) => ({ niche }))
}

export function generateMetadata({ params }: { params: { niche: string } }): Metadata {
  const n = NICHES[params.niche]
  if (!n) return {}
  const title = `${n.h1} — ShortsForgeAI`
  const description = `${n.intro} Your first Short is free, no credit card required.`
  const url = `https://www.shortsforgeai.com/free-ai-shorts/${params.niche}`
  return {
    metadataBase: new URL('https://www.shortsforgeai.com'),
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }

export default function NicheLandingPage({ params }: { params: { niche: string } }) {
  const n = NICHES[params.niche]
  if (!n) notFound()

  const signupUrl = `/signup?utm_source=seo&utm_medium=niche&utm_campaign=${params.niche}`

  return (
    <main style={{ minHeight: '100vh', background: '#05070D', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          ⚡ ShortsForgeAI
        </Link>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
            {n.h1}
          </h1>
          <p style={{ fontSize: '1.02rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 620 }}>
            {n.intro}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '10px 0 0' }}>
            Script • Voiceover • Captions • Footage • Ready in ~60s · <b style={{ color: '#22D3EE' }}>first one free</b>, no card needed
          </p>
          <Link
            href={signupUrl}
            style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', color: '#05070D', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}
          >
            Generate my free {n.label} Short →
          </Link>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Pick an idea', d: `Type any ${n.label.toLowerCase()} topic — or use one of the ready-made viral ideas below.` },
              { n: '2', t: 'AI builds the video', d: 'The script, voiceover, on-screen captions and footage are generated automatically.' },
              { n: '3', t: 'Download & post', d: 'Get a vertical 9:16 MP4 in about a minute, ready for YouTube Shorts, TikTok or Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(34,211,238,0.12)', color: '#22D3EE', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Niche ideas */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>
            Viral {n.label} ideas to start with
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {n.ideas.map((idea) => (
              <Link key={idea} href={signupUrl} style={{ ...CARD, borderRadius: 12, padding: '14px 16px', textDecoration: 'none', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{idea}</span>
                <span style={{ color: '#22D3EE', fontWeight: 900, whiteSpace: 'nowrap' }}>Make it →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 48, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Make your first {n.label} Short free</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>No script, no voiceover, no editing. No credit card required.</p>
          <Link
            href={signupUrl}
            style={{ display: 'inline-block', background: '#22D3EE', color: '#05070D', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Start free →
          </Link>
        </section>

        <nav style={{ marginTop: 40, textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
          <span>More: </span>
          {NICHE_SLUGS.filter((s) => s !== params.niche).map((s, i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Link href={`/free-ai-shorts/${s}`} style={{ color: '#94A3B8', textDecoration: 'none' }}>{NICHES[s].label}</Link>
            </span>
          ))}
        </nav>
      </div>
    </main>
  )
}
