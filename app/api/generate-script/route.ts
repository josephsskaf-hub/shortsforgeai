import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

// generate-script — Push #310
//
// Takes any free-form topic/idea and returns a fully structured viral script
// with HOOK / MICRO REWARD / ESCALATION / PAYOFF markers that
// parseViralScriptSections() in analyze-idea will detect, activating the
// fast-path so voiceovers are NEVER rewritten by GPT.
//
// The caller (GenerateClient) checks whether the user's raw prompt already
// contains markers before calling this route; if it does, this route is
// skipped and the original prompt is used as-is.

const SYSTEM_PROMPT = `You are a viral YouTube Shorts scriptwriter. Your job is to take any topic and write a tight, punchy script in the exact structure below. The script will be fed into an AI video generator — so every line you write becomes the voiceover, word for word. Write for a US audience aged 18–34. US English only.

OUTPUT FORMAT — use EXACTLY these headers, in this exact order:

HOOK (0-2s): [One sentence, ≤12 words. Pattern interrupt, number, or mystery question. No "Hey guys".]

MICRO REWARD 1: [First concrete fact. Specific name, number, date, or place. One thing they learn.]

MICRO REWARD 2: [Second concrete fact. More specific and surprising than #1.]

MICRO REWARD 3: [Third concrete fact. The most surprising or counterintuitive one yet.]

ESCALATION: [One sentence that raises the stakes or connects all the facts above. More intense than anything before.]

PAYOFF: [The "save this" moment. One line that reframes everything. End with: "Follow for more."]

RULES:
- Total script: 130–170 words (narrated at 1.05x speed = ~45–55 seconds)
- Every fact must be specific: names, numbers, dates, places — never vague
- ESCALATION must feel more intense than MICRO REWARD 3
- PAYOFF must feel like a revelation, not a summary
- Do NOT invent quotes from real people
- Do NOT use the word "millionaire" — use "billionaire" or a different word
- Respond with ONLY the script. No intro, no explanation, no markdown, no code blocks.`

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

    // If the topic already has viral markers, return it as-is — no GPT call needed
    if (hasViralMarkers(topic)) {
      return NextResponse.json({ script: topic, alreadyStructured: true })
    }

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
