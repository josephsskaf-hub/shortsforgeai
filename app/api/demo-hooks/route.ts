// Landing demo — PUBLIC viral-hook generator (no auth), feeds the free
// /free-hook-generator lead-magnet page. Same abuse posture as /api/demo-script:
// gpt-4o-mini + token cap, topic capped at 200 chars, per-IP 12/day limit.
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

const SYSTEM = `You are a world-class short-form hook writer for faceless YouTube Shorts / TikToks, US audience 18-34, US English.
Given a topic, output exactly 5 scroll-stopping opening hooks (the first spoken line of a Short).
Rules: each hook max 12 words, pattern-interrupt or curiosity-gap, no emojis, no hashtags, no numbering inside the text.
OUTPUT FORMAT: exactly 5 lines, one hook per line, nothing else.`

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
        { error: 'Demo limit reached for today — create a free account to keep going (make videos free).' },
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
        max_tokens: 220,
        temperature: 0.9,
      },
      { timeout: 20000, maxRetries: 1 },
    )
    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const hooks = raw
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5)
    if (hooks.length === 0) {
      return NextResponse.json({ error: 'Could not write hooks. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ hooks })
  } catch (err) {
    console.error('[demo-hooks] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not write hooks. Try again.' }, { status: 500 })
  }
}
