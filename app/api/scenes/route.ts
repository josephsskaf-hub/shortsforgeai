import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 60

interface Scene {
  sceneNumber: number
  duration: number
  narration: string
  visualDescription: string
  // Single best keyword phrase (kept for backwards compatibility with older
  // callers that read scene.searchQuery directly).
  searchQuery: string
  // Ordered list of 2-3 specific, visual stock-footage search phrases. The
  // /api/stock endpoint tries them in order until one returns a Pexels match,
  // so the highest-fidelity keyword should be first and broader fallbacks
  // last. Populated for every scene; if the model omits it we synthesize one
  // from searchQuery below so the client never sees an empty array.
  searchKeywords: string[]
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

    // searchKeywords fixes a long-standing bug where generic 2-3-word queries
    // ("ranking", "list", "facts") matched random Pexels footage that had
    // nothing to do with the narration. The model emits a priority list of
    // CONCRETE, VISUAL noun phrases per scene, and /api/stock tries each one
    // in order before falling back to broadening + the curated library.
    //
    // STEP 1 (theme anchoring) is a second-layer fix for ABSTRACT narration
    // lines ("to recover", "the lesson", "imagine this"). The model first
    // identifies the SCRIPT-WIDE theme, then every per-scene keyword carries
    // a concrete noun from that theme — so a Mansa Musa script's "to recover"
    // line gets "ancient african empire" instead of generic wellness clips.
    const prompt = `You are planning the visuals for a 35-second YouTube Short in the "${niche}" niche.

SCRIPT:
"""
${script}
"""

STEP 1 — Identify the SCRIPT-WIDE THEME in 2-4 concrete nouns BEFORE writing any scene. Examples:
  - A script about Mansa Musa → theme: "ancient mali kingdom gold"
  - A script about Wall Street crash → theme: "wall street stock market crash"
  - A script about overcoming addiction → theme: "addiction recovery brain"
  - A script about Mount Everest → theme: "mount everest snow mountain"
Every scene's keywords MUST stay anchored to this theme, even when the narration is abstract.

STEP 2 — You are now a STOCK FOOTAGE DIRECTOR. Split the script into 4-6 cinematic scenes (durations sum to ~35s). For EACH scene output 3 concrete visual search phrases (\`searchKeywords\`) that a stock-video site like Pexels would actually return matching footage for. Each phrase MUST describe what the viewer should literally see while that narration plays — never the abstract idea behind it.

Rules for searchKeywords (CRITICAL — this is the most important field):
  1. EXACTLY 3 phrases per scene, lowercase, 2-4 words each, no punctuation, no hashtags.
  2. Order: most specific FIRST, broader LAST.
  3. Every phrase MUST contain at least one CONCRETE VISUAL NOUN (a place, object, person, landscape). Without a concrete noun, Pexels returns generic wellness/lifestyle clips and ruins the video.
  4. For ABSTRACT narration ("to recover", "the lesson", "imagine this", "the truth", "what happened next", "the secret"), DO NOT search the abstract phrase alone — anchor every phrase to the STEP 1 theme. Examples:
       narration "to recover"     + theme "wall street crash"        → ["stock market recovery", "trader celebrating", "wall street bull"]
       narration "the lesson"     + theme "ancient mali kingdom"     → ["ancient african empire", "gold coins pile", "desert caravan"]
       narration "imagine this"   + theme "mount everest"            → ["mount everest summit", "snow mountain peak", "alpine landscape"]
  5. NEVER emit these as standalone phrases: "recover", "lesson", "imagine", "truth", "secret", "story", "people", "thing", "happen", "moment", "feeling", "ranking", "list", "top 5", "facts", "amazing", "remarkable", "shocking".
  6. Good concrete examples for narration "The highest mountain in the world stands 8,849 meters tall":
       ["mount everest summit", "snow mountain peak", "alpine landscape"]
  7. Good concrete examples for narration "Jeff Bezos earned 75 billion dollars in one year":
       ["jeff bezos portrait", "amazon headquarters building", "stacks of cash money"]

Return ONLY a JSON array. Each object MUST contain:
- sceneNumber (int, starting at 1)
- duration (int seconds, total across all scenes ~= 35)
- narration (the exact words spoken in this scene, drawn from the script)
- visualDescription (cinematic, dark, fast-paced — what should be on screen)
- searchKeywords (array of EXACTLY 3 lowercase visual phrases per the rules above, most specific first)
- searchQuery (same as searchKeywords[0] — kept for backwards compatibility)
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

    // Normalize searchKeywords so /api/stock can always rely on a non-empty
    // ordered keyword list per scene, even when the model forgets the field
    // or returns it in a different shape. This is the contract the client
    // depends on for the priority-fallback Pexels lookup.
    scenes = scenes.map((s) => {
      const rawKeywords = Array.isArray((s as { searchKeywords?: unknown }).searchKeywords)
        ? ((s as { searchKeywords: unknown[] }).searchKeywords)
        : []
      const cleaned = rawKeywords
        .map((k) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
        .filter((k) => k.length > 0)
      // Bring searchQuery into the keyword list as a fallback so the client
      // never queries an empty list.
      const baseQuery = (s.searchQuery ?? '').toString().trim().toLowerCase()
      if (baseQuery && !cleaned.includes(baseQuery)) cleaned.push(baseQuery)
      // Last resort: derive a query from visualDescription so we have something.
      if (cleaned.length === 0) {
        const vd = (s.visualDescription ?? '').toString().trim().toLowerCase()
        if (vd) cleaned.push(vd.split(/\s+/).slice(0, 3).join(' '))
      }
      const searchKeywords = cleaned.slice(0, 3)
      return {
        ...s,
        searchKeywords,
        // Mirror the top keyword into searchQuery for legacy callers.
        searchQuery: searchKeywords[0] || (s.searchQuery ?? ''),
      }
    })

    return NextResponse.json({ scenes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scenes] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
