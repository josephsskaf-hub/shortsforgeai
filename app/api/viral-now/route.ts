// Push #304 — Viral Now: returns today's 3 trending topic cards
// Prompts are fully structured with the 5-element viral formula:
// HOOK → MICRO RECOMPENSA ×3-5 → ESCALADA → RITMO → PAYOFF
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Fallback pool — prompts already contain the full viral structure so the
// generator receives a rich, ready-to-use script blueprint, not just a topic.
const FALLBACK_TOPICS = [
  {
    slot: 1,
    emoji: '💰',
    label: '💰 Billionaire',
    title: 'The 3 rules billionaires never break',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): "Billionaires don't get rich by accident — they follow 3 rules most people never learn."

MICRO RECOMPENSA 1: Rule #1 — they never sell their winners. Warren Buffett has held Coca-Cola stock for 35 years. Every time he almost sold, he lost nothing. Every time he held, he made millions more.

MICRO RECOMPENSA 2: Rule #2 — they pay themselves in assets, not cash. Elon Musk takes a $1 salary. Jeff Bezos's net worth is 99% stock. Cash loses value. Assets multiply.

MICRO RECOMPENSA 3: Rule #3 — they obsess over one number. Not revenue. Not followers. Return on invested capital. If a dollar in doesn't make more than a dollar out, they cut it immediately.

ESCALADA: And here's what separates the top 0.01% — they combine all three at once. Low salary. Assets that compound. Zero tolerance for bad investments.

PAYOFF: The average person saves money. Billionaires build systems that make money while they sleep. Start with Rule #1 today.`,
    duration: 45,
    vertical: 'billionaire',
  },
  {
    slot: 2,
    emoji: '🔮',
    label: '🔮 Mystery',
    title: 'The disappearance nobody solved',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): "In 1947, a woman was found dead in a locked room — with a smile on her face. Nobody has ever explained what happened."

MICRO RECOMPENSA 1: The Black Dahlia case. Elizabeth Short was found in Los Angeles, perfectly posed, with no blood at the scene — despite being brutally murdered. The killer washed the body, arranged it, and vanished. 77 years later, zero arrests.

MICRO RECOMPENSA 2: The Sodder children — on Christmas night 1945, a house fire killed zero adults but 5 children simply disappeared. No remains were ever found. A private investigator received a photo in the mail 23 years later. It looked exactly like one of the missing kids.

MICRO RECOMPENSA 3: The Tamam Shud case — a man was found dead on an Australian beach in 1948. No identity. No cause of death. In his pocket: a scrap of paper with the words "Tamam Shud" — Persian for "it is ended." The book it was torn from was found in a car nearby. Inside: an uncracked code that has never been deciphered.

ESCALADA: Three cases. Three countries. Zero answers. The scariest part? All three happened within 3 years of each other.

PAYOFF: Some mysteries don't get solved. They get buried. Save this — and ask yourself: what else are we not being told?`,
    duration: 45,
    vertical: 'mystery',
  },
  {
    slot: 3,
    emoji: '🌍',
    label: '🌍 Countries',
    title: 'Countries with insane hidden rules',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK (0-2s): "These 3 countries will arrest you for things you do every single day."

MICRO RECOMPENSA 1: Singapore. Chewing gum has been illegal since 1992. Not just selling it — importing it. First offense: a $100,000 fine. The law was passed because gum was jamming the doors of the MRT subway system and costing millions in repairs. They simply banned it. Zero exceptions.

MICRO RECOMPENSA 2: Bhutan. This country charges tourists $200 per day just to enter — by law. Not a hotel, not a tour. Just the right to be there. They call it the "happiness tax." Fewer tourists. More happiness. GDP per person is higher than most of their neighbors.

MICRO RECOMPENSA 3: North Korea. Tourists are allowed — but you cannot take a photo without permission. Every shot must be approved by your government-assigned guide. One wrong photo of a soldier, a broken building, or an empty street can get you detained. Several Americans have spent years in custody for a single image.

ESCALADA: Three countries. Three totally different reasons. But the same result — break the rule and you don't get a warning.

PAYOFF: The world doesn't run on the same rules everywhere. Know before you go.`,
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
