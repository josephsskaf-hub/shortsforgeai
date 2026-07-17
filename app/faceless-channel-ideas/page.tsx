// ROBO-SEO-2026-07-01 — high-volume lead-magnet page for "faceless youtube channel
// ideas" (huge search volume, perfect intent: the searcher wants to START a faceless
// channel = Kineo's exact ICP). 50 ideas organized in 10 categories, RPM ranges only
// where 2026 research gave real numbers (OutlierKit / Virlo / nexlev / fliki cluster:
// finance $15–30+, luxury $10–20, health $10–18, tech/AI $8–15, horror $6–12,
// mystery $5–12, motivation/stoicism $8–12). Static server component; same structure
// as /ai-shorts-without-filming (badge → h1 → CTA → sections → FAQ JSON-LD → sticky
// CTA). No email capture exists in this repo's free tools, so the conversion path is
// the standard direct-signup CTA (up to 3 watermarked Fast videos / 24h, no card). Added to sitemap.
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'

const INTENT_CAMPAIGN = 'push35_faceless_idea'
const FORM_EXAMPLES = [
  'Why Snake Island is too dangerous to visit',
  'The billion-dollar mistake that killed Blockbuster',
  'What happens to your brain after 24 hours without sleep',
] as const

export const metadata: Metadata = {
  title: '50 Faceless YouTube Channel Ideas for 2026 (High RPM) | Kineo',
  description:
    '50 faceless YouTube channel ideas for 2026 across finance, mystery, extreme places, luxury, history and more. Try up to 3 watermarked Fast videos every 24h, no card.',
  alternates: { canonical: 'https://www.usekineo.com/faceless-channel-ideas' },
  openGraph: {
    title: '50 Faceless YouTube Channel Ideas for 2026 (Ranked by Niche & RPM)',
    description:
      '50 concrete faceless channel ideas across finance, mystery, geography, luxury and history. Try Fast free; Starter is $4.90 for the first month.',
    url: 'https://www.usekineo.com/faceless-channel-ideas',
    type: 'website',
  },
}

type Idea = { t: string; d: string }
type Category = { name: string; rpm: string; blurb: string; ideas: Idea[] }

