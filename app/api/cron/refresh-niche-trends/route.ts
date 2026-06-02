// #383e — Cron: refresh the generator's niche example chips with FRESH topics
// 3×/day. Pattern mirrors refresh-viral-now (Bearer CRON_SECRET, service-role
// upsert). For each vertical we pull real headlines from Google News RSS (free,
// no key) and ask GPT-4o-mini to turn them into 3 punchy, concrete Short topics
// (NOT the raw headline). Anti-repetition: we pass the vertical's earlier topics
// from TODAY so the model avoids repeats. Fallback: if a vertical fails, we
// simply don't write it this run — the reader keeps that vertical's last good
// run (per-vertical latest), so a card is never empty.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { openai } from '@/lib/openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vertical → Google News RSS search query. US English edition.
const VERTICAL_QUERIES: Record<string, string> = {
  billionaire: 'billionaire OR "Elon Musk" OR "Jeff Bezos" OR "Warren Buffett" money habits',
  mystery: 'unsolved mystery OR cold case OR unexplained discovery',
  country: 'geography facts OR country travel OR hidden places',
  money: 'personal finance tips OR saving money OR investing',
  learning: 'psychology study OR mental model OR how the brain works',
  history: 'archaeology discovery OR history uncovered OR ancient',
  science: 'science discovery OR physics breakthrough OR research',
  space: 'NASA OR astronomy discovery OR space telescope',
}

function googleNewsRssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
}

// Minimal RSS title extraction (no XML lib). Skips the channel <title> (first).
function extractHeadlines(xml: string, max = 8): string[] {
  const titles: string[] = []
  const re = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const t = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .trim()
    if (t) titles.push(t)
  }
  // First entry is the feed's own title ("..."/"Google News") — drop it.
  return titles.slice(1, 1 + max)
}

async function topicsForVertical(
  vertical: string,
  query: string,
  avoid: string[],
): Promise<string[]> {
  // 1) Pull real, current headlines.
  const res = await fetch(googleNewsRssUrl(query), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShortsForgeAI/1.0)' },
  })
  if (!res.ok) throw new Error(`RSS ${res.status}`)
  const xml = await res.text()
  const headlines = extractHeadlines(xml, 8)
  if (headlines.length === 0) throw new Error('no headlines')

  // 2) Reformat into 3 fresh Short topics (not raw headlines).
  const avoidLine = avoid.length > 0 ? `\n\nDo NOT repeat or closely paraphrase any of these already-used topics:\n- ${avoid.join('\n- ')}` : ''
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content:
          'You turn real news headlines into punchy YouTube Short topic ideas for a US audience aged 18-34. Each idea: one line, max 12 words, concrete and curiosity-driven (a specific fact, number, place, or question) — NEVER a vague headline. Output EXACTLY 3 lines, no numbering, no quotes, no extra text.',
      },
      {
        role: 'user',
        content: `Vertical: ${vertical}\n\nReal headlines today:\n- ${headlines.join('\n- ')}${avoidLine}\n\nWrite 3 fresh Short topic ideas for this vertical, inspired by what's current but rewritten as teachable/curious Shorts.`,
      },
    ],
  })
  const text = completion.choices[0]?.message?.content ?? ''
  const topics = text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)
  if (topics.length < 3) throw new Error(`only ${topics.length} topics`)
  return topics
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const runAt = new Date().toISOString()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  // Anti-repetition: load topics already generated TODAY, grouped by vertical.
  const { data: earlier } = await supabase
    .from('niche_trends')
    .select('vertical, topic')
    .gte('run_at', todayStart.toISOString())
  const avoidByVertical: Record<string, string[]> = {}
  for (const row of earlier ?? []) {
    ;(avoidByVertical[row.vertical] ??= []).push(row.topic)
  }

  const results: Record<string, 'ok' | string> = {}
  const rows: Array<{ vertical: string; slot: number; topic: string; run_at: string }> = []

  // Run verticals sequentially to stay within RSS/OpenAI rate limits.
  for (const [vertical, query] of Object.entries(VERTICAL_QUERIES)) {
    try {
      const topics = await topicsForVertical(vertical, query, avoidByVertical[vertical] ?? [])
      topics.forEach((topic, i) => rows.push({ vertical, slot: i + 1, topic, run_at: runAt }))
      results[vertical] = 'ok'
    } catch (err) {
      // Per-vertical failure is non-fatal: skip it this run. The reader keeps
      // this vertical's previous run, so its card is never empty.
      results[vertical] = err instanceof Error ? err.message : String(err)
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('niche_trends').insert(rows)
    if (error) {
      console.error('[refresh-niche-trends] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Optional housekeeping: keep the table small — delete rows older than 3 days.
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('niche_trends').delete().lt('run_at', threeDaysAgo)

  console.log('[refresh-niche-trends] run', runAt, 'inserted', rows.length, 'results', results)
  return NextResponse.json({ ok: true, run_at: runAt, inserted: rows.length, results })
}
