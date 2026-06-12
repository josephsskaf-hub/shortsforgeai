// Landing demo (13/06) — PUBLIC script generation so visitors feel the magic
// BEFORE signing up: they type a topic on the home hero and watch a real
// structured Short script appear live. The render stays gated behind signup.
//
// Abuse posture (public endpoint, by design):
//   • gpt-4o-mini + max_tokens cap → worst-case cost is fractions of a cent
//   • topic capped at 200 chars
//   • per-IP rolling limit (in-memory per lambda — imperfect on serverless,
//     acceptable because the unit cost is tiny) + 12 demos/day per IP
//   • output is the DEMO script only — no TTS, no footage, no render
import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_PER_WINDOW = 12
const hits = new Map<string, number[]>()

function limited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  return false
}

const SYSTEM = `You are a world-class viral YouTube Shorts scriptwriter. Given a topic, write a tight script for a 45-60s faceless Short, US audience 18-34, US English.

OUTPUT FORMAT — exactly these headers, in this order, nothing else:

HOOK: one pattern-interrupt sentence, max 12 words.
FACT 1: one concrete lesser-known fact (specific name/number/date).
FACT 2: a more surprising fact.
FACT 3: the most counterintuitive fact.
PAYOFF: deliver the concrete answer the hook promised, with a "..." pause before the reveal.

Each line: header, colon, the voiceover sentence. No markdown, no extra commentary.`

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Demo unavailable right now.' }, { status: 500 })
    }
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (limited(ip)) {
      return NextResponse.json(
        { error: 'Demo limit reached for today — create a free account to keep going (30 free credits).' },
        { status: 429 },
      )
    }

    let body: { topic?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const topic = (body.topic ?? '').trim().slice(0, 200)
    if (topic.length < 3) {
      return NextResponse.json({ error: 'Type a topic first.' }, { status: 400 })
    }

    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Topic: ${topic}` },
        ],
        max_tokens: 420,
        temperature: 0.8,
      },
      { timeout: 20000, maxRetries: 1 },
    )
    const script = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!script) {
      return NextResponse.json({ error: 'Could not write the demo script. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ script })
  } catch (err) {
    console.error('[demo-script] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not write the demo script. Try again.' }, { status: 500 })
  }
}
