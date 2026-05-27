// Push #301 — Cron: refresh Viral Now topics daily at 6 AM UTC
// Vercel calls this; secret header guards against public access.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Topic pool — rotate through these so cards change every day.
// 15 topics = ~5 days before repeating; easy to expand.
const TOPIC_POOL: Array<{
  emoji: string
  label: string
  title: string
  prompt: string
  duration: number
  vertical: string
}> = [
  // Billionaire / Money
  {
    emoji: '💰', label: '💰 Money',
    title: 'How billionaires stay rich forever',
    prompt: 'The 3 money rules billionaires never break: compound interest, tax-free accounts, and never selling winners',
    duration: 45, vertical: 'billionaire',
  },
  {
    emoji: '💰', label: '💰 Money',
    title: "Bezos's daily habit that made him $200B",
    prompt: "Jeff Bezos's 3 daily habits that compounded into $200 billion — the morning routine, the decision rule, and the meeting rule",
    duration: 45, vertical: 'billionaire',
  },
  {
    emoji: '📈', label: '📈 Finance',
    title: '5 money traps keeping you broke',
    prompt: '5 silent money traps that keep 90% of people broke — lifestyle creep, minimum payments, depreciating assets, FOMO investing, and no emergency fund',
    duration: 45, vertical: 'money',
  },
  {
    emoji: '📈', label: '📈 Finance',
    title: 'The compound interest trick nobody shows you',
    prompt: 'How compound interest turns $200 per month into $1 million — the math, the timeline, and why starting at 25 vs 35 costs you $400,000',
    duration: 45, vertical: 'money',
  },
  {
    emoji: '💰', label: '💰 Money',
    title: 'What billionaires do every Sunday night',
    prompt: "3 things every self-made billionaire does on Sunday night — week planning, reading non-fiction, and the one phone call that changed everything",
    duration: 45, vertical: 'billionaire',
  },
  // Mystery / Weird History
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: 'The disappearance nobody solved',
    prompt: '3 most baffling disappearances in history that were never explained — the 1920 Norfolk Regiment, the Mary Celeste, and the Sodder children',
    duration: 45, vertical: 'mystery',
  },
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: 'The Dyatlov Pass — what really happened',
    prompt: 'The Dyatlov Pass incident: 9 hikers found dead in the Soviet Urals in 1959, one with a missing tongue — 3 facts that still have no explanation',
    duration: 45, vertical: 'mystery',
  },
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: "History's most shocking unsolved codes",
    prompt: '3 codes nobody has cracked: the Voynich Manuscript, the Beale Ciphers hiding a $63M treasure, and the Zodiac Killer cipher solved 51 years later',
    duration: 45, vertical: 'mystery',
  },
  // Countries / Places
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'Countries with insane hidden rules',
    prompt: '5 countries with laws so extreme tourists get arrested without knowing — Singapore chewing gum, Bhutan TV ban, Japan tattoo rules',
    duration: 45, vertical: 'country',
  },
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'K2 has a 25% death rate — here is why',
    prompt: 'K2 kills 1 in 4 climbers who attempt the summit — the 3 reasons it is deadlier than Everest: the Bottleneck, serac falls, and no helicopter rescue above 6,000m',
    duration: 45, vertical: 'country',
  },
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'Singapore: the city-state that broke every rule',
    prompt: "5 facts about Singapore that sound impossible: $1 trillion GDP per km2, death penalty for drugs, no chewing gum, mandatory military service, and the world's most expensive city",
    duration: 45, vertical: 'country',
  },
  // Learning / Mental Models
  {
    emoji: '🧠', label: '🧠 Learning',
    title: '3 mental models that change how you think',
    prompt: '3 mental models used by the world\'s top decision-makers: first-principles thinking, inversion, and the 10/10/10 rule — with real examples',
    duration: 45, vertical: 'learning',
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'The Pareto Principle — why 20% rules everything',
    prompt: 'The Pareto Principle explained in 45 seconds: why 20% of your effort creates 80% of your results, and how billionaires use it to work less and earn more',
    duration: 45, vertical: 'learning',
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'Facts that sound fake but are 100% true',
    prompt: '5 facts that will make people call you a liar: Oxford University is older than the Aztec Empire, there are more possible chess games than atoms in the universe, and 3 more',
    duration: 45, vertical: 'learning',
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'Why your brain is lying to you right now',
    prompt: '3 cognitive biases hardwired into every human brain — confirmation bias, the Dunning-Kruger effect, and sunk cost fallacy — with a real example of each',
    duration: 45, vertical: 'learning',
  },
]

function pickTopicsForDate(dateStr: string) {
  // Deterministic shuffle based on date so all users see the same 3 topics.
  const seed = dateStr.replace(/-/g, '')
  const n = parseInt(seed, 10) % TOPIC_POOL.length
  const pool = [...TOPIC_POOL.slice(n), ...TOPIC_POOL.slice(0, n)]
  return [pool[0], pool[1], pool[2]]
}

export async function GET(req: NextRequest) {
  // Guard: Vercel sends this header for cron jobs
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const today = new Date().toISOString().split('T')[0]
    const picked = pickTopicsForDate(today)

    // Upsert: if cron runs twice, just overwrite
    const rows = picked.map((t, i) => ({
      date: today,
      slot: i + 1,
      emoji: t.emoji,
      label: t.label,
      title: t.title,
      prompt: t.prompt,
      duration: t.duration,
      vertical: t.vertical,
    }))

    const { error } = await supabase
      .from('viral_now_topics')
      .upsert(rows, { onConflict: 'date,slot' })

    if (error) throw error

    console.log('[refresh-viral-now] updated topics for', today)
    return NextResponse.json({ ok: true, date: today, count: rows.length })
  } catch (err) {
    console.error('[refresh-viral-now] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
