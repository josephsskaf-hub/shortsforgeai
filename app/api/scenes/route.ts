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

    // Push #305 — detect pre-written viral scripts so GPT splits scenes at the
    // correct structural boundaries (HOOK / MICRO REWARD / ESCALATION / PAYOFF)
    // rather than guessing from narration length alone.
    const isViralScript =
      /\bHOOK\b/i.test(script) && /MICRO REWARD|PAYOFF/i.test(script)

    const viralSplitNote = isViralScript
      ? `\n\nSCRIPT STRUCTURE NOTE: This script uses the 5-element viral formula. Split scenes at the structural markers:
- HOOK section → Scene 1
- Each MICRO REWARD → its own scene
- ESCALATION → second-to-last scene
- PAYOFF → final scene
Never merge two MICRO REWARD sections into one scene. Use the exact narration text from each section.`
      : ''

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
    const prompt = `You are a STOCK FOOTAGE DIRECTOR planning visuals for a YouTube Short in the "${niche}" niche.
${viralSplitNote}
SCRIPT:
"""
${script}
"""

STEP 1 — Identify the TOPIC ANCHOR: the 1-2 main proper nouns or concrete subjects the script is about (e.g. "mansa musa", "mount everest", "wall street crash", "jeff bezos"). Write it down.

STEP 2 — Extract the SCRIPT-WIDE THEME in 2-4 concrete visual nouns (e.g. "ancient mali kingdom gold trade", "himalayan snow summit climb", "nasdaq trading floor crash").

STEP 3 — For EACH scene, read the exact narration text and extract the NARRATION VISUAL ANCHOR: the most specific visual element literally mentioned or implied IN THAT SENTENCE. This is a named person, specific place, object, action, or event described by those exact words.
  - Narration "He crossed the Sahara with 60,000 soldiers" → Narration Visual Anchor = "sahara desert crossing army caravan"
  - Narration "He gave away so much gold it crashed the Egyptian economy" → Narration Visual Anchor = "gold coins pile medieval africa"
  - Narration "Earned $75 billion in a single year" → Narration Visual Anchor = "dollar bills cash stacks wealth"
  - Narration "K2 has killed 1 in every 4 climbers who summit it" → Narration Visual Anchor = "k2 mountain summit snow steep"
  - Narration "The stock market lost 89% of its value in 3 years" → Narration Visual Anchor = "stock market crash graph falling"
  Write down the Narration Visual Anchor for each scene before proceeding.

STEP 4 — Split the script into 4-6 cinematic scenes (durations sum to the script's natural length). For EACH scene output 3 searchKeywords using the Narration Visual Anchors from Step 3.

Rules for searchKeywords (CRITICAL — read every rule):
  1. EXACTLY 3 phrases per scene, lowercase, 2-4 words each, no punctuation, no hashtags.
  2. Order: most specific FIRST (tied to the exact narration sentence), broader LAST.
  3. searchKeywords[0] MUST come directly from the STEP 3 NARRATION VISUAL ANCHOR for that scene — it must describe the specific visual that matches WHAT IS BEING SAID IN THAT EXACT NARRATION LINE, not just the general topic.
       - Narration "crossed the sahara" → searchKeywords[0] = "sahara desert caravan" ✓ (NOT just "mansa musa")
       - Narration "gave away gold in cairo" → searchKeywords[0] = "gold coins pile cairo" ✓ (NOT just "mali empire")
       - Narration "K2 summit death zone" → searchKeywords[0] = "k2 mountain summit" ✓ (NOT just "mountain climbing")
  4. searchKeywords[1] = broader setting or context of THIS scene's narration (era, location, mood — 2-4 words).
  5. searchKeywords[2] = topic anchor fallback — includes the STEP 1 TOPIC ANCHOR or a direct visual synonym of it as a safety net.
  6. Every phrase MUST contain at least one CONCRETE VISUAL NOUN (place, object, person, landscape). No abstract words.
  7. For ABSTRACT narration lines ("the secret", "the lesson", "imagine this"), anchor searchKeywords[0] to the most visual element of the STEP 3 Narration Visual Anchor, not the abstract word itself:
       Narration "the lesson every trader ignores" + theme "wall street crash" → searchKeywords[0] = "wall street trading floor monitors"
       Narration "the truth about wealth" + theme "billionaire habits" → searchKeywords[0] = "gold bars vault luxury interior"
  8. NEVER use these standalone: "recover", "lesson", "imagine", "truth", "secret", "story", "people", "thing", "moment", "feeling", "ranking", "list", "facts", "amazing", "shocking".
  9. Perfect examples:
       Narration "He crossed the Sahara with 60,000 soldiers and 12,000 slaves carrying gold" (topic: mansa musa):
         ["sahara desert caravan gold", "ancient mali empire trade", "mansa musa african king"]
       Narration "K2 has a 29% fatality rate — deadlier than Everest" (topic: k2 mountain):
         ["k2 mountain summit snow", "himalaya steep cliff ice", "mountain climber death zone"]
       Narration "The stock market dropped 89% between 1929 and 1932" (topic: wall street crash):
         ["stock market crash graph", "wall street trading floor", "new york stock exchange 1929"]
       Narration "Bezos earns $4,000 every second — more than most Americans make in a year" (topic: jeff bezos):
         ["dollar bills cash stacks", "amazon warehouse interior", "jeff bezos wealth luxury"]

Return ONLY a JSON array. Each object MUST contain:
- sceneNumber (int, starting at 1)
- duration (int seconds)
- narration (the exact words spoken in this scene)
- visualDescription (cinematic, dark, fast-paced — what should literally be on screen, tied to the narration)
- shotType (exactly one of: "aerial drone" | "close-up macro" | "wide establishing" | "medium shot" | "low angle" | "POV" — vary across scenes, never the same 3 in a row)
- searchKeywords (array of EXACTLY 3 lowercase visual phrases per the rules above. PREPEND the shotType to searchKeywords[0], e.g. "aerial drone sahara desert caravan" or "close-up macro gold coins pile")
- searchQuery (same as searchKeywords[0])
- emotionalTone (one short phrase, e.g. "tense", "uplifting", "shocking")

No markdown, no code fences. Raw JSON array only.`

    let completion
    try {
      completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'You are a cinematic video director and stock footage expert. Always respond with valid JSON only — no markdown, no code blocks, no extra text. Your searchKeywords must be derived from the literal content of each narration sentence, not just the general topic.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          // Push #208 — raised to 2000 to support 90s / 9-scene scripts.
          max_tokens: 2000,
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
