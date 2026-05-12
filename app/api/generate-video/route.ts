import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask, buildRunwayPayload } from '@/lib/runway'
import {
  encodeGenerationMeta,
  fetchActiveGeneration,
  finalizeGeneration,
  isStale,
} from '@/lib/generations'

export const maxDuration = 60

type Quality = 'basic' | 'pro'

// Flat per-job cost. The spec says credits are charged ONCE for the whole
// generation regardless of clip count — 30s and 50s jobs do not pay 3x or 5x.
// Basic = 15 credits, Pro = 20 credits (push #020 pricing policy).
function costForQuality(q: string | undefined): number {
  if (q === 'pro') return 20
  return 15 // 'basic'
}

/**
 * How many 10-second Runway clips are needed for the requested duration.
 * 10s â 1 clip, 30s â 3 clips, 50s â 5 clips.
 */
function clipCountForDuration(duration: number): number {
  if (duration <= 10) return 1
  if (duration <= 30) return 3
  return 5
}

/**
 * Normalize the platform value to the human-readable label.
 * Push #021's client started sending snake_case identifiers ("youtube_shorts",
 * "tiktok", "instagram_reels") to match the new platform selector. The legacy
 * `videos.platform` column was populated with display labels ("YouTube Shorts",
 * etc.) and may have a CHECK constraint enforcing that — sending snake_case
 * would make the INSERT fail and surface as "Video generation failed." in the
 * UI. Normalize here so the DB always sees the original shape and Runway's
 * ratio mapping is happy (it accepts both forms).
 */