const CATEGORIES: Category[] = [
  {
    name: '1. Personal Finance & Money',
    rpm: 'RPM ~$15–30+ (highest-paying faceless niche in 2026)',
    blurb:
      'Fintech apps and brokerages pay premium CPMs to reach people searching money topics — finance is consistently the #1 RPM niche in 2026 data.',
    ideas: [
      { t: 'Money Habits Decoded', d: 'One habit per Short — "the money habit that quietly keeps you broke" — with a counter-intuitive fix.' },
      { t: 'Compound Interest Stories', d: 'True stories of ordinary people whose small, boring investments became fortunes — numbers on screen.' },
      { t: 'Financial Disaster Autopsies', d: 'How famous people and companies went broke — the exact decision that triggered the collapse.' },
      { t: 'Investing Basics, Zero Jargon', d: 'One concept per video (index funds, Roth IRA, dollar-cost averaging) explained like you’re 12.' },
      { t: 'How X Actually Makes Money', d: 'Business-model breakdowns — how Costco, Rolex or airlines really profit. Endless topic supply.' },
    ],
  },
  {
    name: '2. Luxury & Billionaire Lifestyle',
    rpm: 'RPM ~$10–20 (premium advertisers, aspirational audience)',
    blurb:
      'Wealth-showcase content attracts premium advertisers and gets shared widely — perfect for stock footage and voiceover, zero face required.',
    ideas: [
      { t: 'Billionaire Daily Routines', d: 'The strangely disciplined (or strangely lazy) daily schedules of the ultra-rich, hour by hour.' },
      { t: 'Inside Impossible Homes', d: 'Drone and stock tours of the world’s most extreme houses — the $500M mansion nobody lives in.' },
      { t: 'Old Money Rules', d: 'How generational-wealth families quietly keep it — the unwritten rules they never post about.' },
      { t: 'The Real Cost of Luxury', d: 'What a superyacht, private jet or F1 team actually costs to run per day — jaw-drop numbers.' },
      { t: 'Billion-Dollar Mistakes', d: 'Decisions that cost billionaires fortunes — Blockbuster passing on Netflix, and 100 more.' },
    ],
  },
  {
    name: '3. Mystery & True Crime',
    rpm: 'RPM ~$5–12, exceptional retention and loyalty',
    blurb:
      'Viewers binge mystery for hours — watch time is what the algorithm rewards. Stock footage, maps and timelines make it fully faceless.',
    ideas: [
      { t: 'Cold Cases in 60 Seconds', d: 'One unsolved case per Short, ending on the single detail that still doesn’t add up.' },
      { t: 'Vanished', d: 'People, planes and ships that disappeared without explanation — MH370-style hooks every day.' },
      { t: 'Unsolved Heists', d: 'Perfect crimes where the money was never found — the Gardner Museum, D.B. Cooper and beyond.' },
      { t: 'Declassified', d: 'Real stories pulled from declassified government files — stranger than any fiction.' },
      { t: 'Internet Mysteries', d: 'Cicada 3301, untraceable videos, accounts that predicted events — mystery for a digital-native audience.' },
    ],
  },
  {
    name: '4. Horror & Scary Stories',
    rpm: 'RPM ~$6–12, the highest-retention faceless format',
    blurb:
      'Horror is the king of faceless YouTube — narrated stories over dark visuals regularly hit 1M–10M views, and viewers listen for hours.',
    ideas: [
      { t: 'True Scary Stories, Narrated', d: 'Reader-submitted and true encounters read over atmospheric footage — the Mr. Nightmare formula.' },
      { t: 'Cursed Objects', d: 'One allegedly cursed object per video and the documented misfortunes that follow its owners.' },
      { t: 'Abandoned With a Dark Past', d: 'Ghost towns, closed hospitals and dead malls — what happened there before everyone left.' },
      { t: 'Do Not Search This', d: 'The internet’s most disturbing unexplained media, teased without showing anything demonetizable.' },
      { t: 'Rules Horror', d: '"If you work the night shift at X, never do these 5 things" — the viral rules-list horror format.' },
    ],
  },
  {
    name: '5. Extreme Places & Geography',
    rpm: 'Proven format — geography explainer channels have grown past 5M subscribers',
    blurb:
      'Drone stock footage plus a sharp voiceover is all it takes. Extreme-place mystery is one of the most reliably viral Shorts formulas right now.',
    ideas: [
      { t: 'Too Dangerous to Visit', d: 'Snake Island, the door to hell, no-go zones — places that are literally forbidden or lethal.' },
      { t: 'Why the Border Looks Like That', d: 'The absurd historical reasons behind the world’s weirdest borders and enclaves.' },
      { t: 'Islands No One Can Enter', d: 'North Sentinel and beyond — islands protected by law, disease or the people who live there.' },
      { t: 'Cities That Shouldn’t Exist', d: 'Settlements built in impossible places — on cliffs, under rocks, inside volcano craters.' },
      { t: 'Country Extremes', d: 'The coldest inhabited town, the emptiest country, the city with no roads — one extreme per Short.' },
    ],
  },
  {
    name: '6. History & Lost Civilizations',
    rpm: 'Evergreen searchable content with endless topic supply',
    blurb:
      'History Shorts compound: they stay relevant forever and get discovered through search long after posting.',
    ideas: [
      { t: 'History’s Dumbest Decisions', d: 'Single decisions that changed everything — the wrong turn that started WWI.' },
      { t: 'Lost Cities', d: 'Civilizations that vanished and the competing theories about why — Atlantis energy, real archaeology.' },
      { t: 'Ancient Engineering We Can’t Repeat', d: 'Roman concrete, Damascus steel, Baghdad batteries — how did they do it?' },
      { t: 'The War in 60 Seconds', d: 'Entire conflicts compressed into one ruthless minute with maps and arrows.' },
      { t: 'What They Didn’t Teach You', d: 'The disturbing or hilarious details school history left out — instant comment-bait.' },
    ],
  },
  {
    name: '7. Psychology, Stoicism & Mental Models',
    rpm: 'RPM ~$8–12, one of the fastest-growing faceless niches of 2026',
    blurb:
      'Stoicism and mental-model content saw remarkable growth — timeless wisdom over atmospheric imagery is a natural faceless fit.',
    ideas: [
      { t: 'Mental Models in 60 Seconds', d: 'One thinking tool per Short — inversion, second-order thinking — with a concrete everyday example.' },
      { t: 'Stoic Rules for Modern Problems', d: 'Marcus Aurelius applied to your phone addiction, your boss, your ex.' },
      { t: 'Dark Psychology, Explained', d: 'Manipulation tactics decoded so viewers can spot them — high curiosity, high saves.' },
      { t: 'Biases Costing You Money', d: 'One cognitive bias per video and the exact way it drains your wallet — psychology × finance crossover.' },
      { t: 'How High Performers Think', d: 'The mental frameworks of athletes, founders and chess players — motivation with substance.' },
    ],
  },
  {
    name: '8. Tech & AI',
    rpm: 'RPM ~$8–15, fueled by 2026’s AI boom',
    blurb:
      'AI tools, explainers and future-tech concepts fit the narrated visual format perfectly — and monetize beyond ads via affiliates.',
    ideas: [
      { t: 'One AI Tool a Day', d: 'A single AI tool per Short with one genuinely useful thing it does — affiliate income on top of ads.' },
      { t: 'What Happens When You…', d: 'Tech explainers — what actually happens when you delete a file, go incognito, click "unsubscribe".' },
      { t: 'Scam & Hack Breakdowns', d: 'How real scams and breaches worked, step by step — cybersecurity with thriller pacing.' },
      { t: 'Tech That’s Coming', d: 'Future-tech concepts explained before they arrive — the channel people follow to feel early.' },
      { t: 'Code Tricks in 30 Seconds', d: 'Tiny programming snippets and fixes — coding Shorts are exploding with tech-savvy audiences.' },
    ],
  },
  {
    name: '9. Health, Sleep & Longevity',
    rpm: 'RPM ~$10–18 (health advertisers pay premium rates)',
    blurb:
      'Health and wellness ranks among the top-paying faceless niches of 2026 — science-backed facts over clean visuals.',
    ideas: [
      { t: 'What X Does to Your Body', d: 'One input per video — no sleep, cold showers, 30 days without sugar — with the timeline on screen.' },
      { t: 'Sleep Science', d: 'Why you wake at 3am, what dreams do, the myth of 8 hours — everyone is underslept and curious.' },
      { t: 'Blue Zone Habits', d: 'What the world’s longest-living communities actually do differently — longevity is booming.' },
      { t: 'Fitness Myths Busted', d: 'One gym myth destroyed per Short with what the research really says.' },
      { t: 'Your Brain on…', d: 'Neuroscience bites — your brain on dopamine, doomscrolling, caffeine, silence.' },
    ],
  },
  {
    name: '10. Facts, Nature & Space',
    rpm: 'Broadest audience — super bingeable, ideal for growing fast',
    blurb:
      'Quick surprising facts are the most bingeable faceless format — perfect for building an audience you can later steer to higher-RPM topics.',
    ideas: [
      { t: 'Space Facts That Break Your Brain', d: 'Scale, black holes, time dilation — cosmic vertigo in 45 seconds.' },
      { t: 'Deep Sea Creatures', d: 'The ocean’s most alien animals — footage so strange it stops the scroll by itself.' },
      { t: 'Animal Superpowers', d: 'One absurd real ability per Short — the animal that survives space, the bird that never lands.' },
      { t: 'How It’s Actually Made', d: 'Satisfying process breakdowns of everyday objects — oddly specific, oddly viral.' },
      { t: 'Impossible Comparisons', d: 'Visual scale comparisons — wealth, speed, size, time — the format built for Shorts.' },
    ],
  },
]

