// Push #324 — Viral Now: returns today's 6 trending topic cards (expanded from 3)
// Rotates every 5h via cron. Prompts use the 5-element viral formula:
// HOOK → MICRO REWARD ×3-5 → ESCALATION → RHYTHM → PAYOFF
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Push #311 — FALLBACK_TOPICS updated with [Pexels: xxx] markers per beat.
// generate-video-fast's parseUserScript() detects these and enters verbatim
// mode: each marker becomes a precise Pexels search, eliminating random footage.
const FALLBACK_TOPICS = [
  {
    slot: 1,
    emoji: '💰',
    label: '💰 Billionaire',
    title: 'The 3 rules billionaires never break',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: gold coins stack luxury wealth] Billionaires do not get rich by accident — they follow 3 rules most people never learn.

MICRO REWARD 1: [Pexels: stock market chart upward growth monitor] Rule one — never sell your winners. Warren Buffett has held Coca-Cola stock for 35 years. Every time he almost sold, he lost nothing. Every time he held, he made millions more.

MICRO REWARD 2: [Pexels: businessman minimal office desk working] Rule two — pay yourself in assets, not cash. Elon Musk takes a one dollar salary. Jeff Bezos net worth is 99 percent stock. Cash loses value. Assets multiply.

MICRO REWARD 3: [Pexels: financial spreadsheet calculator numbers close] Rule three — obsess over one number: return on invested capital. If a dollar in does not make more than a dollar out, they cut it immediately.

ESCALATION: [Pexels: skyscraper corporate headquarters city aerial] The top 0.01 percent combine all three at once. Low salary. Assets that compound. Zero tolerance for bad investments.

PAYOFF: [Pexels: person sleeping peacefully while money grows] The average person saves money. Billionaires build systems that make money while they sleep. Start with rule one today. Follow for more.`,
    duration: 45,
    vertical: 'billionaire',
  },
  {
    slot: 2,
    emoji: '🔮',
    label: '🔮 Mystery',
    title: 'The disappearance nobody solved',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: dark foggy empty street night crime scene] In 1947, a woman was found dead in a locked room with a smile on her face. Nobody has ever explained what happened.

MICRO REWARD 1: [Pexels: crime scene tape police investigation dark] The Black Dahlia case. Elizabeth Short was found in Los Angeles, perfectly posed, with no blood at the scene despite being brutally murdered. The killer washed the body, arranged it, and vanished. 77 years later, zero arrests.

MICRO REWARD 2: [Pexels: old house fire smoke ruins abandoned] The Sodder children — on Christmas night 1945, a house fire killed zero adults but five children simply disappeared. No remains were ever found. A private investigator received a photo in the mail 23 years later that looked exactly like one of the missing kids.

MICRO REWARD 3: [Pexels: sandy beach ocean shore mysterious] The Tamam Shud case — a man was found dead on an Australian beach in 1948. No identity. No cause of death. In his pocket: a scrap of paper with words from a book no one could trace. Inside: an uncracked code never deciphered.

ESCALATION: [Pexels: world map three locations highlighted mystery] Three cases. Three countries. Zero answers. All three happened within three years of each other.

PAYOFF: [Pexels: closed cold case file documents archive] Some mysteries do not get solved. They get buried. Save this and ask yourself: what else are we not being told. Follow for more.`,
    duration: 45,
    vertical: 'mystery',
  },
  {
    slot: 3,
    emoji: '🌍',
    label: '🌍 Countries',
    title: 'Countries with insane hidden rules',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: international airport passport control border] These three countries will arrest you for things you do every single day.

MICRO REWARD 1: [Pexels: singapore city skyline clean streets mrt] Singapore. Chewing gum has been illegal since 1992. Not just selling it — importing it. First offense: a 100,000 dollar fine. The law was passed because gum was jamming the MRT subway doors and costing millions in repairs. They simply banned it. Zero exceptions.

MICRO REWARD 2: [Pexels: bhutan mountain monastery himalaya landscape] Bhutan. This country charges tourists 200 dollars per day just to enter — by law. Not a hotel, not a tour. Just the right to be there. They call it the happiness tax. Fewer tourists. More happiness.

MICRO REWARD 3: [Pexels: north korea pyongyang military street soldiers] North Korea. Tourists are allowed but you cannot take a photo without permission. One wrong photo of a soldier or an empty street can get you detained. Several Americans have spent years in custody for a single image.

ESCALATION: [Pexels: handcuffs arrest law enforcement serious] Three countries. Three totally different reasons. But the same result — break the rule and you do not get a warning.

