// #478 — Programmatic SEO landing pages per niche. Targets long-tail, high-intent
// searches like "free AI [finance] shorts generator" / "faceless [history] video
// maker". Statically generated + in the sitemap so Google indexes them. Each page
// is real content (unique H1, intro, example ideas, how-it-works) + a CTA to
// /signup with niche-tagged UTMs so the funnel dashboard attributes the traffic.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'

export const dynamic = 'force-static'
export const dynamicParams = false

type Niche = { label: string; h1: string; intro: string; ideas: string[] }

const NICHES: Record<string, Niche> = {
  money: {
    label: 'Money & Finance',
    h1: 'Free AI Money & Finance Shorts Generator',
    intro:
      'Turn any money or finance idea into a ready-to-post YouTube Short usually in 2–4 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage — no filming, no editing, no face on camera.',
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
      'Turn any unsolved case or eerie mystery into a binge-worthy YouTube Short usually in 2–4 minutes. The AI writes the script, voices it, adds captions and footage — fully faceless.',
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
      'Turn any historical event into a gripping YouTube Short usually in 2–4 minutes — script, voiceover, captions and footage generated automatically. No editing skills needed.',
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
      'Turn any mindset or discipline idea into a punchy, shareable YouTube Short usually in 2–4 minutes. The AI handles the script, voiceover, captions and visuals — you just pick the idea.',
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
      'Turn any surprising fact into a scroll-stopping YouTube Short usually in 2–4 minutes. The AI writes, voices, captions and sources the footage automatically — completely faceless.',
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
      'Turn any AI or tech topic into a timely YouTube Short usually in 2–4 minutes. Script, voiceover, captions and footage are generated for you — post daily without touching an editor.',
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
      'Turn any country, city or place into a fascinating YouTube Short usually in 2–4 minutes. The AI writes the script, adds the voiceover, captions and footage — no filming required.',
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
      'Turn any space topic into a mind-bending YouTube Short usually in 2–4 minutes. The AI writes, voices, captions and finds the footage — fully faceless, ready to post.',
    ideas: [
      'What NASA found on Mars they never announced',
      'The sound a black hole actually makes',
      'Why a day on Venus is longer than its year',
      'The object moving too fast to explain',
      'What’s really at the edge of the universe',
    ],
  },
  truecrime: {
    label: 'True Crime',
    h1: 'Free AI True Crime Shorts Generator',
    intro:
      'Turn any unsolved case or cold case into a gripping, binge-worthy YouTube Short usually in 2–4 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage — no filming, no editing, completely faceless.',
    ideas: [
      'The cold case solved by a single typo',
      'The killer who mailed the police his own confession',
      'The 911 call that proved she did it',
      'The murder that stayed unsolved for 40 years — until a DNA test',
      'The witness who described a face that didn’t exist',
    ],
  },
  psychology: {
    label: 'Psychology Facts',
    h1: 'Free AI Psychology Shorts Generator',
    intro:
      'Turn any mind trick or behavior insight into a scroll-stopping YouTube Short usually in 2–4 minutes. The AI writes the script, voices it, adds captions and footage automatically — fully faceless.',
    ideas: [
      'Say this one sentence and people instantly trust you',
      'The reason your brain remembers embarrassment forever',
      'Why silence makes people tell you everything',
      'The 7-second trick that ends almost any argument',
      'The dark psychology trick used in every supermarket',
    ],
  },
  sports: {
    label: 'Sports Legends',
    h1: 'Free AI Sports Legends Shorts Generator',
    intro:
      'Turn any iconic moment or legendary athlete into an electric YouTube Short usually in 2–4 minutes. The AI writes the script, records the voiceover, adds captions and footage — no editing skills needed, completely faceless.',
    ideas: [
      'The shot that ended a career in one second',
      'The athlete who was told he’d never walk again',
      'The 13 seconds that rewrote sports history',
      'The record nobody has touched in 50 years',
      'The play coaches still can’t explain',
    ],
  },
  science: {
    label: 'Science Facts',
    h1: 'Free AI Science Shorts Generator',
    intro:
      'Turn any mind-blowing science fact into a jaw-dropping YouTube Short usually in 2–4 minutes. The AI writes, voices, captions and sources the footage automatically — no filming required.',
    ideas: [
      'There’s enough gold in the ocean to make everyone rich — here’s the catch',
      'A teaspoon of a neutron star weighs 6 billion tons',
      'Your atoms are older than the sun',
      'The experiment that proved reality isn’t real until you look',
      'Why time runs faster at your head than your feet',
    ],
  },
  conspiracy: {
    label: 'Conspiracies & Cover-ups',
    h1: 'Free AI Conspiracy Shorts Generator',
    intro:
      'Turn any conspiracy or alleged cover-up into a suspenseful YouTube Short usually in 2–4 minutes. The AI writes the script, voices it, adds captions and footage — fully faceless, ready to post.',
    ideas: [
      'The “accident” that destroyed the evidence days before the trial',
      'The document declassified 50 years too late',
      'The town that doesn’t officially exist on any map',
      'The whistleblower who vanished a week before testifying',
      'The patent the government buried for 30 years',
    ],
  },
  luxury: {
    label: 'Luxury & Billionaire',
    h1: 'Free AI Luxury & Billionaire Shorts Generator',
    intro:
      'Turn any luxury or billionaire topic into an aspirational, scroll-stopping YouTube Short usually in 2–4 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage — no filming, no editing, completely faceless.',
    ideas: [
      'What a $500 million yacht actually costs to run per day',
      'The hotel room that costs more per night than a house',
      'How billionaires legally pay almost zero tax',
      'The watch worth more than a private jet',
      'Inside the $2 billion home nobody is allowed to enter',
    ],
  },
  stoicism: {
    label: 'Stoicism & Philosophy',
    h1: 'Free AI Stoicism Shorts Generator',
    intro:
      'Turn any Stoic idea or life lesson into a calm, powerful YouTube Short usually in 2\u20134 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage \u2014 no filming, no editing, completely faceless.',
    ideas: [
      'The Stoic rule that kills anxiety in 10 seconds',
      'Marcus Aurelius\u2019 morning routine that still works today',
      'Why caring less makes people respect you more',
      'The one question Stoics ask before reacting',
      'How to stay calm when everything falls apart',
    ],
  },
  crypto: {
    label: 'Crypto & Investing',
    h1: 'Free AI Crypto Shorts Generator',
    intro:
      'Turn any crypto or investing topic into a timely, scroll-stopping YouTube Short usually in 2\u20134 minutes. The AI writes the script, voices it, adds captions and footage \u2014 fully faceless, ready to post daily.',
    ideas: [
      'The $100 Bitcoin bet that turned into a fortune',
      'Why most people buy crypto at exactly the wrong time',
      'The investing mistake that quietly wipes out beginners',
      '3 assets that quietly beat Bitcoin last year',
      'What the rich understand about money that you don\u2019t',
    ],
  },
  business: {
    label: 'Business & Entrepreneurship',
    h1: 'Free AI Business Shorts Generator',
    intro:
      'Turn any business or startup lesson into a sharp YouTube Short usually in 2\u20134 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage \u2014 no editing skills needed.',
    ideas: [
      'The business that made millions with almost no employees',
      'Why 90% of startups die in the first year',
      'The pricing trick that doubled their revenue overnight',
      'How this founder turned $500 into a 7-figure brand',
      'The one skill that separates rich founders from broke ones',
    ],
  },
  fitness: {
    label: 'Fitness & Gym Motivation',
    h1: 'Free AI Fitness Shorts Generator',
    intro:
      'Turn any fitness or discipline idea into a high-energy YouTube Short usually in 2\u20134 minutes. The AI writes, voices, captions and sources the footage automatically \u2014 completely faceless.',
    ideas: [
      'The 20-minute habit that changes your body in 30 days',
      'Why most people never see gym results \u2014 and the fix',
      'The mindset shift that makes discipline automatic',
      '3 mistakes quietly killing your gains',
      'What your body does after 100 days of training',
    ],
  },
  relationships: {
    label: 'Relationships & Dating',
    h1: 'Free AI Relationship Shorts Generator',
    intro:
      'Turn any relationship or dating insight into a scroll-stopping YouTube Short usually in 2\u20134 minutes. The AI writes the script, voices it, adds captions and footage \u2014 fully faceless.',
    ideas: [
      'The one text that instantly changes how they see you',
      'Why the person who cares less holds the power',
      'The green flag almost everyone ignores',
      'What silence tells you about how someone really feels',
      'The psychology trick that builds instant attraction',
    ],
  },
  horror: {
    label: 'Scary Stories & Horror',
    h1: 'Free AI Horror Shorts Generator',
    intro:
      'Turn any scary story or creepy legend into a binge-worthy YouTube Short usually in 2\u20134 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage \u2014 completely faceless.',
    ideas: [
      'The 3am rule you should never break',
      'The last text she sent before she vanished',
      'The house that no delivery driver will return to',
      'The voicemail that played 20 years after he died',
      'The urban legend that turned out to be real',
    ],
  },
  celebrity: {
    label: 'Celebrity & Fame',
    h1: 'Free AI Celebrity Shorts Generator',
    intro:
      'Turn any celebrity story or fame topic into a scroll-stopping YouTube Short usually in 2\u20134 minutes. The AI writes, voices, captions and sources the footage automatically \u2014 no filming required.',
    ideas: [
      'The star who went from broke to a billion dollars',
      'The contract clause that ended a career overnight',
      'The role that was secretly turned down 7 times',
      'What fame does to the brain that nobody talks about',
      'The celebrity feud that was fake the whole time',
    ],
  },
  animals: {
    label: 'Animals & Nature',
    h1: 'Free AI Animal Shorts Generator',
    intro:
      'Turn any animal or nature fact into a jaw-dropping YouTube Short usually in 2\u20134 minutes. The AI writes the script, adds the voiceover, captions and footage \u2014 fully faceless, ready to post.',
    ideas: [
      'The animal that can survive being frozen solid',
      'Why octopuses might be the closest thing to aliens',
      'The tiny creature that could outlive the sun',
      'The predator that hunts using electricity',
      'The bird smarter than a 7-year-old child',
    ],
  },
  health: {
    label: 'Health & Longevity',
    h1: 'Free AI Health Shorts Generator',
    intro:
      'Turn any health or longevity tip into a clean, credible YouTube Short usually in 2\u20134 minutes. The AI writes the script, records the voiceover, adds captions and finds the footage \u2014 no filming, no editing, completely faceless.',
    ideas: [
      'The 30-second habit that adds years to your life',
      'What happens to your body when you walk daily',
      'The nutrient 90% of people are quietly missing',
      'Why your sleep matters more than your diet',
      'The morning routine backed by longevity science',
    ],
  },
  cars: {
    label: 'Cars & Supercars',
    h1: 'Free AI Car Shorts Generator',
    intro:
      'Turn any car or supercar topic into a high-octane YouTube Short usually in 2\u20134 minutes. The AI writes, voices, captions and sources the footage automatically \u2014 fully faceless, ready to post.',
    ideas: [
      'The $3 million car only 10 people can buy',
      'Why this engine should be illegal',
      'The car that depreciates faster than anything',
      'What the fastest car on Earth actually costs to own',
      'The hidden feature supercar owners never use',
    ],
  },
  gaming: {
    label: 'Gaming',
    h1: 'Free AI Gaming Shorts Generator',
    intro:
      'Turn any gaming story or fact into a fast-paced YouTube Short usually in 2\u20134 minutes. The AI writes the script, adds the voiceover, captions and footage \u2014 no editing skills needed.',
    ideas: [
      'The game that was never supposed to exist',
      'The speedrun record thought to be impossible',
      'The easter egg hidden for 15 years',
      'Why this game bankrupted its studio',
      'The glitch that became a feature',
    ],
  },
  movies: {
    label: 'Movie & Film Facts',
    h1: 'Free AI Movie Shorts Generator',
    intro:
      'Turn any movie fact or behind-the-scenes story into a scroll-stopping YouTube Short usually in 2\u20134 minutes. The AI writes, voices, captions and sources the footage automatically \u2014 completely faceless.',
    ideas: [
      'The movie scene that was completely unscripted',
      'The role that was recast at the last minute',
      'Why this blockbuster almost never got made',
      'The hidden detail nobody noticed for years',
      'The ending that was secretly changed',
    ],
  },
  food: {
    label: 'Food & Cooking Facts',
    h1: 'Free AI Food Shorts Generator',
    intro:
      'Turn any food fact or cooking secret into a mouth-watering YouTube Short usually in 2\u20134 minutes. The AI writes the script, records the voiceover, adds captions and footage \u2014 fully faceless.',
    ideas: [
      'The food that never actually expires',
      'Why restaurants add this one secret ingredient',
      'The dish that started as a mistake',
      'What your favorite snack is really made of',
      'The cooking myth almost everyone believes',
    ],
  },
  travel: {
    label: 'Travel & Places',
    h1: 'Free AI Travel Shorts Generator',
    intro:
      'Turn any travel destination or hidden place into a wanderlust-inducing YouTube Short usually in 2\u20134 minutes. The AI writes, voices, captions and finds the footage automatically \u2014 no filming required.',
    ideas: [
      'The place tourists are banned from entering',
      'The town that only exists for one month a year',
      'The hidden beach locals keep secret',
      'The country you can visit for almost nothing',
      'The most isolated place humans still live',
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
  const title = `${n.h1} — Kineo`
  const description = `${n.intro} Create up to 3 watermarked Fast videos every 24h with no card. Starter is $4.90 for the first month.`
  const url = `https://www.usekineo.com/free-ai-shorts/${params.niche}`
  return {
    metadataBase: new URL('https://www.usekineo.com'),
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

  const campaign = `push63_niche_${params.niche}`
  const signupUrl = `/signup?utm_source=seo&utm_medium=organic&utm_campaign=${campaign}&intent_campaign=${campaign}&create_intent=fast`
  const signupUrlForIdea = (idea: string) => `${signupUrl}&prompt=${encodeURIComponent(idea)}`
  const primaryIdea = n.ideas[0]

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          Kineo
        </Link>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
            {n.h1}
          </h1>
          <p style={{ fontSize: '1.02rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 620 }}>
            {n.intro}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#86868b', margin: '10px 0 0' }}>
            Script • Voiceover • Captions • Footage • Ready in a few minutes · <b style={{ color: '#2997ff' }}>up to 3 watermarked Fast videos / 24h</b>, no card
          </p>
          <OrganicCtaLink
            href={signupUrlForIdea(primaryIdea)}
            source={campaign}
            placement="hero"
            style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#2997ff,#2997ff)', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}
          >
            Generate a free {n.label} Fast video →
          </OrganicCtaLink>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Pick an idea', d: `Type any ${n.label.toLowerCase()} topic — or use one of the ready-made viral ideas below.` },
              { n: '2', t: 'AI builds the video', d: 'The script, voiceover, on-screen captions and footage are generated automatically.' },
              { n: '3', t: 'Download & post', d: 'Get a vertical 9:16 MP4 in a few minutes, ready for YouTube Shorts, TikTok or Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(41,151,255,0.12)', color: '#2997ff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86868b', lineHeight: 1.5 }}>{s.d}</p>
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
              <OrganicCtaLink key={idea} href={signupUrlForIdea(idea)} source={campaign} placement="idea" style={{ ...CARD, borderRadius: 12, padding: '14px 16px', textDecoration: 'none', color: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{idea}</span>
                <span style={{ color: '#2997ff', fontWeight: 900, whiteSpace: 'nowrap' }}>Make it →</span>
              </OrganicCtaLink>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 48, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Make a {n.label} Fast video free</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>Up to 3 watermarked Fast videos every 24h. No card. Starter is $4.90 for the first month when you want clean exports.</p>
          <OrganicCtaLink
            href={signupUrlForIdea(primaryIdea)}
            source={campaign}
            placement="final"
            style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Start free →
          </OrganicCtaLink>
        </section>

        <nav style={{ marginTop: 40, textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
          <span>More: </span>
          {NICHE_SLUGS.filter((s) => s !== params.niche).map((s, i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Link href={`/free-ai-shorts/${s}`} style={{ color: '#86868b', textDecoration: 'none' }}>{NICHES[s].label}</Link>
            </span>
          ))}
        </nav>
      </div>
      <Footer />
    </main>
  )
}
