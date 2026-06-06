import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

// Push #439 — Viral Score "Apply" button (was a dead handler). The Generate
// page shows up to 3 improvement_suggestions under the viral score. Clicking
// "Apply" now POSTs the current script + the chosen suggestion here; GPT
// rewrites the script applying ONLY that one improvement, the client then
// re-runs /api/analyze-idea on the result so scenes + viral score refresh
// coherently. No credits are charged (analysis is free).

export const maxDuration = 30

type Lang = 'en' | 'pt' | 'es'

function langName(l: Lang): string {
  if (l === 'pt') return 'Brazilian Portuguese (pt-BR)'
  if (l === 'es') return 'Latin American Spanish (es-419)'
  return 'English'
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[apply-suggestion] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { script?: string; suggestion?: string; language?: string; duration?: number }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    const suggestion = (body.suggestion ?? '').trim()
    if (!script || !suggestion) {
      return NextResponse.json({ error: 'Script and suggestion are required.' }, { status: 400 })
    }
    if (script.length > 6000) {
      return NextResponse.json({ error: 'Script is too long (6000 chars max).' }, { status: 400 })
    }

    const language: Lang = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
    const duration = [45, 60, 90].includes(Number(body.duration)) ? Number(body.duration) : 45

    const systemPrompt = `You are a viral YouTube Shorts script doctor. You receive a short-form video script and ONE specific improvement suggestion. Rewrite the script so it FULLY applies that suggestion while preserving everything that already works.

HARD RULES:
- Apply ONLY the requested improvement. Do not change the topic, the real facts, or the overall structure.
- If the script uses section markers (HOOK, MICRO REWARD, ESCALATION, RHYTHM, PAYOFF, or their Portuguese variants GANCHO/MICRO RECOMPENSA/ESCALADA/RITMO/PAGAMENTO), keep those EXACT markers and the same number of sections. Improve the text inside them.
- Keep roughly the same length — this is a ~${duration}-second short.
- Keep every real fact accurate. Never invent fake statistics or fake quotes.
- Write all spoken/voiceover text in ${langName(language)}. Keep any [bracketed] footage cues in English.
- The hook (first line/HOOK section) must still land in the first 1-2 seconds — no "in this video" or "today we will".
- Return ONLY the rewritten script text. No commentary, no headers like "Here is", no markdown code fences.`

    const userMsg = `IMPROVEMENT TO APPLY:\n${suggestion}\n\nSCRIPT TO IMPROVE:\n${script}`

    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 1600,
      },
      { timeout: 25000, maxRetries: 0 }
    )

    let improved = completion.choices[0]?.message?.content?.trim() ?? ''
    // Strip accidental markdown fences if the model wraps the answer.
    improved = improved.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim()

    if (!improved) {
      return NextResponse.json({ error: 'Could not apply the suggestion. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ script: improved })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[apply-suggestion] error:', msg)
    return NextResponse.json({ error: 'Could not apply the suggestion. Please try again.' }, { status: 500 })
  }
}
