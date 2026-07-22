import Link from 'next/link'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

export const QUSO_INTENT_CAMPAIGN = 'push52_vidyo_quso_pricing_decision'

const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[0]
const CARD = { background: '#161618', border: '1px solid #2a2a2d' }

const QUSO_PLANS = [
  { name: 'Free', monthly: '$0', credits: '75', note: '720p and 7-day data retention' },
  { name: 'Lite', monthly: '$29', credits: '100', note: '1080p, editor and 10GB storage' },
  { name: 'Essential', monthly: '$39', credits: '300', note: 'Planner, filler-word removal and 25GB' },
  { name: 'Growth', monthly: '$49', credits: '600', note: 'Brand tools, analytics and 75GB' },
] as const

const TOPIC_EXAMPLES = [
  FEATURED_EXAMPLE.prompt,
  'Create a 35-second faceless Short explaining why some islands are off-limits, with a curiosity hook and clear captions.',
  'Create a fast-paced faceless Short about one surprising compound-interest example, with specific visuals and a concrete payoff.',
] as const

export default function QusoDecisionSections() {
  return (
    <>
      <TopicGeneratorForm
        campaign={QUSO_INTENT_CAMPAIGN}
        source={QUSO_INTENT_CAMPAIGN}
        examples={TOPIC_EXAMPLES}
        formId="try-quso-alternative-topic"
        copy={{
          label: 'Test the Kineo workflow with one topic',
          placeholder: 'Describe the faceless Short you want to create',
          submit: 'Turn this topic into a Fast Short →',
          examplesLabel: 'Example prompts',
          note: 'Your exact topic stays attached through signup. Up to 3 watermarked Fast videos per 24h; no card required.',
        }}
      />

      <section aria-labelledby="vidyo-pricing-short-answer" style={{ marginTop: 44, ...CARD, borderRadius: 18, padding: '22px 24px' }}>
        <div style={{ color: '#2997ff', fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Short answer · checked July 21, 2026
        </div>
        <h2 id="vidyo-pricing-short-answer" style={{ margin: '8px 0 10px', fontSize: 'clamp(1.3rem, 3vw, 1.7rem)' }}>
          Vidyo.ai is now Quso.ai. Paid monthly plans start at $29.
        </h2>
        <p style={{ margin: 0, color: '#a1a1a6', lineHeight: 1.65 }}>
          Quso says the Vidyo.ai rebrand went live in January 2025. Existing accounts, projects and subscriptions carried over. Its current public monthly pricing is Free $0, Lite $29, Essential $39 and Growth $49. Quso is now broader than clipping: it also advertises text-to-video creation, an editor, repurposing, scheduling, planning and analytics.
        </p>
        <p style={{ margin: '12px 0 0', color: '#86868b', lineHeight: 1.6, fontSize: 14 }}>
          Verify changes on Quso&apos;s{' '}
          <a href="https://quso.ai/pricing" style={{ color: '#2997ff' }}>official pricing page</a>
          {' '}and{' '}
          <a href="https://quso.ai/vidyo-ai" style={{ color: '#2997ff' }}>official rebrand page</a>.
        </p>
      </section>

      <section aria-labelledby="quso-pricing-table" style={{ marginTop: 42 }}>
        <h2 id="quso-pricing-table" style={{ fontSize: '1.35rem', textAlign: 'center', margin: '0 0 8px' }}>
          Quso.ai monthly pricing in July 2026
        </h2>
        <p style={{ margin: '0 auto 18px', maxWidth: 650, color: '#86868b', textAlign: 'center', lineHeight: 1.55, fontSize: 14 }}>
          Quso generally meters processing by credit; its help documentation says roughly one credit corresponds to one minute, with the exact charge shown before processing. Kineo credits measure its own generation engines, so the two credit systems are not directly comparable.
        </p>
        <div style={{ overflowX: 'auto', ...CARD, borderRadius: 16 }}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ textAlign: 'left', padding: '13px 14px', color: '#86868b' }}>Plan</th>
                <th style={{ textAlign: 'center', padding: '13px 14px', color: '#86868b' }}>Monthly price</th>
                <th style={{ textAlign: 'center', padding: '13px 14px', color: '#86868b' }}>Monthly credits</th>
                <th style={{ textAlign: 'left', padding: '13px 14px', color: '#86868b' }}>Official-page summary</th>
              </tr>
            </thead>
            <tbody>
              {QUSO_PLANS.map((plan) => (
                <tr key={plan.name} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '13px 14px', fontWeight: 900 }}>{plan.name}</td>
                  <td style={{ padding: '13px 14px', textAlign: 'center', color: '#2997ff', fontWeight: 900 }}>{plan.monthly}/mo</td>
                  <td style={{ padding: '13px 14px', textAlign: 'center' }}>{plan.credits}</td>
                  <td style={{ padding: '13px 14px', color: '#a1a1a6' }}>{plan.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', color: '#6e6e73', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
          Prices are Quso&apos;s listed USD monthly rates, not annual equivalents. Regional pricing, taxes, limits and features can change.
        </p>
      </section>

      <section aria-labelledby="quso-or-kineo" style={{ marginTop: 42 }}>
        <h2 id="quso-or-kineo" style={{ fontSize: '1.35rem', textAlign: 'center', margin: '0 0 18px' }}>
          Choose by workflow, not by a feature-count contest
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <div style={{ ...CARD, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#a1a1a6', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Choose Quso if…</div>
            <ul style={{ color: '#a1a1a6', lineHeight: 1.65, paddingLeft: 20, marginBottom: 0 }}>
              <li>you regularly turn long recordings into multiple clips;</li>
              <li>you want editing, scheduling and analytics in one workspace;</li>
              <li>you manage distribution across several social platforms.</li>
            </ul>
          </div>
          <div style={{ ...CARD, borderRadius: 16, padding: 20, borderColor: 'rgba(41,151,255,0.45)' }}>
            <div style={{ fontSize: 12, color: '#2997ff', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Choose Kineo if…</div>
            <ul style={{ color: '#a1a1a6', lineHeight: 1.65, paddingLeft: 20, marginBottom: 0 }}>
              <li>you start with a topic instead of an existing video;</li>
              <li>you want a finished faceless 9:16 Short without a timeline;</li>
              <li>you prefer a $4.90 first month and $9.90 monthly renewal.</li>
            </ul>
          </div>
        </div>
        <p style={{ margin: '14px auto 0', maxWidth: 680, color: '#86868b', textAlign: 'center', lineHeight: 1.6, fontSize: 13 }}>
          Neither product can guarantee views, virality, subscribers or monetization. The better choice is the workflow you will actually use consistently.
        </p>
      </section>

      <section aria-labelledby="real-kineo-output" style={{ marginTop: 46 }}>
        <h2 id="real-kineo-output" style={{ fontSize: '1.35rem', textAlign: 'center', margin: '0 0 18px' }}>
          See a real Kineo output and the exact prompt
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', ...CARD, borderRadius: 18, padding: 20 }}>
          <div style={{ flex: '0 1 240px', width: '100%', maxWidth: 250, aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 18, border: '1px solid #343438', background: '#000' }}>
            <ExampleVideoPlayer
              slug={FEATURED_EXAMPLE.slug}
              title={FEATURED_EXAMPLE.title}
              src={FEATURED_EXAMPLE.videoPath}
              poster={FEATURED_EXAMPLE.posterPath}
              placement="vidyo_quso_pricing_decision"
              version="push52"
            />
          </div>
          <div style={{ flex: '1 1 310px', minWidth: 0 }}>
            <div style={{ color: '#2997ff', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Founder-owned sample · 5-second preview
            </div>
            <h3 style={{ margin: '9px 0', fontSize: '1.35rem' }}>{FEATURED_EXAMPLE.shortTitle}</h3>
            <p style={{ color: '#a1a1a6', lineHeight: 1.6, margin: '0 0 14px' }}>
              This is a five-second preview cut from a {FEATURED_EXAMPLE.outputDurationSeconds}-second Kineo export. It demonstrates the format, not audience performance.
            </p>
            <div style={{ borderRadius: 12, background: '#0b0b0d', border: '1px solid #343438', padding: 14 }}>
              <div style={{ color: '#86868b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Exact prompt</div>
              <code style={{ color: '#f5f5f7', whiteSpace: 'normal', lineHeight: 1.55 }}>{FEATURED_EXAMPLE.prompt}</code>
            </div>
            <Link href={`/examples/${FEATURED_EXAMPLE.slug}`} style={{ display: 'inline-block', marginTop: 14, color: '#2997ff', fontWeight: 800 }}>
              Open the full example page →
            </Link>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40, textAlign: 'center', ...CARD, borderRadius: 18, padding: '25px 20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Still comparing the paid entry point?</h2>
        <p style={{ color: '#86868b', margin: '8px 0 17px', lineHeight: 1.55 }}>
          Kineo Starter is $4.90 for the first month and renews at $9.90/month. See the exact credits and engine access before choosing.
        </p>
        <OrganicCtaLink
          href={`/pricing?intent_campaign=${QUSO_INTENT_CAMPAIGN}`}
          source={QUSO_INTENT_CAMPAIGN}
          placement="pricing_decision"
          style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '13px 25px', borderRadius: 999, textDecoration: 'none' }}
        >
          Compare Kineo plans →
        </OrganicCtaLink>
      </section>
    </>
  )
}
