import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

// generate-script — Push #316 (updated from #311/#310)
//
// Takes any free-form topic/idea and returns a fully structured viral script
// with HOOK / MICRO REWARD / ESCALATION / PAYOFF markers that
// parseViralScriptSections() in analyze-idea will detect, activating the
// fast-path so voiceovers are NEVER rewritten by GPT.
//
// Each section includes a [Pexels: search term] marker so generate-video-fast
// enters verbatim mode and fetches the exact footage for each beat.
// parseViralScriptSections() strips these markers from voiceovers so TTS
// never reads them aloud.
//
// The caller (GenerateClient) checks whether the user's raw prompt already
// contains markers before calling this route; if it does, this route is
// skipped and the original prompt is used as-is.
//
// Push #316 — added `language` param (en | pt | es). Voiceover sentences are
// generated in the chosen language; [Pexels: ...] cues and section headers
// stay in English so Pexels search and parseViralScriptSections() keep working.

type Language = 'en' | 'pt' | 'es'

function buildSystemPrompt(language: Language): string {
  const langInstruction =
    language === 'pt'
      ? `LANGUAGE: Write all voiceover sentences in Brazilian Portuguese (pt-BR). Keep [Pexels: ...] cues and section headers (HOOK, MICRO REWARD 1, MICRO REWARD 2, MICRO REWARD 3, ESCALATION, PAYOFF) in English — the video engine requires them in English. Only the spoken narration text changes language.`
      : language === 'es'
      ? `LANGUAGE: Write all voiceover sentences in Spanish (es-419 Latin American). Keep [Pexels: ...] cues and section headers (HOOK, MICRO REWARD 1, MICRO REWARD 2, MICRO REWARD 3, ESCALATION, PAYOFF) in English — the video engine requires them in English. Only the spoken narration text changes language.`
      : `LANGUAGE: Write everything in US English.`

  return `You are a viral YouTube Shorts scriptwriter. Your job is to take any topic and write a tight, punchy script in the exact structure below. The script will be fed into an AI video generator — so every line you write becomes the voiceover, word for word. Write for a US audience aged 18–34.

${langInstruction}

OUTPUT FORMAT — use EXACTLY these headers, in this exact order. Each section MUST start with a [Pexels: search term] footage cue, immediately followed by the voiceover text.

HOOK (0-2s): [Pexels: FOOTAGE_CUE] Voiceover sentence here (≤12 words, pattern interrupt or number).

MICRO REWARD 1: [Pexels: FOOTAGE_CUE] First concrete fact — specific name, number, date, or place.

MICRO REWARD 2: [Pexels: FOOTAGE_CUE] Second concrete fact. More specific and surprising than #1.

MICRO REWARD 3: [Pexels: FOOTAGE_CUE] Third concrete fact. The most surprising or counterintuitive one yet.

ESCALATION: [Pexels: FOOTAGE_CUE] One sentence raising the stakes. More intense than anything before.

PAYOFF: [Pexels: FOOTAGE_CUE] The "save this" moment. One line that reframes everything. End with a follow CTA in the chosen language.

FOOTAGE CUE RULES (critical — this directly controls what video clip plays):
- 2–5 lowercase words describing what should be ON SCREEN during this beat
- Must be a VISUAL you can film: objects, places, actions, settings — never abstract concepts
- Must match what the voiceover is SAYING at that exact moment, not just the topic
- Avoid person names (Pexels has no paparazzi footage of Warren Buffett)
- Good: "forensic dna lab test tubes", "old archive crime documents", "stock market trading monitors", "ancient stone pyramid aerial"
- Bad: "success", "billionaire", "mystery", "the answer", "time"

VOICEOVER RULES:
- Total script: 130–170 words (narrated at 1.05x speed = ~45–55 seconds)
- Every fact must be specific: names, numbers, dates, places — never vague
- ESCALATION must feel more intense than MICRO REWARD 3
- PAYOFF must feel like a revelation, not a summary
- Do NOT invent quotes from real people
- Do NOT use the word "millionaire" — use "billionaire" or a different word

Respond with ONLY the script. No intro, no explanation, no markdown, no code blocks.`
}

function hasViralMarkers(text: string): boolean {
  const hasHook = /\bHOOK\b/i.test(text)
  const hasMR = /\bMICRO REWARD\b/i.test(text)
  const hasPayoff = /\bPAYOFF\b/i.test(text)
  return hasHook && (hasMR || hasPayoff)
}

export async function POST(req: NextRequest) {
  try {
    // Auth check — same pattern as other routes
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }

    // Push #316 — language selection (en | pt | es), defaults to English.
    const language: Language =
      body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'

    // If the topic already has viral markers, return it as-is — no GPT call needed
    if (hasViralMarkers(topic)) {
      return NextResponse.json({ script: topic, alreadyStructured: true })
    }

    const SYSTEM_PROMPT = buildSystemPrompt(language)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Write a viral YouTube Short script about this topic:\n\n${topic}`,
        },
      ],
    })

    const script = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!script) {
      return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
    }

    // Validate the output has the expected markers before returning
    if (!hasViralMarkers(script)) {
      console.error('[generate-script] GPT output missing viral markers:', script.slice(0, 200))
      // Return the raw script anyway — analyze-idea will handle it via normal path
      return NextResponse.json({ script, alreadyStructured: false })
    }

    return NextResponse.json({ script, alreadyStructured: false })
  } catch (err) {
    console.error('[generate-script] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