function ideaSignupUrl(idea: Idea): string {
  const prompt = `Make a 45-second faceless YouTube Short using this format: ${idea.t}. ${idea.d}`
  const params = new URLSearchParams({ prompt, intent_campaign: INTENT_CAMPAIGN })
  return `/signup?${params.toString()}`
}

const STEPS: { n: string; t: string; d: string }[] = [
  { n: '1', t: 'Pick one idea from the list above', d: 'Choose a niche you can post in daily. Higher RPM is great, but consistency beats everything — pick the one whose topics you could brainstorm forever.' },
  { n: '2', t: 'Type the idea into Kineo', d: 'One line is enough — "the island too dangerous to visit". The AI writes the hook and script, generates the voiceover, matches footage to every line and burns in captions.' },
  { n: '3', t: 'Download a ready-to-post Short in ~60 seconds', d: 'A finished 9:16 video — post it to YouTube, TikTok or Reels as-is. No camera, no face, no editing. Create up to 3 watermarked Fast videos every 24 hours with no card.' },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'What is the best faceless YouTube channel idea for 2026?', a: 'Personal finance is the highest-paying faceless niche in 2026 (roughly $15–30+ RPM), followed by luxury/wealth, health and tech/AI. But the best idea is the one you can post in daily: mystery, horror and extreme-places channels earn less per view yet often grow much faster because retention is exceptional. Many creators start in a viral niche to build views, then add finance-adjacent topics for RPM.' },
  { q: 'Which faceless niches pay the most RPM in 2026?', a: 'Based on 2026 data across the niche-research sites: personal finance and investing ($15–30+ RPM), luxury and wealth ($10–20), health and wellness ($10–18), tech and AI ($8–15), motivation and stoicism ($8–12), horror ($6–12) and mystery/true crime ($5–12). US-heavy audiences can earn 5–10x more than the same views from other regions.' },
  { q: 'How do I start a faceless YouTube channel with no camera or editing skills?', a: 'You can generate the entire video with AI. With Kineo you type one idea and get a finished 9:16 Short — script, AI voiceover, footage matched to each line, and captions — in about 60 seconds. No camera, no face on screen, no recording your voice, no editor. A new account can create up to 3 watermarked Fast videos every 24 hours with no card.' },
  { q: 'Can faceless YouTube channels still get monetized in 2026?', a: 'Yes. YouTube monetizes faceless channels normally — what it rejects is unoriginal, mass-repeated content. Channels with original narration, a unique angle per video and consistent formats pass review. Every Kineo Short is generated from your own idea with a unique script and voiceover, which is exactly the kind of transformation the policy asks for.' },
]

