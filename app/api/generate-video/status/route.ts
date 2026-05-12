import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  extractVideoUrl,
  getRunwayTask,
  startRunwayImageToVideo,
} from '@/lib/runway'

// Status route — frontend polls this every 5–10s while a generation is in
// flight. The two-stage Runway pipeline (text_to_image → image_to_video) is
// driven entirely from here so the POST /generate-video request returns
// quickly. Credits are deducted exactly once when the final video URL is
// confirmed.
export const maxDuration = 30

type Stage = 'text_to_image' | 'image_to_video'
type StatusValue = 'processing' | 'completed' | 'failed'

interface GenerationContent {
  type?: string
  prompt?: string
  sceneText?: string
  promptText?: string
  platform?: string
  requested_duration?: number
  quality?: string
  credits_required?: number
  stage?: Stage
  text_to_image_task_id?: string | null
  text_to_image_url?: string | null
  image_to_video_task_id?: string | null
  status?: StatusValue
  video_url?: string | null
  error?: string | null
  charged?: boolean
  created_at?: string
  updated_at?: string
}

async function deductCredits(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cost: number,
  generationId: string
): Promise<void> {
  if (cost <= 0) return
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('video_credits')
    .eq('id', userId)
    .single()
  if (fetchErr) {
    console.error(
      '[generate-video/status] credit fetch failed for generation',
      generationId,
      ':',
      fetchErr.message
    )
    return
  }
  const current = profile?.video_credits ?? 0
  const next = Math.max(0, current - cost)
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ video_credits: next })
    .eq('id', userId)
    // .gte guard means we don't underflow if balance drifted between the
    // initial check in /generate-video and now.
    .gte('video_credits', cost)
  if (updateErr) {
    console.error(
      '[generate-video/status] credit update failed for generation',
      generationId,
      ':',
      updateErr.message
    )
    return
  }
  console.log(
    '[generate-video/status] credits deducted: cost=',
    cost,
    'user=',
    userId,
    'generation=',
    generationId,
    'new_balance=',
    next
  )
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.RUNWAY_API_KEY) {
      return NextResponse.json(
        { error: 'Video service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const generationId = req.nextUrl.searchParams.get('generation_id') ?? ''
    if (!generationId) {
      return NextResponse.json(
        { error: 'Missing generation_id parameter.' },
        { status: 400 }
      )
    }

    const { data: row, error: fetchErr } = await supabase
      .from('generations')
      .select('id, user_id, content, created_at')
      .eq('id', generationId)
      .single()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
    }
    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const content: GenerationContent = (row.content as GenerationContent) ?? {}
    if (content.type !== 'runway_video') {
      return NextResponse.json(
        { error: 'This generation is not a Runway video.' },
        { status: 400 }
      )
    }

    // ── Terminal states ─────────────────────────────────────────────────────
    if (content.status === 'completed') {
      return NextResponse.json({
        generation_id: row.id,
        status: 'completed',
        video_url: content.video_url ?? null,
        progress: 1,
      })
    }
    if (content.status === 'failed') {
      return NextResponse.json({
        generation_id: row.id,
        status: 'failed',
        error: 'Video generation failed. Please try again.',
        progress: null,
      })
    }

    // ── Stage 1: text_to_image ─────────────────────────────────────────────
    const stage: Stage = content.stage ?? 'text_to_image'
    const cost = Math.max(1, Number(content.credits_required ?? 1))

    if (stage === 'text_to_image') {
      const taskId = content.text_to_image_task_id
      if (!taskId) {
        console.error('[generate-video/status] missing text_to_image_task_id on row', row.id)
        await markFailed(supabase, row.id, user.id, content, 'No text_to_image task id stored.')
        return NextResponse.json({
          generation_id: row.id,
          status: 'failed',
          error: 'Video generation failed. Please try again.',
          progress: null,
        })
      }

      let state
      try {
        state = await getRunwayTask(taskId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
          '[generate-video/status] text_to_image lookup failed for',
          taskId,
          ':',
          msg
        )
        // Transient — keep client polling.
        return NextResponse.json({
          generation_id: row.id,
          status: 'processing',
          stage: 'text_to_image',
          progress: null,
        })
      }

      console.log(
        '[generate-video/status] text_to_image gen=',
        row.id,
        'task=',
        taskId,
        'status=',
        state.status,
        'progress=',
        state.progress
      )

      if (state.status === 'SUCCEEDED') {
        const imageUrl = state.outputUrl
        if (!imageUrl) {
          await markFailed(
            supabase,
            row.id,
            user.id,
            content,
            'text_to_image succeeded with no output URL.'
          )
          return NextResponse.json({
            generation_id: row.id,
            status: 'failed',
            error: 'Video generation failed. Please try again.',
            progress: null,
          })
        }

        // Kick off the image_to_video stage now. We do NOT wait for it here —
        // the next poll will check its progress.
        let videoTask
        try {
          videoTask = await startRunwayImageToVideo(
            imageUrl,
            content.promptText ?? content.sceneText ?? content.prompt ?? '',
            content.platform ?? 'YouTube Shorts',
            10
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(
            '[generate-video/status] image_to_video start failed for gen',
            row.id,
            ':',
            msg
          )
          await markFailed(supabase, row.id, user.id, content, `image_to_video start failed: ${msg}`)
          return NextResponse.json({
            generation_id: row.id,
            status: 'failed',
            error: 'Video generation failed. Please try again.',
            progress: null,
          })
        }

        const nextContent: GenerationContent = {
          ...content,
          stage: 'image_to_video',
          text_to_image_url: imageUrl,
          image_to_video_task_id: videoTask.id,
          updated_at: new Date().toISOString(),
        }
        await supabase
          .from('generations')
          .update({ content: nextContent })
          .eq('id', row.id)
          .eq('user_id', user.id)
          .eq('content->>stage', 'text_to_image')

        console.log(
          '[generate-video/status] transitioned gen',
          row.id,
          'to image_to_video task_id=',
          videoTask.id
        )

        return NextResponse.json({
          generation_id: row.id,
          status: 'processing',
          stage: 'image_to_video',
          progress: 0.4,
        })
      }

      if (state.status === 'FAILED' || state.status === 'CANCELLED') {
        await markFailed(
          supabase,
          row.id,
          user.id,
          content,
          state.failure ?? `text_to_image ${state.status.toLowerCase()}`
        )
        return NextResponse.json({
          generation_id: row.id,
          status: 'failed',
          error: 'Video generation failed. Please try again.',
          progress: null,
        })
      }

      const partial =
        typeof state.progress === 'number'
          ? Math.max(0, Math.min(0.4, state.progress * 0.4))
          : 0.15
      return NextResponse.json({
        generation_id: row.id,
        status: 'processing',
        stage: 'text_to_image',
        progress: partial,
      })
    }

    // ── Stage 2: image_to_video ────────────────────────────────────────────
    const videoTaskId = content.image_to_video_task_id
    if (!videoTaskId) {
      console.error(
        '[generate-video/status] missing image_to_video_task_id on row',
        row.id
      )
      await markFailed(supabase, row.id, user.id, content, 'No image_to_video task id stored.')
      return NextResponse.json({
        generation_id: row.id,
        status: 'failed',
        error: 'Video generation failed. Please try again.',
        progress: null,
      })
    }

    let videoState
    try {
      videoState = await getRunwayTask(videoTaskId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        '[generate-video/status] image_to_video lookup failed for',
        videoTaskId,
        ':',
        msg
      )
      return NextResponse.json({
        generation_id: row.id,
        status: 'processing',
        stage: 'image_to_video',
        progress: null,
      })
    }

    console.log(
      '[generate-video/status] image_to_video gen=',
      row.id,
      'task=',
      videoTaskId,
      'status=',
      videoState.status,
      'progress=',
      videoState.progress
    )

    if (videoState.status === 'SUCCEEDED') {
      const videoUrl = extractVideoUrl(videoState)
      if (!videoUrl) {
        await markFailed(
          supabase,
          row.id,
          user.id,
          content,
          'image_to_video succeeded with no playable URL.'
        )
        return NextResponse.json({
          generation_id: row.id,
          status: 'failed',
          error: 'Video generation failed. Please try again.',
          progress: null,
        })
      }

      const nextContent: GenerationContent = {
        ...content,
        status: 'completed',
        video_url: videoUrl,
        charged: true,
        error: null,
        updated_at: new Date().toISOString(),
      }

      // Atomic transition: only update if status was still 'processing'. If
      // another concurrent poll already flipped it to 'completed', the update
      // affects 0 rows and we skip the credit deduction.
      const { data: updated, error: updErr } = await supabase
        .from('generations')
        .update({ content: nextContent })
        .eq('id', row.id)
        .eq('user_id', user.id)
        .eq('content->>status', 'processing')
        .select('id')

      if (updErr) {
        console.error(
          '[generate-video/status] completion update failed:',
          updErr.message
        )
        return NextResponse.json({
          generation_id: row.id,
          status: 'completed',
          video_url: videoUrl,
          progress: 1,
        })
      }

      const weWonTheRace = (updated?.length ?? 0) > 0
      if (weWonTheRace) {
        await deductCredits(supabase, user.id, cost, row.id)
      }

      return NextResponse.json({
        generation_id: row.id,
        status: 'completed',
        video_url: videoUrl,
        progress: 1,
        charged: weWonTheRace,
      })
    }

    if (videoState.status === 'FAILED' || videoState.status === 'CANCELLED') {
      await markFailed(
        supabase,
        row.id,
        user.id,
        content,
        videoState.failure ?? `image_to_video ${videoState.status.toLowerCase()}`
      )
      return NextResponse.json({
        generation_id: row.id,
        status: 'failed',
        error: 'Video generation failed. Please try again.',
        progress: null,
      })
    }

    const videoProgress =
      typeof videoState.progress === 'number'
        ? 0.4 + Math.max(0, Math.min(0.6, videoState.progress * 0.6))
        : 0.5
    return NextResponse.json({
      generation_id: row.id,
      status: 'processing',
      stage: 'image_to_video',
      progress: videoProgress,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video/status] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Status lookup failed. Please retry.' },
      { status: 500 }
    )
  }
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  generationId: string,
  userId: string,
  content: GenerationContent,
  reason: string
): Promise<void> {
  const nextContent: GenerationContent = {
    ...content,
    status: 'failed',
    error: reason,
    charged: false,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('generations')
    .update({ content: nextContent })
    .eq('id', generationId)
    .eq('user_id', userId)
    .eq('content->>status', 'processing')
  if (error) {
    console.error(
      '[generate-video/status] failed-state update error for gen',
      generationId,
      ':',
      error.message
    )
  } else {
    console.log(
      '[generate-video/status] gen',
      generationId,
      'marked failed:',
      reason
    )
  }
}
