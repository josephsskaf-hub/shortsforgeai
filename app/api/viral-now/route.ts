// Push #304 — Viral Now: returns today's 3 trending topic cards
// Prompts are fully structured with the 5-element viral formula:
// HOOK → MICRO REWARD ×3-5 → ESCALATION → RHYTHM → PAYOFF
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

MICRO REWARD 1: Rule #1 — they never sell their winners. Warren Buffett has held Coca-Cola stock for 35 years. Every time he almost sold, he lost nothing. Every time he held, he made millions more.

MICRO REWARD 2: Rule #2 — they pay themselves in assets, not cash. Elon Musk takes a $1 salary. Jeff Bezos's net worth is 99% stock. Cash loses value. Assets multiply.

MICRO REWARD 3: Rule #3 — they obsess over one number. Not revenue. Not followers. Return on invested capital. If a dollar in doesn't make more than a dollar out, they cut it immediately.

ESCALATION: And here's what separates the top 0.01% — they combine all three at once. Low salary. Assets that compound. Zero tolerance for bad investments.

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

MICRO REWA