export default function FacelessChannelIdeasPage() {
  const formAnchor = '#try-a-faceless-idea'
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
          Faceless Channel Ideas · 2026
        </span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.12, margin: '18px 0 0' }}>
          50 Faceless YouTube Channel Ideas for 2026
        </h1>
        <p style={{ fontSize: '1.08rem', color: '#86868b', lineHeight: 1.6, margin: '16px 0 0' }}>
          Fifty concrete faceless channel ideas, organized into ten repeatable niches. Every one works with no camera, no face on screen and no editing: pick an idea, type it into Kineo, and get a finished 9:16 Short with script, AI voiceover, footage and captions in about 60 seconds. New accounts can create up to 3 watermarked Fast videos every 24 hours with no card.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '26px 0 0' }}>
          <OrganicCtaLink href={formAnchor} source="push35_faceless_ideas" placement="hero" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 26px', borderRadius: 980, textDecoration: 'none' }}>Try one of these ideas →</OrganicCtaLink>
          <Link href="/ai-shorts-without-filming" style={{ border: '1px solid #48484a', color: '#f5f5f7', fontWeight: 700, padding: '14px 22px', borderRadius: 980, textDecoration: 'none' }}>How faceless Shorts work</Link>
        </div>
        <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '12px 0 0' }}>
          Up to 3 watermarked Fast videos / 24h · No card · No camera
        </p>

        <TopicGeneratorForm
          campaign={INTENT_CAMPAIGN}
          source="push35_faceless_ideas"
          examples={FORM_EXAMPLES}
          formId="try-a-faceless-idea"
        />

        {CATEGORIES.map((cat, categoryIndex) => (
          <section key={cat.name}>
            <h2 style={h2}>{cat.name}</h2>
            <p style={{ fontSize: 13, color: '#2997ff', fontWeight: 700, margin: '0 0 8px' }}>{cat.rpm}</p>
            <p style={p}>{cat.blurb}</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {cat.ideas.map((idea, ideaIndex) => (
                <div key={idea.t} style={{ background: '#161618', border: '1px solid #2a2a2d', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, color: '#f5f5f7' }}>{idea.t}</div>
                  <div style={{ fontSize: 14, color: '#86868b', marginTop: 4, lineHeight: 1.55 }}>{idea.d}</div>
                  <OrganicCtaLink
                    href={ideaSignupUrl(idea)}
                    source="push35_faceless_ideas"
                    placement={`idea_${categoryIndex + 1}_${ideaIndex + 1}`}
                    style={{ display: 'inline-block', marginTop: 11, color: '#2997ff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}
                  >
                    Make this first Short →
                  </OrganicCtaLink>
                </div>
              ))}
            </div>
          </section>
        ))}

        <h2 style={h2}>How to start your faceless channel today</h2>
        <p style={p}>
          The gap between people who read idea lists and people who own a channel is one uploaded video. Here is the fastest legitimate path from this page to a published Short — no camera, no mic, no editor.
        </p>
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
        <p style={{ ...p, marginTop: 14 }}>
          Curious how it turns a bare topic into a full video? See <Link href="/youtube-shorts-from-topic" style={{ color: '#2997ff' }}>YouTube Shorts from a topic</Link>, or if budget is the concern, the <Link href="/cheapest-ai-shorts-maker" style={{ color: '#2997ff' }}>cheapest AI Shorts maker</Link> breakdown. Plans are on the <Link href="/pricing" style={{ color: '#2997ff' }}>pricing page</Link>.
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
          <div style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900 }}>Pick an idea. Create up to 3 Fast previews every 24h.</div>
          <p style={{ color: '#86868b', margin: '8px 0 18px' }}>One idea in, a ready-to-post faceless Short out in ~60 seconds. No camera, no card.</p>
          <OrganicCtaLink href={formAnchor} source="push35_faceless_ideas" placement="final" style={{ background: '#f5f5f7', color: '#000', fontWeight: 800, padding: '14px 30px', borderRadius: 980, textDecoration: 'none' }}>Choose my first idea →</OrganicCtaLink>
        </div>
      </div>
      <StickyFreeShortCTA />
      <Footer />
    </main>
  )
}
