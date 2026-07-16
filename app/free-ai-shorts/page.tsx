import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import { NICHE_SLUGS } from './[niche]/page'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Free AI Shorts Generator by Niche — 14 Faceless Formats | Kineo',
  description:
    'Pick a niche and turn one idea into a complete faceless Short with script, voice, footage and captions. Create up to 3 watermarked Fast videos every 24h, no card.',
  alternates: { canonical: 'https://www.usekineo.com/free-ai-shorts' },
  openGraph: {
    title: 'Free AI Shorts Generator by Niche | Kineo',
    description: '14 faceless Shorts formats with ready-to-use ideas. Up to 3 watermarked Fast videos every 24h, no card.',
    url: 'https://www.usekineo.com/free-ai-shorts',
    type: 'website',
  },
}

const SIGNUP_URL = '/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_niche_hub'
const CARD = { background: '#161618', border: '1px solid #2a2a2d' }

const NICHE_CARDS: Record<string, { label: string; title: string; example: string }> = {
  money: { label: 'Money & Finance', title: 'Money & Finance Shorts', example: 'The money habit most millionaires share' },
  mystery: { label: 'Mystery & Unsolved', title: 'Mystery Shorts', example: 'The disappearance nobody solved in 70 years' },
  history: { label: 'History', title: 'History Shorts', example: 'The war that lasted only 38 minutes' },
  motivation: { label: 'Motivation & Mindset', title: 'Motivation Shorts', example: 'Why discipline beats motivation every time' },
  facts: { label: 'Mind-Blowing Facts', title: 'Facts Shorts', example: 'The animal that is technically immortal' },
  ai: { label: 'AI & Tech', title: 'AI & Tech Shorts', example: 'The AI tool that replaces a full workflow' },
  geography: { label: 'Countries & Places', title: 'Geography Shorts', example: 'The country where it is illegal to die' },
  space: { label: 'Space', title: 'Space Shorts', example: 'What happens if you fall into a black hole' },
  truecrime: { label: 'True Crime', title: 'True Crime Shorts', example: 'The clue detectives missed for decades' },
  psychology: { label: 'Psychology', title: 'Psychology Shorts', example: 'The bias quietly changing every decision' },
  sports: { label: 'Sports', title: 'Sports Shorts', example: 'The record experts thought was impossible' },
  science: { label: 'Science', title: 'Science Shorts', example: 'The experiment that changed what we know' },
  conspiracy: { label: 'Conspiracy & Secrets', title: 'Conspiracy Shorts', example: 'The document that stayed classified for decades' },
  luxury: { label: 'Luxury & Billionaires', title: 'Luxury Shorts', example: 'What a superyacht really costs every day' },
}

const FAQ = [
  {
    q: 'Can I create an AI Short for free?',
    a: 'Yes. A new Kineo account can create, watch, download and share up to 3 watermarked Fast videos every 24 hours without a credit card. Paid plans unlock clean exports and premium AI engines.',
  },
  {
    q: 'Which faceless niche should I start with?',
    a: 'Choose a niche you can publish consistently. Money, AI and psychology can attract higher-value audiences; mystery, facts, geography and space are broad, visual formats that are easier to repeat.',
  },
  {
    q: 'Does Kineo only write the script?',
    a: 'No. Kineo turns the idea into the finished 9:16 video: hook-first script, AI voiceover, footage matched to the narration and captions.',
  },
]

export default function FreeAiShortsHubPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 70px' }}>
        <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          ⚡ Kineo
        </Link>

        <section style={{ marginTop: 38, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 999, padding: '6px 14px' }}>
            Free AI Shorts by niche
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, margin: '18px auto 0', maxWidth: 760 }}>
            Pick a niche. Turn one idea into a finished Short.
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#86868b', lineHeight: 1.65, margin: '16px auto 0', maxWidth: 680 }}>
            Choose one of 14 repeatable faceless formats. Kineo writes the hook and script, records the AI voice, matches footage to every line and adds captions — ready for Shorts, TikTok or Reels.
          </p>
          <OrganicCtaLink
            href={SIGNUP_URL}
            source="push22_niche_hub"
            placement="hero"
            style={{ display: 'inline-block', marginTop: 24, background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Make a Fast video free →
          </OrganicCtaLink>
          <p style={{ fontSize: '0.82rem', color: '#86868b', margin: '10px 0 0' }}>
            Up to 3 watermarked Fast videos / 24h · no card · Starter $4.90 first month
          </p>
        </section>

        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, textAlign: 'center', margin: '0 0 20px' }}>
            14 formats with ideas ready to generate
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
            {NICHE_SLUGS.map((slug) => {
              const niche = NICHE_CARDS[slug]
              return (
                <Link key={slug} href={`/free-ai-shorts/${slug}`} style={{ ...CARD, display: 'block', borderRadius: 16, padding: '18px 20px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2997ff' }}>
                    {niche.label}
                  </div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '8px 0 7px' }}>{niche.title}</h2>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#86868b', lineHeight: 1.55 }}>
                    {niche.example}
                  </p>
                  <div style={{ marginTop: 12, color: '#2997ff', fontSize: '0.84rem', fontWeight: 800 }}>See 5 ideas →</div>
                </Link>
              )
            })}
          </div>
        </section>

        <section style={{ marginTop: 50 }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>Questions, answered</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {FAQ.map((item) => (
              <div key={item.q} style={{ ...CARD, borderRadius: 14, padding: '17px 19px' }}>
                <h3 style={{ fontSize: '0.98rem', margin: 0 }}>{item.q}</h3>
                <p style={{ margin: '7px 0 0', color: '#86868b', fontSize: '0.88rem', lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 46, textAlign: 'center', ...CARD, borderRadius: 18, padding: '30px 20px' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0 }}>Start with one idea, not a blank timeline.</h2>
          <p style={{ color: '#86868b', margin: '9px 0 18px' }}>Try Fast free. Upgrade only when you want a clean export or premium AI scenes.</p>
          <OrganicCtaLink
            href={SIGNUP_URL}
            source="push22_niche_hub"
            placement="final"
            style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}
          >
            Start free →
          </OrganicCtaLink>
        </section>
      </div>
      <Footer />
    </main>
  )
}
