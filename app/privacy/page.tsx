// Push #116 — Privacy Policy. LGPD/GDPR-aware: lists exactly what we
// collect, why, and how to ask us to delete it. Static, server-rendered.

import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy — ShortsForgeAI',
  description:
    'How ShortsForgeAI collects, uses, and protects your data. LGPD- and GDPR-aware: full deletion rights and a clear contact for requests.',
}

export default function PrivacyPage() {
  return (
    <>
      <main
        style={{
          minHeight: '100vh',
          background: '#0A0A0F',
          color: '#F5F7FF',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: '24px 20px 32px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              marginBottom: 24,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#94A3B8',
              textDecoration: 'none',
            }}
          >
            ← Back to Home
          </Link>
          <h1
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              margin: 0,
              marginBottom: 6,
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ color: '#94A3B8', fontSize: 13, margin: 0, marginBottom: 28 }}>
            Last updated: May 2026
          </p>

          <Section title="What we collect">
            When you sign up we store your email address and an
            authentication identifier. When you use the Service we store
            the prompts you submit, the videos generated for you, the
            credit balance on your account, and basic usage events (page
            views, generation outcomes) so we can keep the product
            working and improving.
          </Section>

          <Section title="How we use it">
            Your data is used to operate the Service: authenticate you,
            generate and deliver videos, charge your subscription, and
            send you product emails (account confirmation, &ldquo;your
            Short is ready&rdquo; notifications). We don&apos;t sell your
            data. We don&apos;t use the content of your prompts to train
            third-party AI models.
          </Section>

          <Section title="Processors we rely on">
            We process data through trusted infrastructure providers:
            Supabase (database, auth), Stripe (payments), Resend
            (transactional email), Vercel (hosting), and the AI/stock
            providers required to render your video. Each processor has
            its own privacy policy. We pass them only the minimum data
            needed to perform their function.
          </Section>

          <Section title="Your rights (LGPD / GDPR)">
            You can request a copy of your data, correct anything that&apos;s
            wrong, or ask us to delete your account and everything we
            store about you. Email{' '}
            <a
              href="mailto:hello@shortsforgeai.com"
              style={{ color: '#22D3EE', textDecoration: 'none' }}
            >
              hello@shortsforgeai.com
            </a>{' '}
            and we&apos;ll action the request within 30 days.
          </Section>

          <Section title="Cookies">
            We use cookies that are strictly necessary for the Service
            (auth session) and a small number of analytics/marketing
            tags (Google Ads, page-view events) to measure conversion
            and optimize the funnel. You can clear these from your
            browser at any time.
          </Section>

          <Section title="Contact">
            Privacy questions?{' '}
            <a
              href="mailto:hello@shortsforgeai.com"
              style={{ color: '#22D3EE', textDecoration: 'none' }}
            >
              hello@shortsforgeai.com
            </a>
            .
          </Section>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: '1rem',
          fontWeight: 900,
          letterSpacing: '-0.01em',
          margin: 0,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: '0.92rem',
          color: '#CBD5E1',
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {children}
      </p>
    </section>
  )
}
