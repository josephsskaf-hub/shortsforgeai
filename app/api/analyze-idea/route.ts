import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 30

interface AnalyzePayload {
  title: string
  summary: string
  niche: string
  scenePlan: string[]
}

function fallback(prompt: string): AnalyzePayload {
  const trimmed = prompt.trim().slice(0, 80)
  return {
    title: trimmed || 'Your AI Short',
    summary: 'A fast-paced vertical Short built from your idea.',
    niche: 'General',
    scenePlan: [
      'Opening hook — bold visual that stops the scroll.',
      'Setup — establish the core idea in one striking shot.',
      'Payoff — the reveal or twist that pays off the hook.',
      'Closer — final beat that drives a like or share.',
    ],
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[analyze-idea] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { prompt?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt is too long.' }, { status: 400 })
    }

    const systemMsg =
      'You analyze raw short-video ideas and return a tight JSON plan. Always reply with valid JSON only — no markdown, no commentary.'

    const userMsg = `Analyze this idea for a vertical AI Short and return a JSON object with this exact shape:
{
  "title": string (max 70 chars, scroll-stopping),
  "summary": string (2-3 sentences describing the Short in plain English),
  "niche": string (a short topic label, 1-3 words, e.g. "Money Facts", "Mystery", "AI Tools"),
  "scenePlan": string[] (exactly 4 brief shot descriptions, each ~12-18 words, visual and concrete)
}

Idea: """${prompt}"""

Return JSON only.`

    let parsed: AnalyzePayload
    try {
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        },
        { timeout: 25000 }
      )
      const raw = completion.choices[0]?.message?.content?.trim() ?? ''
      if (!raw) throw new Error('Empty response from OpenAI')
      const data = JSON.parse(raw) as Partial<AnalyzePayload>
      const scenePlan = Array.isArray(data.scenePlan)
        ? data.scenePlan.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
        : []
      while (scenePlan.length < 4) {
        scenePlan.push(`Cinematic vertical 9:16 beat inspired by: ${prompt.slice(0, 60)}`)
      }
      parsed = {
        title: typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 120) : fallback(prompt).title,
        summary: typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : fallback(prompt).summary,
        niche: typeof data.niche === 'string' && data.niche.trim() ? data.niche.trim().slice(0, 40) : 'General',
        scenePlan,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[analyze-idea] OpenAI failed:', msg)
      parsed = fallback(prompt)
    }

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[analyze-idea] unexpected error:', msg)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
