import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import ExampleVideoPlayer from '@/app/examples/ExampleVideoPlayer'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

const BASE = 'https://www.usekineo.com'
const INTENT_CAMPAIGN = 'push50_faceless_decision_guide'
const FORM_ID = 'try-a-faceless-idea'
const FORM_ANCHOR = `#${FORM_ID}`
const FEATURED_EXAMPLE = PUBLIC_EXAMPLES[0]
const PUBLICATION_DATE = '2026-07-16T00:00:00.000Z'
const YOUTUBE_MONETIZATION_POLICY = 'https://support.google.com/youtube/answer/1311392?hl=en'
const YOUTUBE_PARTNER_PROGRAM = 'https://support.google.com/youtube/answer/72851?hl=en'

const FORM_EXAMPLES = [
  'Why Turkmenistan’s Door to Hell is still burning',
  'How a barcode knows what you are buying',
  'What an index fund actually owns',
] as const

export const metadata: Metadata = {
  title: '10 Faceless YouTube Channel Formats + 50 Video Ideas | Kineo',
  description:
    'Compare 10 faceless YouTube channel formats and 50 video ideas by research load, visual availability, repeatability and policy risk. Try one free.',
  alternates: { canonical: `${BASE}/faceless-channel-ideas` },
  openGraph: {
    title: '10 Faceless Channel Formats + 50 Video Ideas',
    description:
      'An honest decision matrix, 50 repeatable ideas, a real output preview and a no-camera workflow.',
    url: `${BASE}/faceless-channel-ideas`,
    type: 'website',
    images: [{ url: FEATURED_EXAMPLE.posterPath, width: 360, height: 640 }],
    videos: [{ url: FEATURED_EXAMPLE.videoPath, width: 360, height: 640, type: 'video/mp4' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '10 Faceless Channel Formats + 50 Video Ideas | Kineo',
    description: 'Choose a sustainable faceless format, then turn one topic into a finished Short.',
    images: [FEATURED_EXAMPLE.posterPath],
  },
}

type Idea = { title: string; angle: string }
type Niche = {
  name: string
  bestFor: string
  research: 'Light' | 'Moderate' | 'Heavy'
  visuals: 'High' | 'Medium' | 'Low'
  repeatability: 'High' | 'Medium'
  risk: 'Lower' | 'Medium' | 'Higher'
  caution: string
  ideas: readonly Idea[]
}

const NICHES: readonly Niche[] = [
  {
    name: 'Everyday systems',
    bestFor: 'Beginners who like clear explanations',
    research: 'Moderate', visuals: 'High', repeatability: 'High', risk: 'Lower',
    caution: 'Verify the mechanism and avoid pretending a simplified explanation covers every case.',
    ideas: [
      { title: 'How barcodes work', angle: 'Follow one product from scanner to receipt.' },
      { title: 'What happens to checked luggage', angle: 'Trace a suitcase through an airport.' },
      { title: 'How tap-to-pay works', angle: 'Explain the signal without exposing security details.' },
      { title: 'Why elevators feel weightless', angle: 'Connect motion, acceleration and what passengers feel.' },
      { title: 'How a shipping container crosses the world', angle: 'Tell the journey as a visual timeline.' },
    ],
  },
  {
    name: 'Geography and extreme places',
    bestFor: 'Map-led curiosity stories',
    research: 'Moderate', visuals: 'High', repeatability: 'High', risk: 'Medium',
    caution: 'Use reliable geographic sources and describe restricted communities respectfully.',
    ideas: [
      { title: 'Places people cannot legally visit', angle: 'Explain the restriction, not just the danger.' },
      { title: 'Why a border looks like that', angle: 'Use a map and one documented historical decision.' },
      { title: 'Cities built in unlikely places', angle: 'Show the engineering or trade-off that made them possible.' },
      { title: 'The coldest inhabited settlements', angle: 'Focus on daily systems, not exaggerated survival claims.' },
      { title: 'Landmarks that changed the landscape', angle: 'Compare what existed before and after.' },
    ],
  },
  {
    name: 'Business and brand stories',
    bestFor: 'Narrative explainers with public sources',
    research: 'Moderate', visuals: 'Medium', repeatability: 'High', risk: 'Medium',
    caution: 'Separate reported facts from interpretation and avoid unverified claims about people or companies.',
    ideas: [
      { title: 'How a familiar company makes money', angle: 'Explain one revenue stream with sourced numbers.' },
      { title: 'The product launch that changed a category', angle: 'Build around a documented before-and-after.' },
      { title: 'Why membership businesses work', angle: 'Explain incentives without calling any result guaranteed.' },
      { title: 'A logistics decision hiding in plain sight', angle: 'Show how packaging, routes or inventory affect the product.' },
      { title: 'The origin of an everyday brand feature', angle: 'Tell the design constraint that produced it.' },
    ],
  },
  {
    name: 'History and archaeology',
    bestFor: 'Evergreen stories with a source trail',
    research: 'Heavy', visuals: 'Medium', repeatability: 'High', risk: 'Medium',
    caution: 'Distinguish evidence, expert interpretation and legend; image rights still apply.',
    ideas: [
      { title: 'How Roman concrete endured', angle: 'Explain what current research supports and what remains debated.' },
      { title: 'A day in an ancient city', angle: 'Build the script from archaeological evidence.' },
      { title: 'The trade route behind a modern city', angle: 'Use a map to connect geography and growth.' },
      { title: 'An artifact that changed a timeline', angle: 'Show why one find revised an earlier theory.' },
      { title: 'A historical decision with an unexpected result', angle: 'Keep causation narrow and documented.' },
    ],
  },
  {
    name: 'Science, nature and space',
    bestFor: 'Visual questions with a concrete answer',
    research: 'Heavy', visuals: 'High', repeatability: 'High', risk: 'Higher',
    caution: 'Check primary or institutional sources and avoid turning uncertainty into certainty.',
    ideas: [
      { title: 'Why light cannot escape a black hole', angle: 'Use one analogy and state where it stops being exact.' },
      { title: 'How deep-sea animals handle pressure', angle: 'Connect anatomy to a specific depth.' },
      { title: 'What causes the smell after rain', angle: 'Move from the familiar sensation to the chemistry.' },
      { title: 'How the Moon changes tides', angle: 'Animate the relationship rather than listing facts.' },
      { title: 'An animal adaptation that solves one problem', angle: 'Show the habitat pressure and the adaptation together.' },
    ],
  },
  {
    name: 'Technology and digital literacy',
    bestFor: 'Useful explainers that can earn saves',
    research: 'Heavy', visuals: 'Medium', repeatability: 'High', risk: 'Higher',
    caution: 'Technology changes quickly. Date the research and do not publish instructions that enable abuse.',
    ideas: [
      { title: 'What private browsing does and does not hide', angle: 'Correct one common misconception.' },
      { title: 'What happens when a file is deleted', angle: 'Trace the process at a beginner level.' },
      { title: 'How a phone finds its location', angle: 'Connect satellites, timing and maps.' },
      { title: 'Why passkeys are different from passwords', angle: 'Explain the user-facing security model.' },
      { title: 'Why AI systems can produce wrong answers', angle: 'Explain uncertainty without anthropomorphizing the model.' },
    ],
  },
  {
    name: 'Personal finance basics',
    bestFor: 'Educational concepts with careful sourcing',
    research: 'Heavy', visuals: 'Medium', repeatability: 'High', risk: 'Higher',
    caution: 'Keep it educational, identify the country and date, and avoid personalized financial advice or return promises.',
    ideas: [
      { title: 'What an index fund actually owns', angle: 'Use a simple basket analogy and name its limits.' },
      { title: 'How compound interest changes over time', angle: 'Show a hypothetical example with assumptions on screen.' },
      { title: 'Why minimum payments stretch debt', angle: 'Explain the math without prescribing a personal decision.' },
      { title: 'Where a card transaction fee goes', angle: 'Map the participants in one purchase.' },
      { title: 'How inflation changes purchasing power', angle: 'Compare the same basket across two sourced dates.' },
    ],
  },
  {
    name: 'Psychology and productivity',
    bestFor: 'Behavior ideas applied to everyday situations',
    research: 'Heavy', visuals: 'High', repeatability: 'High', risk: 'Higher',
    caution: 'Avoid diagnosis, therapy claims and pop-psychology certainty; represent the strength of the evidence.',
    ideas: [
      { title: 'Why unfinished tasks stay on your mind', angle: 'Explain the finding and a practical, non-clinical example.' },
      { title: 'How implementation intentions work', angle: 'Compare a vague goal with an if-then plan.' },
      { title: 'What attention residue means', angle: 'Visualize the cost of switching between two tasks.' },
      { title: 'How defaults shape decisions', angle: 'Use an everyday interface example.' },
      { title: 'Why visible progress changes motivation', angle: 'Show one study-backed mechanism without promising an outcome.' },
    ],
  },
  {
    name: 'Documented mysteries',
    bestFor: 'Suspense built from verifiable evidence',
    research: 'Heavy', visuals: 'Medium', repeatability: 'High', risk: 'Higher',
    caution: 'Protect victims, avoid graphic details and defamation, and label theories as theories.',
    ideas: [
      { title: 'The evidence in the D. B. Cooper case', angle: 'Separate confirmed evidence from later speculation.' },
      { title: 'What is known about the Mary Celeste', angle: 'Build a timeline from documented facts.' },
      { title: 'The undeciphered Voynich manuscript', angle: 'Compare two theories without declaring a winner.' },
      { title: 'A vanished expedition reconstructed', angle: 'Use records, maps and explicit uncertainty.' },
      { title: 'A signal scientists could not immediately explain', angle: 'End with the current best-supported interpretation.' },
    ],
  },
  {
    name: 'Original horror fiction',
    bestFor: 'Creators who prefer writing over research',
    research: 'Light', visuals: 'High', repeatability: 'High', risk: 'Medium',
    caution: 'Label fiction clearly, keep visuals advertiser-aware and avoid copying existing stories or characters.',
    ideas: [
      { title: 'Rules for the overnight shift', angle: 'Write one original location and escalate three rules.' },
      { title: 'The radio that answers tomorrow', angle: 'Build to a payoff that changes the opening line.' },
      { title: 'The hotel floor missing from every map', angle: 'Use spatial clues instead of gore.' },
      { title: 'A voicemail from an empty house', angle: 'Let sound and captions carry the tension.' },
      { title: 'The last train with no final stop', angle: 'Create a self-contained story with a clear ending.' },
    ],
  },
]

function promptSignupUrl(prompt: string): string {
  const params = new URLSearchParams({
    prompt,
    create_intent: 'fast',
    intent_campaign: INTENT_CAMPAIGN,
  })
  return `/signup?${params.toString()}`
}

function ideaSignupUrl(idea: Idea): string {
  return promptSignupUrl(`Create a 45-second faceless YouTube Short about: ${idea.title}. Approach: ${idea.angle}`)
}

const ANSWERS = [
  {
    q: 'What is a good faceless channel idea for a beginner?',
    a: 'Start with a format whose facts are easy to verify and whose visuals are easy to source. Everyday systems and straightforward geography explainers are practical starting points. Make three test videos before committing to a niche; ease of production matters more than a supposed winning category.',
  },
  {
    q: 'Can I start a YouTube channel without filming?',
    a: 'Yes. A faceless workflow can combine an original script, AI voiceover, licensed or AI-generated visuals and captions. Kineo assembles those layers from one topic, so you do not need to appear on camera or record your own footage.',
  },
  {
    q: 'Can a faceless or AI-assisted channel be monetized?',
    a: 'It can be eligible, but the format alone never guarantees approval. YouTube reviews the channel as a whole and its policies reject repetitive, mass-produced or insufficiently transformed reused content. Add original research, narration, structure and editorial judgment to every video, then check the current YouTube Partner Program requirements.',
  },
] as const

const FAQ = [
  ...ANSWERS,
  {
    q: 'How should I choose among these 10 channel formats and 50 video ideas?',
    a: 'Use the 10 channel formats and 50 episode ideas above to find a format where you can sustain the research, source appropriate visuals and publish distinct episodes without cutting factual corners. Then test three topics and compare completion time, viewer retention and comments before choosing a long-term direction.',
  },
  {
    q: 'How much does Kineo cost?',
    a: 'A new account can create up to 3 watermarked Fast videos every 24 hours without a card. Starter is $4.90 for the first month and then $9.90 per month. Check the pricing page for the current plan details before buying.',
  },
] as const

const th: CSSProperties = { padding: '12px 10px', textAlign: 'left', color: '#f5f5f7', fontSize: 12, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '13px 10px', borderTop: '1px solid #2a2a2d', color: '#a1a1a6', fontSize: 13, lineHeight: 1.45, verticalAlign: 'top' }

export default function FacelessChannelIdeasPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
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
    embedUrl: `${BASE}/faceless-channel-ideas#real-output`,
  }
  const h2: CSSProperties = { fontSize: 'clamp(1.35rem, 3.5vw, 1.8rem)', fontWeight: 850, margin: '46px 0 12px' }
  const p: CSSProperties = { fontSize: '1rem', color: '#a1a1a6', lineHeight: 1.65, margin: '0 0 12px' }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }} />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '64px 20px 88px' }}>
        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2997ff', border: '1px solid rgba(41,151,255,0.4)', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 12px' }}>
          Faceless channel decision guide
        </span>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, margin: '18px 0 0' }}>
          10 Faceless YouTube Channel Formats + 50 Video Ideas
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#a1a1a6', lineHeight: 1.65, margin: '16px 0 0', maxWidth: 780 }}>
          The useful question is not “which niche guarantees views?” No niche does. Compare formats by the work they require: research load, available visuals, repeatability and factual or policy risk. Then test one real topic before you build a channel around it.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 }}>
          <OrganicCtaLink href={FORM_ANCHOR} source={INTENT_CAMPAIGN} placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>
            Test one idea free →
          </OrganicCtaLink>
          <OrganicCtaLink href="/pricing?intent_campaign=push50_faceless_decision_guide" source={INTENT_CAMPAIGN} placement="hero_pricing" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>
            See pricing
          </OrganicCtaLink>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos / 24h · No card · Starter $4.90 first month, then $9.90/month
        </p>

        <TopicGeneratorForm
          campaign={INTENT_CAMPAIGN}
          source={INTENT_CAMPAIGN}
          examples={FORM_EXAMPLES}
          formId={FORM_ID}
          copy={{
            label: 'Which idea do you want to test?',
            placeholder: 'Type one topic or paste your script',
            submit: 'Turn this idea into a Short →',
            examplesLabel: 'Ideas selected from the guide',
            note: 'Your topic stays attached through signup. Create a watermarked Fast video without entering a card.',
          }}
        />

        <h2 style={h2}>Choose with this decision matrix</h2>
        <p style={p}>
          These ratings describe production difficulty, not predicted views or revenue. “Risk” combines factual, copyright, advertiser-suitability and other policy considerations; it is not legal advice.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid #2a2a2d', borderRadius: 16, background: '#101012' }}>
          <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
            <caption style={{ padding: '14px 12px', color: '#86868b', fontSize: 12, textAlign: 'left' }}>
              Directional comparison for planning a repeatable faceless channel.
            </caption>
            <thead style={{ background: '#161618' }}>
              <tr>
                <th style={th}>Format</th><th style={th}>Research</th><th style={th}>Visuals</th><th style={th}>Repeatability</th><th style={th}>Fact / policy risk</th><th style={th}>Best fit</th>
              </tr>
            </thead>
            <tbody>
              {NICHES.map((niche) => (
                <tr key={niche.name}>
                  <td style={{ ...td, color: '#f5f5f7', fontWeight: 750 }}>{niche.name}</td>
                  <td style={td}>{niche.research}</td><td style={td}>{niche.visuals}</td><td style={td}>{niche.repeatability}</td><td style={td}>{niche.risk}</td><td style={td}>{niche.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={h2}>Three direct answers before you choose</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {ANSWERS.map((item) => (
            <article key={item.q} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 15, padding: '18px' }}>
              <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{item.q}</h3>
              <p style={{ ...p, fontSize: 14, marginTop: 9, marginBottom: 0 }}>{item.a}</p>
            </article>
          ))}
        </div>
        <p style={{ ...p, fontSize: 14, marginTop: 14 }}>
          For the current rules, read YouTube’s official <a href={YOUTUBE_MONETIZATION_POLICY} target="_blank" rel="noopener noreferrer" style={{ color: '#2997ff' }}>channel monetization and reused-content policy</a> and <a href={YOUTUBE_PARTNER_PROGRAM} target="_blank" rel="noopener noreferrer" style={{ color: '#2997ff' }}>Partner Program overview</a>. YouTube reviews the full channel; using AI or staying off camera is neither automatic approval nor automatic rejection.
        </p>

        <section id="real-output" aria-labelledby="real-output-heading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', alignItems: 'center', gap: 24, marginTop: 44, padding: 22, background: '#101012', border: '1px solid #2a2a2d', borderRadius: 18 }}>
          <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', aspectRatio: '9 / 16', overflow: 'hidden', borderRadius: 18, background: '#000' }}>
            <ExampleVideoPlayer slug={FEATURED_EXAMPLE.slug} title={FEATURED_EXAMPLE.title} src={FEATURED_EXAMPLE.videoPath} poster={FEATURED_EXAMPLE.posterPath} placement="faceless_decision_guide" version="push50" />
          </div>
          <div>
            <p style={{ margin: '0 0 8px', color: '#2997ff', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Real Kineo output</p>
            <h2 id="real-output-heading" style={{ fontSize: 'clamp(1.35rem, 4vw, 1.9rem)', fontWeight: 900, lineHeight: 1.2, margin: 0 }}>{FEATURED_EXAMPLE.shortTitle}</h2>
            <p style={{ ...p, marginTop: 12 }}>{FEATURED_EXAMPLE.description}</p>
            <p style={{ ...p, fontSize: 14 }}>This is a {FEATURED_EXAMPLE.previewDurationSeconds}-second preview cut from a {FEATURED_EXAMPLE.outputDurationSeconds}-second Kineo export. It demonstrates the output format, not views, monetization or revenue.</p>
            <p style={{ margin: '16px 0', color: '#d2d2d7', fontSize: 14, lineHeight: 1.6 }}><strong>Prompt used:</strong> {FEATURED_EXAMPLE.prompt}</p>
            <OrganicCtaLink href={promptSignupUrl(FEATURED_EXAMPLE.prompt)} source={INTENT_CAMPAIGN} placement="real_output_prompt" style={{ color: '#2997ff', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>Try this exact prompt →</OrganicCtaLink>
          </div>
        </section>

        <h2 style={h2}>50 ideas, grouped by production reality</h2>
        <p style={p}>Each group contains five starting angles. Adapt the angle, verify every factual claim and make each episode meaningfully distinct.</p>
        {NICHES.map((niche, nicheIndex) => (
          <section key={niche.name} style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 'clamp(1.15rem, 3vw, 1.45rem)', margin: '0 0 7px' }}>{nicheIndex + 1}. {niche.name}</h3>
            <p style={{ ...p, fontSize: 14 }}><strong style={{ color: '#d2d2d7' }}>Watch-out:</strong> {niche.caution}</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {niche.ideas.map((idea, ideaIndex) => (
                <article key={idea.title} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '15px 17px' }}>
                  <div style={{ fontWeight: 750 }}>{idea.title}</div>
                  <div style={{ color: '#86868b', fontSize: 14, lineHeight: 1.55, marginTop: 4 }}>{idea.angle}</div>
                  <OrganicCtaLink href={ideaSignupUrl(idea)} source={INTENT_CAMPAIGN} placement={`idea_${nicheIndex + 1}_${ideaIndex + 1}`} style={{ display: 'inline-block', color: '#2997ff', fontSize: 13, fontWeight: 800, textDecoration: 'none', marginTop: 9 }}>Test this idea →</OrganicCtaLink>
                </article>
              ))}
            </div>
          </section>
        ))}

        <h2 style={h2}>A simple three-video test</h2>
        <ol style={{ margin: 0, paddingLeft: 22, color: '#a1a1a6', lineHeight: 1.7 }}>
          <li>Choose one format whose research and visual workload you can repeat.</li>
          <li>Create three different topics in the same format, with original scripts and a source checklist.</li>
          <li>Compare production time, retention and viewer questions. Keep the format only if you can improve the next episode.</li>
        </ol>
        <p style={{ ...p, marginTop: 14 }}>
          Kineo handles the production layer: script, AI voiceover, matched visuals and captions. You remain responsible for the editorial angle, fact-checking, rights and platform compliance. For the no-camera workflow, see <Link href="/ai-shorts-without-filming" style={{ color: '#2997ff' }}>how to make Shorts without filming</Link>.
        </p>

        <h2 style={h2}>Frequently asked questions</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {FAQ.map((item) => (
            <div key={item.q} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontWeight: 750 }}>{item.q}</div>
              <div style={{ fontSize: 14, color: '#86868b', marginTop: 6, lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 44, textAlign: 'center', background: 'radial-gradient(circle at 50% 0%, rgba(41,151,255,0.14), #0c0c0e 70%)', border: '1px solid rgba(41,151,255,0.25)', borderRadius: 18, padding: '34px 22px' }}>
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900 }}>Stop guessing. Test one real idea.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>Create up to 3 watermarked Fast videos every 24 hours without a card.</p>
          <OrganicCtaLink href={FORM_ANCHOR} source={INTENT_CAMPAIGN} placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Test my first idea →</OrganicCtaLink>
        </div>
      </div>
      <Footer />
    </main>
  )
}
