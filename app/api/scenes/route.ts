import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 60

interface Scene {
  sceneNumber: number
  duration: number
  narration: string
  visualDescription: string
  searchQuery: string
  emotionalTone: string
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { script?: string; niche?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    const niche = (body.niche ?? '').trim() || 'general'
    if (!script) {
      return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    }

    const prompt = `Parse this short-form video script into 4-6 cinematic scenes for a 35-second YouTube Short in the "${niche}" niche.

Script:
"""
${script}
"""

Return ONLY a JSON array. Each object MUST contain:
- sceneNumber (int, starting at 1)
- duration (int seconds, total across all scenes ~= 35)
- narration (the exact words spoken in this scene, drawn from the script)
- visualDescription (cinematic, dark, fast-paced — what should be on screen)
- searchQuery (2-3 words for stock footage search, lowercase)
- emotionalTone (one short phrase, e.g. "tense", "uplifting", "shocking")

No markdown, no code fences. Raw JSON array only.`

    let completion
    try {
      completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a cinematic video director. Always respond with valid JSON only — no markdown, no code blocks, no extra text.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        },
        { timeout: 30000 }
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[scenes] OpenAI error:', msg)
      return NextResponse.json(
        { error: 'AI scene generation failed. Please try again.' },
        { status: 500 }
      )
    }

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!raw) {
      return NextResponse.json({ error: 'AI returned empty response.' }, { status: 500 })
    }

    let scenes: Scene[]
    try {
      let cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) cleaned = arrayMatch[0]
      try {
        scenes = JSON.parse(cleaned) as Scene[]
      } catch {
        const sanitized = cleaned.replace(
          /"(?:[^"\\]|\\.)*"/g,
          (s) => s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        )
        scenes = JSON.parse(sanitized) as Scene[]
      }
    } catch (err) {
      console.error('[scenes] parse error:', err, 'raw:', raw)
      return NextResponse.json(
        { error: 'Failed to parse AI response.' },
        { status: 500 }
      )
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'AI returned no scenes.' }, { status: 500 })
    }

    return NextResponse.json({ scenes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scenes] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
