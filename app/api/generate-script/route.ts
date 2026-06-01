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
//
// Narration Engine (Phase 1) — system prompt now includes CINEMATIC NARRATION
// RULES that instruct GPT to write scripts with natural dramatic punctuation
// ("...", em-dashes, sentence rhythm variation) so the AI voice sounds cinematic.

type Language = 'en' | 'pt' | 'es'

function buildSystemPrompt(language: Language): string {
  const langInstruction =
    language === 'pt'
      ? `LANGUAGE: Write all voiceover sentences in Brazilian Portuguese (pt-BR). Keep [Pexels: ...] cues and section headers (HOOK, MICRO REWARD 1, MICRO REWARD 2, MICRO REWARD 3, ESCALATION, RHYTHM, PAYOFF) in English — the video engine requires them in English. Only the spoken narration text changes language.`
      : language === 'es'
      ? `LANGUAGE: Write all voiceover sentences in Spanish (es-419 Latin American). Keep [Pexels: ...] cues and section headers (HOOK, MICRO REWARD 1, MICRO REWARD 2, MICRO REWARD 3, ESCALATION, RHYTHM, PAYOFF) in English — the video engine requires them in English. Only the spoken narration text changes language.`
      : `LANGUAGE: Write everything in US English.`

  return `You are a world-class viral YouTube Shorts scriptwriter AND voice director. Your job is to take any topic and write a tight, punchy, CINEMATIC script in the exact structure below. The script will be fed word-for-word into a premium AI text-to-speech voice — so how you write determines how it SOUNDS. Write for a US audience aged 18-34.

${langInstruction}

OUTPUT FORMAT — use EXACTLY these headers, in this exact order. Each section MUST start with a [Pexels: search term] footage cue, immediately followed by the voiceover text.

HOOK (0-2s): [Pexels: FOOTAGE_CUE] Voiceover sentence here (12 words max, pattern interrupt or number).

MICRO REWARD 1: [Pexels: FOOTAGE_CUE] First concrete fact — specific name, number, date, or place.

MICRO REWARD 2: [Pexels: FOOTAGE_CUE] Second concrete fact. More specific and surprising than #1.

MICRO REWARD 3: [Pexels: FOOTAGE_CUE] Third concrete fact. The most surprising or counterintuitive one yet.

ESCALATION: [Pexels: FOOTAGE_CUE] One sentence raising the stakes. More intense than anything before.

RHYTHM: [Pexels: FOOTAGE_CUE] A rapid-fire accelerator right before the payoff — 2 or 3 ultra-short punches (1-3 words each), each its own beat. Example: "Faster. Bigger. Unstoppable." This SPEEDS the listener up so the payoff can slam the brakes.

PAYOFF: [Pexels: FOOTAGE_CUE] The MANDATORY reward. DELIVER the concrete answer/discovery the HOOK promised — a specific fact, number, name, mechanism, or (for unsolved topics) the single most-accepted theory. Slow, deliberate, weighty, with a "..." pause before the reveal and a callback to the HOOK. This is what the viewer stayed for — it MUST deliver, never tease. Then, on its OWN line, a short follow CTA in the chosen language.

FOOTAGE CUE RULES (critical — this directly controls what video clip plays):
- 2-5 lowercase words describing what should be ON SCREEN during this beat
- Must be a VISUAL you can film: objects, places, actions, settings — never abstract concepts
- Must match what the voiceover is SAYING at that exact moment, not just the topic
- Avoid person names (Pexels has no paparazzi footage of Warren Buffett)
- Good: "forensic dna lab test tubes", "old archive crime documents", "stock market trading monitors", "ancient stone pyramid aerial"
- Bad: "success", "billionaire", "mystery", "the answer", "time"

VOICEOVER RULES:
- Total script: 130-170 words (narrated at 1.05x speed = ~45-55 seconds)
- Every fact must be specific: names, numbers, dates, places — never vague
- ESCALATION must feel more intense than MICRO REWARD 3
- RHYTHM is the fastest beat after the HOOK: stacked 1-3 word punches, no filler. It exists to accelerate before the payoff.
- PAYOFF must feel like a revelation, not a summary — and must CALL BACK to the HOOK (close the loop). Keep the revelation and the CTA as two separate sentences so the revelation lands first.
- Do NOT invent quotes from real people
- Do NOT use the word "millionaire" — use "billionaire" or a different word

PAYOFF RULES (NON-NEGOTIABLE — a Short without a real payoff feels like clickbait and gets the channel cancelled):
- The PAYOFF MUST deliver the concrete answer/discovery the HOOK promised. The viewer has to LEARN the actual thing — a fact, number, name, mechanism, or outcome.
- NEVER end on a question, a tease, or a promise. These endings are BANNED — do NOT write them: "what if I told you...", "no one knows / no one knew", "the truth remains a mystery", "we may never know", "stay to find out", "you won't believe what happened" (without then telling it), "or something worse?", "the answer will shock you" (without giving the answer).
- UNSOLVED mysteries are NOT an excuse to skip the payoff: deliver the single most-accepted theory or the most concrete known fact as the reward (e.g. Mary Celeste -> "The leading theory: alcohol fumes from the cargo sparked a panicked evacuation."). The viewer must always leave with something concrete.
- The follow/save CTA is SEPARATE and comes AFTER the payoff reveal — it never replaces it.

CINEMATIC NARRATION RULES (this is what separates premium from generic AI videos):
- HOOK must be the most energetic, fastest-paced line in the entire script. Short sentences. Punchy.
- Use "..." for dramatic pauses before shocking reveals. The AI voice reads "..." as a real pause.
- Use em-dashes to create a beat before a key word: "No one knew — until now."
- Short sentences hit harder than long ones. Mix 3-word punches with 12-word reveals.
- ESCALATION leans in with weight; RHYTHM then SPEEDS UP with rapid 1-3 word punches; PAYOFF SLAMS THE BRAKES and goes slow. This fast→slow contrast is what makes the payoff hit.
- Vary sentence length deliberately: short. short. LONGER sentence that builds tension. Short punch.
- RHYTHM: write the punches as separate ultra-short sentences ("Faster. Louder. Gone.") so the AI voice machine-guns them.
- PAYOFF is the slowest, most deliberate moment — write it that way with careful punctuation, a "..." pause before the reveal, and a callback to the HOOK.

Respond with ONLY the script. No intro, no explanation, no markdown, no code blocks.`
}

