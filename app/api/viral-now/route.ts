// Push #301 — Viral Now: returns today's 3 trending topic cards
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Fallback pool used when DB has no rows for today (e.g. first deploy)
const FALLBACK_TOPICS = [
  {
    slot: 1,
    emoji: '💰',
    label: '💰 Money',
    title: 'How billionaires stay rich forever',
    prompt: 'The 3 money rules billionaires never break: compound interest, tax-free accounts, and never selling winners',
    duration: 45,
    vertical: 'billionaire',
  },
  {
    slot: 2,
    emoji: '🔮',
    label: '🔮 Mystery',
    title: 'The disappearance nobody solved',
    prompt: 'The 3 most baffling disappearances in history that were never explained — including the 1920 Norfolk Regiment vanishing',
    duration: 45,
    vertical: 'mystery',
  },
  {
    slot: 3,
    emoji: '🌍',
    label: '🌍 Countries',
    title: 'Countries with insane hidden rules',
    prompt: '5 countries with laws so extreme tourists get arrested without knowing — Singapore chewing gum, Bhutan TV ban, North Korea selfies',
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
    // Always return something so the dashboard never breaks
    const today = new Date().toISOString().split('T')[0]
    return NextResponse.json({ topics: FALLBACK_TOPICS, date: today })
  }
}
