import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 30

const NICHE_LABEL: Record<string, string> = {
  general: 'general viral curiosity',
  history: 'History',
  mystery: 'Mystery',
  finance: 'Finance / Money Facts',
  science: 'Science',
  technology: 'Technology',
  // Legacy aliases — accepted for safety
  mideast: 'Middle East Secrets',
  money: 'Money Facts',
  mind: 'Mind-Blowing Facts',
  dark: 'Dark Mysteries',
  motivation: 'Motivation',
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { niche?: string } = {}
    try {
      body = await req.json()
    } catch {
      // empty body OK
    }

    const nicheKey = (body.niche || 'general').toLowerCase()
    const niche = NICHE_LABEL[nicheKey] || NICHE_LABEL.general

    const prompt = `Give me ONE highly viral YouTube Shorts topic for the ${niche} niche. Money Facts channel. Dark, cinematic style. The topic should make a viewer physically unable to scroll past — shocking, curiosity-driven, specific. Return ONLY the topic sentence, no quotes, no preface, no explanation, no emoji. Under 90 characters.`

    let completion
    try {
      completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You return ONLY the requested topic sentence. No prefaces, no quotes, no formatting, no extra text.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 1,
          max_tokens: 80,
        },
        { timeout: 15000 }
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[topic-suggest] OpenAI error:', msg)
      return NextResponse.json({ error: 'Could not pick a topic. Try again.' }, { status: 500 })
    }

    let topic = completion.choices[0]?.message?.content?.trim() ?? ''
    // Strip surrounding quotes if any
    topic = topic.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim()
    // Drop trailing period if too long
    if (topic.length > 140) topic = topic.slice(0, 140).trim()

    if (!topic) {
      return NextResponse.json({ error: 'Empty topic from AI.' }, { status: 500 })
    }

    return NextResponse.json({ topic })
  } catch (err) {
    console.error('[topic-suggest] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
