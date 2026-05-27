// Push #304 — Viral Now: returns today's 3 trending topic cards
// Prompts are fully structured with the 5-element viral formula:
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
  },
]

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

    const topics = data && data.length === 3 ? data : FALLBACK_TOPICS

    return NextResponse.json({ topics, date: today })
  } catch (err) {
    console.error('[viral-now] error:', err)
    const today = new Date().toISOString().split('T')[0]
    return NextResponse.json({ topics: FALLBACK_TOPICS, date: today })
  }
}
