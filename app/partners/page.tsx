// #486 — Public affiliate-recruiting landing. The page every outreach links to.
// Explains the verified 40% recurring model, first-touch window and how to
// apply through the built-in affiliate dashboard. Static, in sitemap for SEO.
import type { Metadata } from 'next'
import Link from 'next/link'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import Footer from '@/components/Footer'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.usekineo.com'),
  title: 'AI Video Affiliate Program - Earn 40% Recurring | Kineo',
  description:
    'Promote Kineo and earn 40% on recurring payments from referred subscribers. First-touch tracking lasts 90 days and every approved partner gets a dashboard.',
  alternates: { canonical: 'https://www.usekineo.com/partners' },
  openGraph: {
    title: 'AI Video Affiliate Program - Earn 40% Recurring | Kineo',
    description: 'Send creators a topic-to-Short workflow and earn 40% on recurring payments while they remain subscribed.',
    url: 'https://www.usekineo.com/partners',
    type: 'website',
  },
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
const APPLY = '/signup?redirect=%2Faffiliate&utm_source=partners&utm_medium=organic&utm_campaign=push33_partner_program'
const SUPPORT = 'mailto:hello@usekineo.com?subject=Kineo%20affiliate%20program%20question'

export default function PartnersPage() {
  const faq = [
    { q: 'How much do I earn?', a: 'Approved affiliates earn 40% of each eligible payment from customers they refer, including recurring payments while the customer remains subscribed and the affiliate account remains active. First-touch tracking lasts 90 days.' },
    { q: 'Can I test Kineo first?', a: 'Yes. The free Fast workflow requires no card and creates watermarked previews. Approved partners can ask us to review additional demo access for a specific audience or tutorial.' },
    { q: 'What do I promote?', a: 'Kineo turns one topic or script into a finished 9:16 Short with script structure, AI voice, matched visuals and captions. Paid plans unlock clean exports and recurring-show tools.' },
    { q: 'How is attribution tracked?', a: 'Your Kineo affiliate link records first-touch clicks, signups, payments and renewals in your affiliate dashboard. Payout timing and method are confirmed during approval.' },
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
          <h1 style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.7rem)', fontWeight: 900, lineHeight: 1.12, margin: '16px 0 0' }}>AI Video Affiliate Program: Earn 40% Recurring</h1>
          <p style={{ fontSize: '1.05rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 600 }}>
            Send creators a tool that turns one topic into a scripted, voiced and captioned 9:16 Short — and earn <b style={{ color: '#fff' }}>40% of eligible payments</b> while referred customers stay subscribed. 90-day first-touch tracking.
          </p>
          <OrganicCtaLink href={APPLY} source="partners" placement="hero" style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#2997ff,#2997ff)', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}>Apply in Kineo →</OrganicCtaLink>
          <div style={{ marginTop: 14 }}>
            <OrganicCtaLink href="/faceless-video-generator" source="partners" placement="product_demo" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '0.9rem' }}>
              Test the product your audience will see →
            </OrganicCtaLink>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#86868b' }}>Application is reviewed before a link becomes active.</div>
        </section>

        {/* Earnings */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>What 40% recurring looks like</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { n: '10', d: 'referred customers', e: '~$40–$152 / mo' },
              { n: '50', d: 'referred customers', e: '~$198–$758 / mo' },
              { n: '200', d: 'referred customers', e: '~$792–$3,032 / mo' },
            ].map((r) => (
              <div key={r.n} style={{ ...CARD, borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{r.n}</div>
                <div style={{ color: '#86868b', fontSize: '0.82rem', margin: '2px 0 8px' }}>{r.d}</div>
                <div style={{ color: '#2997ff', fontWeight: 800, fontSize: '0.95rem' }}>{r.e}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748B', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>Illustration based on 40% of current USD renewal list prices ($9.90–$37.90/month), before taxes, refunds or failed payments. Introductory first-month prices are lower.</p>
        </section>

        {/* How */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Apply in Kineo', d: 'Create or use your account, then submit the affiliate application.' },
              { n: '2', t: 'Test the real workflow', d: 'Use the free Fast path and make a genuine demo for your audience.' },
              { n: '3', t: 'Track recurring revenue', d: 'Share your approved link and follow clicks, signups and eligible commissions in your dashboard.' },
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
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>No payment is required to apply. Every application is reviewed before activation.</p>
          <OrganicCtaLink href={APPLY} source="partners" placement="bottom" style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}>Apply now →</OrganicCtaLink>
          <div style={{ marginTop: 12, fontSize: '0.78rem' }}><a href={SUPPORT} style={{ color: '#86868b' }}>Questions before applying? Email us.</a></div>
        </section>
      </div>
      <Footer showStats={false} />
    </main>
  )
}
