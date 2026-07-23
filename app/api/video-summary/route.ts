import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

// video-summary — Push #421
//
// On-demand YouTube metadata for a video in My Videos. The videos table has
// youtube_description + hashtags columns the UI already knows how to show,
// but the generation pipeline never fills them (0 of 200 completed videos in
// prod had a description). Instead of touching the pipeline, this route
// generates the metadata lazily from the stored script/topic the FIRST time
// the user asks for it, then caches the result back into the row — so every
// later click is instant and the OpenAI cost (~$0.0001, gpt-4o-mini) is paid
// at most once per video. Works retroactively for every video ever generated.
//
// POST { videoId } →
//   200 { title, description, hashtags, cached }
//   401 not logged in · 404 not the caller's video · 422 video has no script

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface SummaryJson {
  title?: unknown
  description?: unknown
  hashtags?: unknown
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let videoId: string | undefined
    try {
      const body = await request.json()
      videoId = typeof body?.videoId === 'string' ? body.videoId : undefined
    } catch {
      /* fall through to validation */
    }
    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
    }

    const { data: video, error } = await supabase
      .from('videos')
      .select('id, title, topic, script, youtube_description, hashtags')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (error || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Cache hit — the row already carries everything the panel needs.
    const cachedHashtags = Array.isArray(video.hashtags)
      ? (video.hashtags as unknown[]).filter((h): h is string => typeof h === 'string')
      : []
    if (video.youtube_description && cachedHashtags.length > 0) {
      return NextResponse.json({
        title: video.title ?? null,
        description: video.youtube_description,
        hashtags: cachedHashtags,
        cached: true,
      })
    }

    // Source text: prefer the clean script column, fall back to topic (which
    // holds the structured script for fast-path videos). Both are user-owned
    // content. Cap length so the prompt stays cheap.
    const source = (video.script?.trim() || video.topic?.trim() || '').slice(0, 4000)
    if (!source) {
      return NextResponse.json({ error: 'This video has no script to summarize' }, { status: 422 })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write YouTube Shorts posting metadata. Given a Short's narration script, respond with ONLY valid JSON in this exact shape: {"title": string, "description": string, "hashtags": string[]}.

RULES:
- Write in the SAME LANGUAGE as the script (English script → English metadata, Portuguese → Portuguese, etc).
- "title": a curiosity-driven YouTube title, max 90 characters, no surrounding quotes, at most 1 emoji at the end.
- "description": 2-4 natural sentences summarizing what the video reveals, weaving in the main searchable keywords (SEO). End with a short line inviting viewers to follow for more. Plain text only — the hashtags go in their own field, NOT here.
- "hashtags": exactly 7 strings, each starting with "#", lowercase, no spaces inside a tag. The first MUST be "#shorts". Mix topic-specific and broad viral tags.
- The script may contain production markers like HOOK, MICRO REWARD, ESCALATION, RHYTHM, PAYOFF or [Pexels: ...] cues — these are internal stage directions, NEVER mention or include them.
- Never mention AI, prompts, or that anything was generated.`,
        },
        { role: 'user', content: `VIDEO SCRIPT:\n${source}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: SummaryJson
    try {
      parsed = JSON.parse(raw) as SummaryJson
    } catch {
      return NextResponse.json({ error: 'Could not generate a summary, try again' }, { status: 502 })
    }

    const title =
      typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim().slice(0, 120) : null
    const description =
      typeof parsed.description === 'string' && parsed.description.trim()
        ? parsed.description.trim().slice(0, 2000)
        : null
    let hashtags = Array.isArray(parsed.hashtags)
      ? (parsed.hashtags as unknown[])
          .filter((h): h is string => typeof h === 'string' && h.trim().length > 1)
          .map((h) => (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`))
          .slice(0, 10)
      : []
    if (!hashtags.some((h) => h.toLowerCase() === '#shorts')) {
      hashtags = ['#shorts', ...hashtags].slice(0, 10)
    }

    if (!description) {
      return NextResponse.json({ error: 'Could not generate a summary, try again' }, { status: 502 })
    }

    // Medida 1 (sprint de conversão) — acquisition loop: every FREE-plan user's
    // copy-paste YouTube description carries a branded creation link, so each
    // posted video markets the product (mirrors the #434 watermark rule:
    // clean description = paid plan). Appended AFTER validation so the AI text
    // itself stays untouched; never blocks the response.
    let finalDescription = description
    try {
      const { data: planRow } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      const PAID_PLANS = new Set([
        'starter', 'starter_trial', 'basic', 'basic_trial',
        'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial',
      ])
      const isFreePlan = !PAID_PLANS.has(((planRow?.plan ?? 'free') as string).toLowerCase())
      if (isFreePlan) {
        finalDescription = `${description}\n\n⚡ Made with Kineo — create Shorts like this, usually in 2–4 minutes: https://www.usekineo.com?utm_source=video_desc`
      }
    } catch {
      // best-effort: on any failure ship the clean description
    }

    // Cache back into the row (best effort — the response is already built,
    // a failed cache write must not fail the request). Only fill title if the
    // row doesn't have one yet, so we never overwrite pipeline-set titles.
    const updatePayload: Record<string, unknown> = {
      youtube_description: finalDescription,
      hashtags,
    }
    if (!video.title && title) updatePayload.title = title
    const { error: cacheError } = await supabase
      .from('videos')
      .update(updatePayload)
      .eq('id', video.id)
      .eq('user_id', user.id)
    if (cacheError) {
      console.warn('[video-summary] cache write failed:', cacheError.message)
    }

    return NextResponse.json({
      title: video.title ?? title,
      description: finalDescription,
      hashtags,
      cached: false,
    })
  } catch (err) {
    console.error('[video-summary] error:', err)
    return NextResponse.json({ error: 'Could not generate a summary, try again' }, { status: 500 })
  }
}
