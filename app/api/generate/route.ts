import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, buildGenerationPrompt, ShortVideo } from '@/lib/openai'

const FREE_LIMIT = 5

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_pro, generations_used')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check free tier limit
    if (!profile.is_pro && profile.generations_used >= FREE_LIMIT) {
      return NextResponse.json(
        { error: 'Free limit reached. Please upgrade to Pro.' },
        { status: 402 }
      )
    }

    // Parse body
    const body = await req.json()
    const { niche } = body as { niche: string }

    const validNiches = ['mideast', 'money', 'mind', 'dark', 'motivation']
    if (!niche || !validNiches.includes(niche)) {
      return NextResponse.json({ error: 'Invalid niche' }, { status: 400 })
    }

    // Call OpenAI
    const prompt = buildGenerationPrompt(niche)

    const completion = await openai.chat.completions.create({
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
    })

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? ''

    // Parse JSON
    let videos: ShortVideo[]
    try {
      // Strip potential markdown code blocks just in case
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      videos = JSON.parse(cleaned)
    } catch {
      console.error('OpenAI raw response:', rawContent)
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: 'Invalid AI response format. Please try again.' },
        { status: 500 }
      )
    }

    // Save to generations table
    await supabase.from('generations').insert({
      user_id: user.id,
      niche,
      content: videos,
    })

    // Increment usage for free users
    if (!profile.is_pro) {
      await supabase
        .from('profiles')
        .update({ generations_used: profile.generations_used + 1 })
        .eq('id', user.id)
    }

    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
