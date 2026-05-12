import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, buildGenerationPrompt, buildSingleVideoPrompt, ShortVideo } from '@/lib/openai'

// Increase Vercel function timeout to 60s (hobby plan max)
export const maxDuration = 60

const FREE_LIMIT = 2

export async function POST(req: NextRequest) {
  try {
    // ── 1. Verify OpenAI key is configured ──────────────────────────────────
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate] OPENAI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // ── 2. Auth check ────────────────────────────────────────────────────────
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[generate] Auth error:', authError.message)
    }

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate videos.' },
        { status: 401 }
      )
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: { niche?: string; topic?: string; tone?: string; duration?: number; mode?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { niche, topic } = body
    const tone = (body.tone || 'cinematic').toString().toLowerCase()
    const duration = Math.max(15, Math.min(90, Number(body.duration) || 35))
    const isTopicMode = typeof topic === 'string' && topic.trim().length > 0

    // All valid niches — legacy + core + new viral niches
    const validNiches = [
      // Legacy
      'mideast', 'money', 'mind', 'dark', 'motivation',
      // Core
      'history', 'mystery', 'finance', 'science', 'technology', 'general',
      // New viral niches
      'strange-facts', 'hidden-places', 'ancient-mysteries', 'billionaire-secrets',
      'ai-tools', 'money-hacks', 'psychology-facts', 'space-mysteries',
      'crime-stories', 'war-secrets', 'survival-tips', 'conspiracy-files',
      'tech-breakthroughs', 'lost-civilizations', 'animal-facts', 'health-facts',
      'celebrity-secrets', 'luxury-lifestyle', 'future-predictions', 'dark-history',
    ]

    if (!niche || !validNiches.includes(niche)) {
      return NextResponse.json({ error: 'Invalid niche selected.' }, { status: 400 })
    }

    // ── 4. Get or create profile ─────────────────────────────────────────────
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_pro, generations_used')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[generate] Profile fetch error:', profileError.message, profileError.code)

      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            is_pro: false,
            generations_used: 0,
          })
          .select('is_pro, generations_used')
          .single()

        if (createError) {
          console.error('[generate] Profile creation error:', createError.message)
          profile = { is_pro: false, generations_used: 0 }
        } else {
          profile = newProfile
        }
      } else {
        console.error('[generate] Unexpected profile error, using defaults')
        profile = { is_pro: false, generations_used: 0 }
      }
    }

    const isPro = profile?.is_pro ?? false
    const generationsUsed = profile?.generations_used ?? 0

    // ── 5. Check free tier limit ─────────────────────────────────────────────
    if (!isTopicMode && !isPro && generationsUsed >= FREE_LIMIT) {
      return NextResponse.json(
        {
          error: `You've used all ${FREE_LIMIT} free generations. Upgrade to Basic ($9/mo, 140 credits) or Pro ($19/mo, 350 credits).`,
        },
        { status: 402 }
      )
    }

    // ── 6. Call OpenAI ───────────────────────────────────────────────────────
    const prompt = isTopicMode
      ? buildSingleVideoPrompt(niche, topic!, tone, duration)
      : buildGenerationPrompt(niche)

    let completion
    try {
      completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert viral content creator. You always respond with valid JSON only — no markdown, no code blocks, no extra text. Just the raw JSON array.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.9,
          max_tokens: 4000,
        },
        { timeout: 25000 }
      )
    } catch (openaiError: unknown) {
      const msg = openaiError instanceof Error ? openaiError.message : String(openaiError)
      console.error('[generate] OpenAI API error:', msg)

      if (msg.includes('API key') || msg.includes('Incorrect API key') || msg.includes('invalid_api_key')) {
        return NextResponse.json(
          { error: 'AI service key is invalid. Please contact support.' },
          { status: 500 }
        )
      }
      if (msg.includes('quota') || msg.includes('insufficient_quota')) {
        return NextResponse.json(
          { error: 'AI service quota exceeded. Please try again later.' },
          { status: 503 }
        )
      }
      if (msg.includes('rate limit') || msg.includes('rate_limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: 'AI generation failed. Please try again in a moment.' },
        { status: 500 }
      )
    }

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? ''

    if (!rawContent) {
      console.error('[generate] OpenAI returned empty content')
      return NextResponse.json(
        { error: 'AI returned an empty response. Please try again.' },
        { status: 500 }
      )
    }

    // ── 7. Parse JSON response ───────────────────────────────────────────────
    let videos: ShortVideo[]

    const sanitizeAndParse = (raw: string): ShortVideo[] => {
      let cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) cleaned = arrayMatch[0]

      try {
        return JSON.parse(cleaned) as ShortVideo[]
      } catch {
        const sanitized = cleaned.replace(
          /"(?:[^"\\]|\\.)*"/g,
          (str) =>
            str
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
        )
        return JSON.parse(sanitized) as ShortVideo[]
      }
    }

    try {
      videos = sanitizeAndParse(rawContent)
    } catch (parseError) {
      console.error('[generate] JSON parse failed. Raw OpenAI response:', rawContent)
      console.error('[generate] Parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      console.error('[generate] Invalid video array from OpenAI:', videos)
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 500 }
      )
    }

    // ── 8. Save to history ───────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('generations').insert({
      user_id: user.id,
      niche,
      content: videos,
    })

    if (insertError) {
      console.error('[generate] Failed to save to generations table:', insertError.message, insertError.code)
    }

    // ── 9. Increment usage counter for free users ────────────────────────────
    if (!isPro && !isTopicMode) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ generations_used: generationsUsed + 1 })
        .eq('id', user.id)

      if (updateError) {
        console.error('[generate] Failed to update generations_used:', updateError.message)
      }
    }

    return NextResponse.json({ videos })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate] Unexpected top-level error:', msg, error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