function normalizePlatform(raw: string | undefined): string {
  const v = (raw ?? '').toString().trim().toLowerCase()
  if (v === 'tiktok') return 'TikTok'
  if (v === 'instagram_reels' || v === 'instagram reels') return 'Instagram Reels'
  if (v === 'youtube_shorts' || v === 'youtube shorts') return 'YouTube Shorts'
  return 'YouTube Shorts'
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RUNWAY_API_KEY) {
      console.error('[generate-video] RUNWAY_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Video service is not configured. Please contact support.' },
        { status: 500 }
      )
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-video] OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate a video.' },
        { status: 401 }
      )
    }

    // ââ Concurrency / stale-job guard ââââââââââââââââââââââââââââââââââââââââ
    // Runway tier has concurrency = 1, so only one processing generation per
    // user is allowed. If the existing one is stale we sweep it and proceed.
    const active = await fetchActiveGeneration(supabase, user.id)
    if (active) {
      if (isStale({ created_at: active.created_at, updated_at: active.updated_at })) {
        console.log(`[generate-video] sweeping stale generation ${active.id} for user ${user.id}`)
        await finalizeGeneration(supabase, active.id, 'failed', { credits_used: 0 })
      } else {
        return NextResponse.json(
          {
            error: 'active_generation_exists',
            generation_id: active.id,
            status: 'processing',
            created_at: active.created_at,
            updated_at: active.updated_at ?? active.created_at,
          },
          { status: 409 }
        )
      }
    }

    let body: {
      prompt?: string
      platform?: string
      duration?: number
      quality?: string
      provider_prompt?: string
      scene_visual_prompts?: unknown
      // Push #026 — pass-through fields from the analyze-idea creative brief.
      // These power the final-video composition step (TTS + captions) once
      // Runway finishes its silent visual clips.
      voiceover_script?: string
      scene_captions?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    // The user-facing idea field is the textarea — cap is generous (1500)
    // because we never send this raw to Runway. The per-clip prompt that
    // actually reaches Runway is built below from the analyze-idea brief
    // (provider_prompt + scene_visual_prompts) and hard-clamped to 500.
    if (prompt.length > 1500) {
      return NextResponse.json(
        { error: 'Your idea is too long. Please trim it to 1500 characters.' },
        { status: 400 },
      )
    }

    // Resolve platform and duration.
    // We support 10s (1 clip), 30s (3 clips), and 50s (5 clips).
    // Each Runway clip is 10 seconds; clips are generated sequentially.
    const platform = normalizePlatform(body.platform)
    const requestedDuration = Number(body.duration) || 10
    const duration = requestedDuration <= 10 ? 10 : requestedDuration <= 30 ? 30 : 50
    const clipCount = clipCountForDuration(duration)
    const quality: Quality = body.quality === 'pro' ? 'pro' : 'basic'

    console.log('[generate-video] request', {
      user_id: user.id,
      raw_platform: body.platform,
      platform,
      duration,
      quality,
      clipCount,
      prompt_length: prompt.length,
    })
    // Flat cost — 15 credits for Basic, 20 credits for Pro, regardless of duration.
    const cost = costForQuality(quality)

    // ââ Credit balance check (we DO NOT deduct here â deduction happens after
    // the Runway task completes successfully in /status). âââââââââââââââââââââ
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()

      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[generate-video] credit check failed:', profileErr.message)
      }
      const balance = profile?.video_credits ?? 0
      if (balance < cost) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: cost, balance },
          { status: 402 }
        )
      }
    }

    // Step 1 â OpenAI breaks the prompt into N cinematic scenes (one per clip).
    // Runway's text_to_video endpoint rejects prompts >500 chars, so every
    // string we hand it is clamped here at the boundary.
    const RUNWAY_MAX = 500
    const clampForRunway = (raw: string): string => {
      const flat = (raw ?? '').replace(/\s+/g, ' ').trim()
      if (flat.length <= RUNWAY_MAX) return flat
      const window = flat.slice(0, RUNWAY_MAX)
      const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
      if (lastSentence > RUNWAY_MAX * 0.6) return window.slice(0, lastSentence + 1).trim()
      const lastComma = window.lastIndexOf(', ')
      if (lastComma > RUNWAY_MAX * 0.6) return window.slice(0, lastComma).trim()
      const lastSpace = window.lastIndexOf(' ')
      if (lastSpace > RUNWAY_MAX * 0.6) return window.slice(0, lastSpace).trim()
      return window.trim()
    }

    // Push #024B: prefer the per-scene visual prompts from /api/analyze-idea
    // when the client passes them through. Falls back to generating fresh
    // scenes via OpenAI when the user hits Generate without analyzing first.
    // Either way every string is clamped to RUNWAY_MAX before going anywhere
    // near Runway.
    const providerPromptRaw = typeof body.provider_prompt === 'string' ? body.provider_prompt.trim() : ''
    const providerPrompt = providerPromptRaw ? clampForRunway(providerPromptRaw) : ''
    if (providerPrompt) {
      console.log('[runway] provider_prompt length:', providerPrompt.length)
      console.log('[runway] provider_prompt preview:', providerPrompt.slice(0, 100))
    }

    const incomingScenePrompts = Array.isArray(body.scene_visual_prompts)
      ? body.scene_visual_prompts
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim())
      : []

    let scenes: string[]
    if (incomingScenePrompts.length >= clipCount) {
      scenes = incomingScenePrompts.slice(0, clipCount).map(clampForRunway)
      console.log(`[generate-video] using brief scene prompts (count=${scenes.length})`)
    } else if (incomingScenePrompts.length > 0) {
      const padBase = providerPrompt || prompt
      try {
        const generated = await generateScenes(padBase, clipCount - incomingScenePrompts.length)
        scenes = [...incomingScenePrompts, ...generated].slice(0, clipCount).map(clampForRunway)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-video] partial scene padding failed:', msg)
        scenes = incomingScenePrompts.slice(0, clipCount).map(clampForRunway)
        while (scenes.length < clipCount) {
          scenes.push(clampForRunway(providerPrompt || prompt))
        }
      }
    } else {
      const seedPrompt = providerPrompt || prompt
      try {
        scenes = (await generateScenes(seedPrompt, clipCount)).map(clampForRunway)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-video] scene generation failed:', msg)
        return NextResponse.json(
          { error: 'Failed to plan scenes. Please try a different prompt.' },
          { status: 500 }
        )
      }
    }

    scenes.forEach((s, i) => console.log(`[runway] scene prompt length [${i + 1}/${scenes.length}]:`, s.length))

    // Pre-validate the first scene payload BEFORE launching tasks.
    // This catches any Runway field errors early â before credits are charged.
    try {
      buildRunwayPayload(scenes[0], platform, 10, quality)
    } catch (validationErr: unknown) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
      console.error('[generate-video] payload pre-validation failed:', msg)
      return NextResponse.json(
        { error: `Request validation failed: ${msg}` },
        { status: 400 }
      )
    }

    // Step 2 â Kick off ONLY the first Runway clip and return immediately.
    // Runway Tier 1 has concurrency=1. Remaining clips are stored as
    // pending_scenes and launched sequentially by /status as each clip finishes.
    let singleTask: { id: string; promptText: string }
    try {
      singleTask = await startRunwayTask(scenes[0], platform, 10, quality)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      return NextResponse.json(
        { error: msg },
        { status: 502 }
      )
    }

    const taskHandles = [{
      id: singleTask.id,
      promptText: singleTask.promptText,
      index: 0,
    }]

    // Step 3 â Persist the generation row so we can recover after a refresh
    // and so /status can authorize the polling request.
    // Push #026 — pull voiceover script + per-scene captions from the brief
    // so /status can compose the final MP4 once Runway finishes its silent
    // clips. Both are best-effort — missing fields just mean composition
    // either skips audio (no script) or skips overlays (no captions).
    const voiceoverScript = (() => {
      const raw = typeof body.voiceover_script === 'string' ? body.voiceover_script.trim() : ''
      if (!raw) return ''
      return raw.length > 4000 ? raw.slice(0, 4000) : raw
    })()
    const sceneCaptions: string[] = (() => {
      if (!Array.isArray(body.scene_captions)) return []
      return body.scene_captions
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        .map((c) => {
          const words = c.trim().replace(/[.!?]+$/g, '').split(/\s+/).filter(Boolean)
          return words.slice(0, 8).join(' ')
        })
        .slice(0, clipCount)
    })()

    console.log(
      `[generate-video] brief — voiceover_chars=${voiceoverScript.length} ` +
      `captions=${sceneCaptions.length}/${clipCount} ` +
      `received_vo=${typeof body.voiceover_script === 'string' ? body.voiceover_script.length : 'none'} ` +
      `received_captions=${Array.isArray(body.scene_captions) ? body.scene_captions.length : 'none'} ` +
      `creatomate_env=${!!process.env.CREATOMATE_API_KEY}`,
    )
    if (!voiceoverScript || sceneCaptions.length === 0) {
      console.warn(
        `[generate-video] brief is missing audio or captions — status route will ` +
        `synthesise the gap (this happens when the user generates without analyzing first).`,
      )
    }

    const meta = encodeGenerationMeta({
      task_ids: taskHandles,
      prompt,
      scenes,
      cost,
      platform,
      duration,
      quality,
      pending_scenes: scenes.slice(1),   // clips 1..N-1 queued for later
      completed_clip_urls: [],            // filled in by /status as clips finish
      voiceover_script: voiceoverScript || undefined,
      scene_captions: sceneCaptions.length > 0 ? sceneCaptions : undefined,
      compose_status: 'idle',
    })

    const { data: inserted, error: insertErr } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        status: 'processing',
        platform,
        duration,
        quality_mode: quality,
        credits_used: 0, // charged only on completion
        topic: prompt,
        script: meta,
        title: prompt.slice(0, 60),
      })
      .select('id, created_at')
      .single()

    if (insertErr || !inserted) {
      // Full error details — code (e.g. 23514 = check_violation, 22P02 = invalid
      // text representation), details, hint — so DB constraint issues are
      // visible in the server log instead of just a generic "row didn't insert".
      console.error('[generate-video] failed to persist generation row:', {
        message: insertErr?.message,
        code: insertErr?.code,
        details: insertErr?.details,
        hint: insertErr?.hint,
        platform,
        duration,
        quality,
        runway_task_id: singleTask.id,
      })
      return NextResponse.json(
        { error: 'Could not start generation. Please try again.' },
        { status: 500 }
      )
    }

    console.log(`[generate-video] created generation ${inserted.id} for user ${user.id} (duration=${duration}s, clips=${clipCount}, cost=${cost})`)

    return NextResponse.json(
      {
        generation_id: inserted.id,
        status: 'processing',
        prompt,
        scenes,
        tasks: taskHandles,
        cost,
        clip_count: clipCount,
        duration,
        created_at: inserted.created_at,
      },
      { status: 202 }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[generate-video] unexpected error:', { msg, stack })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
