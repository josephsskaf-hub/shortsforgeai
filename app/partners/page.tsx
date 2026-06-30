// #486 — Public affiliate-recruiting landing. The page every outreach links to.
// Explains the 40% recurring deal, free account, earnings, and how to start.
// Primary CTA = apply via hello@ (routes into the onboarding flow: we grant the
// free account + issue the Rewardful link). Static, in sitemap for SEO.
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'Affiliate Program — Earn 40% Recurring | Kineo',
  description:
    'Promote Kineo and earn 40% recurring commission, forever, with a 60-day cookie. Free account included. The AI tool that turns one idea into a finished faceless Short in 60s.',
  alternates: { canonical: 'https://www.shortsforgeai.com/partners' },
  openGraph: {
    title: 'Earn 40% recurring promoting Kineo',
    description: 'Send creators a tool that makes a faceless Short in 60s. Earn 40% recurring, forever. Free account included.',
    url: 'https://www.shortsforgeai.com/partners',
    type: 'website',
  },
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
const APPLY = 'mailto:hello@shortsforgeai.com?subject=Affiliate%20application%20-%20Kineo&body=Hi!%20I%27d%20like%20to%20join%20the%20affiliate%20program.%0A%0AMy%20channel%2Faudience%3A%20%0ANiche%3A%20%0AAudience%20size%3A%20'

export default function PartnersPage() {
  const faq = [
    { q: 'How much do I earn?', a: 'A flat 40% recurring commission on every customer you refer — every month they stay subscribed, not a one-time payout. With a 60-day cookie.' },
    { q: 'Do I get a free account?', a: 'Yes. We give every approved partner a free upgraded account so you can actually use the tool and make a real demo for your audience.' },
    { q: 'What do I promote?', a: 'Kineo turns one idea into a finished faceless Short (script + AI voice + footage + captions) in about 60 seconds. It basically demos itself on camera — perfect for tutorials, reviews, and "I made this in 60s" content.' },
    { q: 'How do I get paid?', a: 'Commissions are tracked and paid through Rewardful. Once you apply, we set up your unique link.' },
  ]
  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ Kineo</Link>

        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', borderRadius: 999, padding: '6px 14px' }}>Affiliate program</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.7rem)', fontWeight: 900, lineHeight: 1.12, margin: '16px 0 0' }}>Earn 40% recurring — forever</h1>
          <p style={{ fontSize: '1.05rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 600 }}>
            Send creators a tool that turns one idea into a finished faceless Short in 60 seconds — and earn <b style={{ color: '#fff' }}>40% recurring commission</b> on every customer, every month they stay. 60-day cookie. Free account included.
          </p>
          <a href={APPLY} style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#2997ff,#2997ff)', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}>Apply to become a partner →</a>
        </section>

        {/* Earnings */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>What 40% recurring looks like</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { n: '10', d: 'referred customers', e: '~$48–$152 / mo' },
              { n: '50', d: 'referred customers', e: '~$240–$760 / mo' },
              { n: '200', d: 'referred customers', e: '~$950–$3,030 / mo' },
            ].map((r) => (
              <div key={r.n} style={{ ...CARD, borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{r.n}</div>
                <div style={{ color: '#86868b', fontSize: '0.82rem', margin: '2px 0 8px' }}>{r.d}</div>
                <div style={{ color: '#2997ff', fontWeight: 800, fontSize: '0.95rem' }}>{r.e}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748B', textAlign: 'center', margin: '10px 0 0' }}>Recurring, every month they stay subscribed. Plans range $11.90–$37.90/mo.</p>
        </section>

        {/* How */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Apply', d: 'Tell us your channel and niche. We approve and set up your unique link.' },
              { n: '2', t: 'Get a free account', d: 'Use the tool, make a real demo for your audience.' },
              { n: '3', t: 'Earn 40% recurring', d: 'Share your link. Get paid every month your referrals stay.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(41,151,255,0.12)', color: '#2997ff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86868b', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>Questions, answered</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 44, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Start earning 40% recurring</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>Free account included. Takes 2 minutes to apply.</p>
          <a href={APPLY} style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}>Apply now →</a>
        </section>
      </div>
    </main>
  )
}