function hasViralMarkers(text: string): boolean {
  const hasHook = /\bHOOK\b/i.test(text)
  const hasMR = /\bMICRO REWARD\b/i.test(text)
  const hasPayoff = /\bPAYOFF\b/i.test(text)
  return hasHook && (hasMR || hasPayoff)
}

// #373 — detect a PAYOFF that TEASES instead of delivering. Looks at the PAYOFF
// section (or the script tail) and flags banned "empty hook" endings so the
// caller can regenerate. Conservative: only matches clear teasing patterns.
function payoffIsEmpty(script: string): boolean {
  const parts = script.split(/\n(?=\s*(?:PAYOFF|PAGAMENTO|RECOMPENSA FINAL))/i)
  const tailRaw = parts.length > 1 ? parts[parts.length - 1] : script.slice(-240)
  const tail = tailRaw.replace(/\[[^\]]*\]/g, ' ').trim()
  const BANNED: RegExp[] = [
    /what if i told you/i,
    /no one (?:knows|knew)\b/i,
    /(?:remains?|still)\s+(?:a |an )?mystery/i,
    /we may never know/i,
    /stay (?:here )?to (?:find|learn|discover)/i,
    /find out (?:why|how|what|more)\b/i,
    /you won'?t believe/i,
    /or something (?:worse|else)\s*\?/i,
    /(?:answer|truth|secret) (?:will|may|might|could) (?:shock|amaze|surprise|stun)/i,
    /\?\s*$/,
  ]
  return BANNED.some((re) => re.test(tail))
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
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: 'Write a viral YouTube Short script about this topic:\n\n' + topic,
        },
      ],
    })

    let script = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!script) {
      return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })
    }

    // Validate the output has the expected markers before returning
    if (!hasViralMarkers(script)) {
      console.error('[generate-script] GPT output missing viral markers:', script.slice(0, 200))
      // Return the raw script anyway — analyze-idea will handle it via normal path
      return NextResponse.json({ script, alreadyStructured: false })
    }

    // #373 — PAYOFF guardrail. If the PAYOFF teases instead of delivering, regenerate
    // ONCE with a reinforced instruction so the last beat is always a concrete reward.
    if (payoffIsEmpty(script)) {
      console.warn('[generate-script] payoff looks empty/teasing — regenerating once')
      try {
        const retry = await openai.chat.completions.create({
          model: 'gpt-4o',
          temperature: 0.6,
          max_tokens: 700,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: 'Write a viral YouTube Short script about this topic:\n\n' + topic },
            { role: 'assistant', content: script },
            { role: 'user', content: 'Your PAYOFF teased instead of delivering — it ended on a question, a promise, or a "no one knows / remains a mystery" line. Rewrite the FULL script, same structure and headers, but the PAYOFF MUST deliver the concrete answer/discovery the hook promised: a specific fact, number, name, mechanism, or the single most-accepted theory. NO questions, NO "no one knows", NO "remains a mystery", NO "what if I told you", NO "find out" teasing. The CTA stays separate, after the reveal. Respond with ONLY the script.' },
          ],
        })
        const retryScript = retry.choices[0]?.message?.content?.trim() ?? ''
        if (retryScript && hasViralMarkers(retryScript)) {
          script = retryScript
          if (payoffIsEmpty(retryScript)) {
            console.warn('[generate-script] payoff still weak after retry — using retry anyway')
          }
        }
      } catch (retryErr) {
        console.warn('[generate-script] payoff retry failed:', retryErr instanceof Error ? retryErr.message : String(retryErr))
      }
    }

    return NextResponse.json({ script, alreadyStructured: false })
  } catch (err) {
    console.error('[generate-script] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
