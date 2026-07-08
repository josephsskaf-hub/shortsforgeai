// KINEO-PUBLIC-VIRALSCORE-2026-07-08 — free public "Will it go viral?" grader.
//
// Public (no-auth) endpoint that scores a Short idea with the SAME kind of LLM
// brain the product uses, but on the cheap model (gpt-4o-mini) and calibrated to
// THIS channel's real view data (Snake Island viral vs billionaire weak). Lead
// magnet: brings new people in, then funnels them to signup. Guardrails: input
// length cap + best-effort per-IP rate limit + heuristic fallback so it never
// hard-fails (and never blocks on OpenAI being down or unbilled).
import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const MAX_LEN = 300
const RATE_MAX = 10 // requests
const RATE_WINDOW = 60_000 // per minute, per IP (best-effort; serverless-local)
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW)
  if (arr.length >= RATE_MAX) return true
  arr.push(now)
  hits.set(ip, arr)
  return false
}

type Score = {
  overall: number
  hook: number
  retention: number
  trend: number
  share: number
  verdict: string
  subtitle: string
  tips: string[]
}

const VERDICTS = ['Weak', 'Okay', 'Good', 'Strong', 'Viral-ready'] as const

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

// Server-side heuristic used ONLY if the model call fails — keeps the tool alive.
function heuristic(idea: string): Score {
  const t = idea.toLowerCase()
  const hasNum = /\d/.test(t)
  const hook = Math.min(10, 3 + (hasNum ? 2 : 0) + (/(why|how|secret|nobody|never|forbidden|illegal|hidden|truth|mistake)/.test(t) ? 3 : 0) + (idea.split(/\s+/).length <= 14 ? 2 : 0))
  const trend = Math.min(10, 3 + (/(money|rich|billionaire|invest|mystery|unsolved|island|country|mountain|history|murder|space|brain|ai)/.test(t) ? 4 : 0) + (hasNum ? 1 : 0))
  const retention = Math.min(10, 3 + (/(things|reasons|facts|ways|signs|rules|habits|until|then)/.test(t) ? 2 : 0) + (hasNum ? 2 : 0) + 1)
  const share = Math.min(10, 3 + (/(actually|truth|myth|most people|insane|shocking|forbidden|illegal|murder)/.test(t) ? 3 : 0) + (hasNum ? 1 : 0))
  const overall = Math.max(1, Math.min(100, Math.round(hook * 3.2 + retention * 2.4 + trend * 2.2 + share * 2.2)))
  const vi = overall >= 85 ? 4 : overall >= 70 ? 3 : overall >= 50 ? 2 : overall >= 35 ? 1 : 0
  return { overall, hook, retention, trend, share, verdict: VERDICTS[vi], subtitle: 'Scored offline — try again for the full AI read.', tips: ['Lead with a number or a contrarian claim.', 'Anchor it to a hot lane: money, mystery, or an extreme place.'] }
}

const SYSTEM = `You are Kineo's viral-potential engine for short-form video (YouTube Shorts / TikTok), US audience.
Score the user's Short IDEA. Rate 4 axes, each an integer 0-10:
- hook: does the first line stop the scroll? Numbers, contrarian claims, curiosity gaps, forbidden/never/nobody angles score HIGH; generic "facts about X" scores LOW.
- retention: is there a reason to watch to the end? lists, build-up, a payoff/twist score HIGH.
- trend: does it fit a proven hot lane (money/wealth, mysteries & weird history, extreme places & geography, mind-blowing facts, billionaires)? on-lane = HIGH.
- share: would someone send it to a friend? surprising, emotional, save-worthy = HIGH.
Calibrate your SCALE to this real channel data (do not overrate):
- "Snake Island — the most forbidden island on Earth" went viral (~11,400 views) => overall ~85.
- "A billionaire's morning routine" was weak (~818 views) => overall ~50.
- A generic "facts about X" with no hook => ~25.
Compute overall = round(hook*3.2 + retention*2.4 + trend*2.2 + share*2.2), clamped 1-100.
Pick verdict from exactly: Weak (<35), Okay (35-49), Good (50-69), Strong (70-84), Viral-ready (85+).
Give 2-4 short, specific, actionable tips to raise the score (imperative, <14 words each).
Respond with ONLY a JSON object, no prose:
{"overall":int,"hook":int,"retention":int,"trend":int,"share":int,"verdict":"...","subtitle":"one short sentence","tips":["..."]}`

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? 'anon').split(',')[0].trim() || 'anon'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests — wait a minute and try again.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const raw = typeof body?.idea === 'string' ? body.idea.trim() : ''
    if (raw.length < 4) {
      return NextResponse.json({ error: 'Type a real idea first.' }, { status: 400 })
    }
    const idea = raw.slice(0, MAX_LEN)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ...heuristic(idea), engine: 'heuristic' })
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Short idea: "${idea}"` },
        ],
      })
      const content = completion.choices?.[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(content) as Partial<Score>
      const hook = clampInt(parsed.hook, 0, 10, 5)
      const retention = clampInt(parsed.retention, 0, 10, 5)
      const trend = clampInt(parsed.trend, 0, 10, 5)
      const share = clampInt(parsed.share, 0, 10, 5)
      const overall = clampInt(
        parsed.overall,
        1,
        100,
        Math.round(hook * 3.2 + retention * 2.4 + trend * 2.2 + share * 2.2),
      )
      const verdict = (VERDICTS as readonly string[]).includes(parsed.verdict ?? '')
        ? (parsed.verdict as string)
        : overall >= 85 ? 'Viral-ready' : overall >= 70 ? 'Strong' : overall >= 50 ? 'Good' : overall >= 35 ? 'Okay' : 'Weak'
      const tips = Array.isArray(parsed.tips)
        ? parsed.tips.filter((t) => typeof t === 'string').slice(0, 4)
        : []
      const subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle.slice(0, 120) : ''
      const out: Score & { engine: string } = { overall, hook, retention, trend, share, verdict, subtitle, tips, engine: 'kineo-ai' }
      return NextResponse.json(out)
    } catch (modelErr) {
      console.error('[public/viral-score] model failed, using heuristic:', modelErr instanceof Error ? modelErr.message : String(modelErr))
      return NextResponse.json({ ...heuristic(idea), engine: 'heuristic' })
    }
  } catch (err) {
    console.error('[public/viral-score] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