PAYOFF: [Pexels: world globe travel adventure passport] The world does not run on the same rules everywhere. Know before you go. Follow for more.`,
    duration: 45,
    vertical: 'country',
  },,
  {
    slot: 4,
    emoji: '📈',
    label: '📈 Finance',
    title: '5 money traps keeping you broke',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: empty wallet credit cards debt stress] 5 money habits that feel normal — but are silently making you poorer every single month.

MICRO REWARD 1: [Pexels: credit card swipe purchase shopping] Trap one — minimum credit card payments. 5,000 dollars at 24 percent APR, minimum payments: you pay 9,000 in interest over 22 years. More than double what you borrowed.

MICRO REWARD 2: [Pexels: luxury car dealership new car purchase] Trap two — new car. A 35,000 dollar car loses 20 percent the moment you drive off the lot. 7,000 dollars gone in 5 minutes.

MICRO REWARD 3: [Pexels: salary raise promotion celebration office] Trap three — lifestyle creep. Every raise you get, spending rises to match it. Five years later you make more and save the same amount.

MICRO REWARD 4: [Pexels: hospital bill emergency medical expense] Trap four — no emergency fund. One unexpected bill puts you back to zero or into debt.

ESCALATION: [Pexels: person stressed finances laptop bills] Most people are in 3 or more of these traps right now and do not even know it.

PAYOFF: [Pexels: notebook pen financial plan budgeting] Financial freedom is not about making more. It is about stopping the leaks. Save this. Check yourself tonight.`,
    duration: 45,
    vertical: 'money',
  },
  {
    slot: 5,
    emoji: '🧠',
    label: '🧠 Learning',
    title: '3 mental models that change how you think',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: brain neural network glowing thinking concept] 3 thinking tools used by Elon Musk, Warren Buffett, and Charlie Munger — that 99 percent of people have never heard of.

MICRO REWARD 1: [Pexels: rocket launch spacex engineering blueprint] First Principles Thinking. The rocket industry said launches cost 65 million dollars. Musk asked what the raw materials cost. 2 million. He built SpaceX.

MICRO REWARD 2: [Pexels: chess board strategy planning moves] Inversion. Charlie Munger says do not just ask how to succeed — ask what would definitely make you fail. Then avoid those things.

MICRO REWARD 3: [Pexels: calendar clock decision planning future] The 10-10-10 Rule. Before any big decision: how will I feel in 10 minutes? 10 months? 10 years? Most regrets come from decisions that felt good in 10 minutes and terrible in 10 years.

ESCALATION: [Pexels: billionaire executive office strategy whiteboard] Three tools. All free. All used by the wealthiest decision-makers alive. None taught in school.

PAYOFF: [Pexels: person reading book knowledge learning desk] You do not need a higher IQ. You need better thinking frameworks. Save this.`,
    duration: 45,
    vertical: 'learning',
  },
  {
    slot: 6,
    emoji: '🌍',
    label: '🌍 Countries',
    title: 'K2 kills 1 in 4 climbers — here is why',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): [Pexels: mountain peak summit dangerous altitude extreme] Everest has a 1 percent death rate. K2 has 25 percent. Here is why the second-highest mountain is the most lethal.

MICRO REWARD 1: [Pexels: ice glacier hanging serac mountain danger] The Bottleneck — a 45-degree ice gully directly beneath a hanging glacier the size of a 10-story building. In 2008, it collapsed. Eleven climbers died in one day. There is no alternative route.

MICRO REWARD 2: [Pexels: helicopter mountain rescue emergency altitude] No rescue above base camp. On Everest, helicopters reach climbers at 7,000 meters. On K2, the shape makes it physically impossible. If something goes wrong high on the mountain, you walk out or you die.

MICRO REWARD 3: [Pexels: mountaineers summit celebration nepal team] K2 was never summited in winter until January 2021. A Nepali team did it in minus 65 degrees with 200 kilometer per hour winds. They sang their national anthem at the top.

ESCALATION: [Pexels: mountain statistics climbing records deadly] 377 summits. 91 deaths. One in four who reach the top did not survive. That ratio has held for 70 years.

PAYOFF: [Pexels: k2 mountain dramatic landscape wide shot] Everest gets the fame. K2 gets the respect. The deadliest mountain is not the tallest one. Follow for more.`,
    duration: 45,
    vertical: 'country',
  },

]

// Push #314 — reject Supabase rows that still contain pre-#306 Portuguese
// markers (MICRO RECOMPENSA, ESCALADA, GANCHO). If the cron wrote stale rows
// before a deploy finished, those rows would silently serve Portuguese prompts.
// This guard makes the API fall back to English FALLBACK_TOPICS instead.
function hasPortugueseMarkers(prompt: string): boolean {
  return /\b(MICRO RECOMPENSA|ESCALADA|GANCHO|RECOMPENSA FINAL|PAGAMENTO)\b/i.test(prompt)
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('viral_now_topics')
      .select('slot, emoji, label, title, prompt, duration, vertical')
      .eq('date', today)
      .order('slot')

    if (error) throw error

    // Only use Supabase rows if we have all 3 AND none contain Portuguese markers
    const dbRowsAreClean = data && data.length >= 6 &&
      !data.some((t: { prompt: string }) => hasPortugueseMarkers(t.prompt))
    const topics = dbRowsAreClean ? data : FALLBACK_TOPICS

    return NextResponse.json({ topics, date: today })
  } catch (err) {
    console.error('[viral-now] error:', err)
    const today = new Date().toISOString().split('T')[0]
    return NextResponse.json({ topics: FALLBACK_TOPICS, date: today })
  }
}
