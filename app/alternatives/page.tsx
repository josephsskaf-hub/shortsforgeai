// Index/hub page for /alternatives — fixes a 404: app/ai-shorts-without-filming/page.tsx
// and app/cheapest-ai-shorts-maker/page.tsx both link to href="/alternatives" but no page
// existed at that route. This page lists every /alternatives/[competitor] comparison page
// (OpusClip, InVideo, Submagic, HeyGen, Pika, Fliki, Revid, Crayo, AutoShorts, Klap, Quso,
// CapCut, Pictory, VEED, Vizard, Descript, Synthesia, Canva, Kapwing, Runway, Synthesys,
// D-ID, SendShort, Luma Dream Machine, BigMotion AI, Faceless.so, Faceless.video) so users
// and search engines can reach them from one
// place. Data is sourced from the same COMPETITORS object the dynamic route uses, so this
// page never drifts out of sync when new competitors are added.
import type { Metadata } from 'next'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import { COMPETITORS, COMPETITOR_SLUGS } from './[competitor]/page'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Kineo Alternatives — Compare Kineo to Other AI Video Tools',
  description:
    'See how Kineo compares to every major AI video tool — OpusClip, InVideo, HeyGen, Synthesia, CapCut, Runway, Luma and more. Kineo turns one idea into a finished faceless YouTube Short in about 60 seconds, starting at $9.90/mo, first Short free.',
  alternates: { canonical: 'https://www.shortsforgeai.com/alternatives' },
  openGraph: {
    title: 'Kineo Alternatives — Compare Kineo to Other AI Video Tools',
    description:
      'Honest, feature-by-feature comparisons between Kineo and the other AI video/Shorts tools — repurposing tools, avatar generators, text-to-video and generative clip models.',
    url: 'https://www.shortsforgeai.com/alternatives',
    type: 'website',
  },
}

const CARD = { background: '#161618', border: '1px solid #2a2a2d' }

export default function AlternativesIndexPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          ⚡ Kineo
        </Link>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', borderRadius: 999, padding: '6px 14px' }}>
            Alternatives
          </div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.15, margin: '16px 0 0' }}>
            Kineo alternatives — compare us to other AI video tools
          </h1>
          <p style={{ fontSize: '1.02rem', color: '#86868b', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 660 }}>
            Kineo turns a single topic or idea into a finished, faceless YouTube Short — script, AI voiceover, matched footage and captions — in about 60 seconds. It’s not a re-clipper. Pick a tool below to see an honest, feature-by-feature comparison, including when the other tool is actually the better fit.
          </p>
          <Link
            href="/start"
            style={{ display: 'inline-block', marginTop: 22, background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 980, textDecoration: 'none', fontSize: '1.05rem' }}
          >
            Try Kineo free →
          </Link>
          <p style={{ fontSize: '0.82rem', color: '#86868b', margin: '10px 0 0' }}>
            First Short free · no credit card · from <b style={{ color: '#2997ff' }}>$9.90/mo</b>
          </p>
        </section>

        {/* Grid of comparison cards */}
        <section style={{ marginTop: 52 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 20px' }}>
            {COMPETITOR_SLUGS.length} comparisons
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {COMPETITOR_SLUGS.map((slug) => {
              const c = COMPETITORS[slug]
              return (
                <Link
                  key={slug}
                  href={`/alternatives/${slug}`}
                  style={{ ...CARD, display: 'block', borderRadius: 16, padding: '18px 20px', textDecoration: 'none', color: 'inherit', transition: 'border-color .15s' }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#2997ff' }}>
                    vs {c.name}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.02rem', margin: '8px 0 6px', color: '#f5f5f7' }}>
                    Kineo alternative to {c.name}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#86868b', lineHeight: 1.55 }}>
                    {c.theyDo}
                  </p>
                  <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#2997ff', fontWeight: 700 }}>
                    Compare →
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 48, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Make your first faceless Short free</h2>
          <p style={{ color: '#86868b', margin: '8px 0 18px', fontSize: '0.95rem' }}>One idea in, a ready-to-post Short out. No editing, no credit card.</p>
          <Link
            href="/start"
            style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Start free →
          </Link>
        </section>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}
