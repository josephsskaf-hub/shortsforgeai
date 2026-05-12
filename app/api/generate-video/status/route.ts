import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getRunwayTask, startRunwayTask, type RunwayTaskState } from '@/lib/runway'
import {
  decodeGenerationMeta,
  finalizeGeneration,
  isStale,
  touchGeneration,
  type GenerationMeta,
} from '@/lib/generations'
import { startComposition, checkComposition } from '@/lib/compose'

export const maxDuration = 30

function looksLikeVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$|&)/.test(lower)) return false
  return true
}

// Push #026 — patch the meta blob on a processing row without flipping its
// status. We use the same `status='processing'` guard as `finalizeGeneration`
// to make sure only one polling request wins each transition.
async function patchMeta(
  supabase: SupabaseClient,
  generationId: string,
  patch: Partial<GenerationMeta>,
  currentMeta: GenerationMeta | null,
): Promise<GenerationMeta | null> {
  if (!currentMeta) return null
  const next = { ...currentMeta, ...patch }
  const { error } = await supabase
    .from('videos')
    .update({ script: JSON.stringify(next), updated_at: new Date().toISOString() })
    .eq('id', generationId)
    .eq('status', 'processing')
  if (error) {
    console.error('[generate-video/status] patchMeta error:', error.message)
    return null
  }
  return next
}

async function fetchTaskStates(ids: string[]): Promise<RunwayTaskState[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        return await getRunwayTask(id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          id,
          status: 'FAILED' as const,
          progress: null,
          videoUrl: null,
          failure: msg,
        }
      }
    })
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

    const generationId = req.nextUrl.searchParams.get('generation_id')

    // ââ Modern path: poll by generation_id (DB-backed, recoverable). âââââââââ
    if (generationId) {
      const { data: row, error: rowErr } = await supabase
        .from('videos')
        .select('id,user_id,status,video_url,credits_used,script,created_at,updated_at')
        .eq('id', generationId)
        .maybeSingle()

      // Fallback if `updated_at` column doesn't exist yet.
      let video = row as Record<string, unknown> | null
      if (!video && rowErr && /updated_at/.test(rowErr.message ?? '')) {
        const retry = await supabase
          .from('videos')
          .select('id,user_id,status,video_url,credits_used,script,created_at')
          .eq('id', generationId)
          .maybeSingle()
        video = retry.data as Record<string, unknown> | null
      }

      if (!video) {
        return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
      }
      if (video.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }

      const status = (typeof video.status === 'string' ? video.status : 'processing') as string
      const meta: GenerationMeta | null = decodeGenerationMeta(typeof video.script === 'string' ? video.script : null)
      const taskIds = meta?.task_ids?.map((t) => t.id) ?? []

      // Already finalised â return cached state without hitting Runway again.
      if (status !== 'processing') {
        const allUrls = meta?.completed_clip_urls ?? []
        const composed = typeof meta?.final_video_url === 'string' ? meta.final_video_url : null
        const stored = typeof video.video_url === 'string' ? video.video_url : null
        // Prefer the composed MP4 (push #026); fall back to stored
        // `video_url` (the raw Runway clip URL we used to write before #026
        // for legacy rows or when composition was skipped).
        const primary = composed ?? stored
        return NextResponse.json({
          generation_id: video.id,
          status,
          video_url: primary,
          final_video_url: composed,
          voiceover_url: typeof meta?.voiceover_url === 'string' ? meta.voiceover_url : null,
          all_clip_urls: allUrls.length > 0 ? allUrls : primary ? [primary] : [],
          completed_clip_urls: allUrls,
          clips_total: meta?.scenes.length ?? (primary ? 1 : 0),
          done: true,
          tasks: [],
        })
      }

      // Stale sweep â protect against jobs the user abandoned.
      const createdAt = String(video.created_at)
      const updatedAt = typeof video.updated_at === 'string' ? video.updated_at : null
      if (isStale({ created_at: createdAt, updated_at: updatedAt })) {
        console.log(`[generate-video/status] sweeping stale generation ${video.id}`)
        await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
        return NextResponse.json({
          generation_id: video.id,
          status: 'failed',
          done: true,
          stale: true,
          tasks: [],
        })
      }

      if (taskIds.length === 0) {
        // Misshapen row â finalise it so the user isn't stuck forever.
        await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
        return NextResponse.json({
          generation_id: video.id,
          status: 'failed',
          done: true,
          tasks: [],
        })
      }

      // Push #026 â composing phase: Runway is already done. Skip Runway
      // polling, just check Creatomate. Charge credits only when the composed
      // MP4 actually exists; on failure, finalise as failed with 0 credits.
      if (meta?.compose_render_id) {
        const allClipUrls = meta.completed_clip_urls ?? []
        const clipsTotal = meta.scenes.length ?? allClipUrls.length
        const composeState = await checkComposition(meta.compose_render_id)
        console.log(
          `[generate-video/status] generation ${video.id} compose=${composeState.kind} renderId=${meta.compose_render_id}`,
        )

        if (composeState.kind === 'rendering') {
          await touchGeneration(supabase, String(video.id))
          return NextResponse.json({
            generation_id: video.id,
            status: 'processing',
            phase: 'composing',
            compose_progress: composeState.progress,
            done: false,
            clips_done: allClipUrls.length,
            clips_total: clipsTotal,
            completed_clip_urls: allClipUrls,
            tasks: [],
          })
        }

        if (composeState.kind === 'failed') {
          console.error(
            `[generate-video/status] generation ${video.id} compose failed: ${composeState.reason}`,
          )
          await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
          return NextResponse.json({
            generation_id: video.id,
            status: 'failed',
            phase: 'composing_failed',
            error: 'Final video rendering failed. Please try again.',
            done: true,
            tasks: [],
          })
        }

        // succeeded â finalise + charge credits
        const finalUrl = composeState.url
        const rawCost = meta.cost ?? 15
        const cost = meta.quality === 'pro' ? 20 : Math.max(15, Math.min(20, rawCost))
        const finalMeta = JSON.stringify({
          ...meta,
          final_video_url: finalUrl,
          compose_status: 'succeeded',
        })
        const won = await finalizeGeneration(supabase, String(video.id), 'completed', {
          video_url: finalUrl,
          credits_used: cost,
          script: finalMeta,
        })
        let creditsDeducted = false
        if (won) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('video_credits')
            .eq('id', user.id)
            .single()
          if (profileErr) {
            console.error('[generate-video/status] could not load credits:', profileErr.message)
          } else {
            const current = profile?.video_credits ?? 0
            const next = Math.max(0, current - cost)
            const { error: dedErr } = await supabase
              .from('profiles')
              .update({ video_credits: next })
              .eq('id', user.id)
            if (dedErr) {
              console.error('[generate-video/status] credit deduction failed:', dedErr.message)
            } else {
              creditsDeducted = true
              console.log(
                `[generate-video/status] generation ${video.id} -> completed (composed), ` +
                `final_url=${finalUrl.slice(0, 80)} duration=${meta.duration}s ` +
                `charged ${cost} credit(s) (${current} -> ${next})`,
              )
            }
          }
        }

        return NextResponse.json({
          generation_id: video.id,
          status: 'completed',
          phase: 'done',
          done: true,
          video_url: finalUrl,
          final_video_url: finalUrl,
          voiceover_url: meta.voiceover_url ?? null,
          all_clip_urls: allClipUrls,
          completed_clip_urls: allClipUrls,
          clips_total: clipsTotal,
          tasks: [],
          cost,
          creditsDeducted,
        })
      }

      const results = await fetchTaskStates(taskIds)
      const allDone = results.every(
        (r) => r.status === 'SUCCEEDED' || r.status === 'FAILED' || r.status === 'CANCELLED'
      )
      const playable = results.filter(
        (r) => r.status === 'SUCCEEDED' && looksLikeVideoUrl(r.videoUrl)
      )
      const succeeded = results.filter((r) => r.status === 'SUCCEEDED').length

      if (!allDone) {
        await touchGeneration(supabase, String(video.id))
        const completedUrlsSoFar = meta?.completed_clip_urls ?? []
        const clipsTotal = meta?.scenes.length ?? 1
        return NextResponse.json({
          generation_id: video.id,
          status: 'processing',
          done: false,
          succeeded,
          playable: playable.length,
          total: results.length,
          tasks: results,
          completed_clip_urls: completedUrlsSoFar,
          clip_index: completedUrlsSoFar.length,
          clips_done: completedUrlsSoFar.length,
          clips_total: clipsTotal,
        })
      }

      // ââ Check for pending clips (multi-clip pipeline) ââââââââââââââââââââââââ
      const pendingScenes = meta?.pending_scenes ?? []
      const completedUrls = meta?.completed_clip_urls ?? []

      if (pendingScenes.length > 0) {
        if (playable.length === 0) {
          // Current clip failed â abort the whole generation
          await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
          console.log(`[generate-video/status] generation ${video.id} -> failed (clip failed, pending=${pendingScenes.length})`)
          return NextResponse.json({
            generation_id: video.id,
            status: 'failed',
            done: true,
            tasks: results,
          })
        }

        // Current clip succeeded â launch the next one
        const nextScene = pendingScenes[0]
        let nextTask: { id: string; promptText: string }
        try {
          nextTask = await startRunwayTask(
            nextScene,
            meta!.platform,
            10,
            meta!.quality === 'pro' ? 'pro' : 'basic',
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[generate-video/status] failed to launch next clip:', msg)
          await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
          return NextResponse.json({ generation_id: video.id, status: 'failed', done: true, tasks: results })
        }

        const newCompletedUrls = [...completedUrls, ...playable.map((p) => p.videoUrl!)]
        const updatedMeta = {
          ...meta!,
          task_ids: [{ id: nextTask.id, promptText: nextTask.promptText, index: (meta?.task_ids.length ?? 0) }],
          pending_scenes: pendingScenes.slice(1),
          completed_clip_urls: newCompletedUrls,
        }
        await supabase
          .from('videos')
          .update({ script: JSON.stringify(updatedMeta), updated_at: new Date().toISOString() })
          .eq('id', String(video.id))
          .eq('status', 'processing')

        console.log(`[generate-video/status] generation ${video.id}: clip done, launched next (remaining=${pendingScenes.length - 1})`)
        return NextResponse.json({
          generation_id: video.id,
          status: 'processing',
          done: false,
          clip_index: updatedMeta.task_ids[0].index,
          clips_done: newCompletedUrls.length,
          clips_total: (meta?.scenes.length ?? 1),
          tasks: results,
        })
      }

      // ââ Terminal state â all clips done. Finalise and charge credits. ââââââââ
      const allClipUrls = [...completedUrls, ...playable.map((p) => p.videoUrl!)]

      if (allClipUrls.length === 0) {
        const moved = await finalizeGeneration(supabase, String(video.id), 'failed', {
          credits_used: 0,
        })
        if (moved) {
          console.log(`[generate-video/status] generation ${video.id} -> failed (no playable clip)`)
        }
        return NextResponse.json({
          generation_id: video.id,
          status: 'failed',
          done: true,
          succeeded,
          playable: 0,
          total: results.length,
          tasks: results,
        })
      }

      // Push #026 — instead of finalising with the raw silent Runway clip,
      // submit a Creatomate composition (visuals + TTS + captions + CTA) and
      // let the next /status poll pick up the composed MP4. Credits are
      // charged only when the composed final_video_url actually exists.
      //
      // We only require CREATOMATE_API_KEY here. If the brief is missing the
      // voiceover_script or scene_captions, startComposition() synthesises
      // them from the prompt + scenes so the final video always has audio
      // and overlays. The only case we still fall back on raw clips is when
      // CREATOMATE_API_KEY is missing in this environment.
      const haveBriefAudio = (meta?.voiceover_script ?? '').trim().length > 0
      const haveBriefCaptions = (meta?.scene_captions ?? []).length > 0
      console.log(
        `[generate-video/status] generation ${video.id} compose precheck — ` +
        `CREATOMATE_API_KEY=${!!process.env.CREATOMATE_API_KEY} ` +
        `OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY} ` +
        `SUPABASE_SERVICE_ROLE_KEY=${!!process.env.SUPABASE_SERVICE_ROLE_KEY} ` +
        `vo_chars=${(meta?.voiceover_script ?? '').length} ` +
        `captions=${(meta?.scene_captions ?? []).length} ` +
        `scenes=${meta?.scenes.length ?? 0} clips=${allClipUrls.length}`,
      )
      const canCompose = !!process.env.CREATOMATE_API_KEY

      if (!canCompose) {
        // Push #026 — the prior fallback silently marked the row "completed"
        // with the raw Runway clip URL, which made the UI claim "Your video is
        // ready" for a silent 10s clip. Per the spec, generation is completed
        // ONLY when a composed final_video_url exists. So treat the missing
        // CREATOMATE_API_KEY as a hard failure and refund credits — never ship
        // a silent clip as the final video.
        console.error(
          `[generate-video/status] generation ${video.id} cannot compose: ` +
          `CREATOMATE_API_KEY is not configured. Marking generation as failed.`,
        )
        await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
        return NextResponse.json({
          generation_id: video.id,
          status: 'failed',
          phase: 'composing_failed',
          error: 'Final video rendering is not configured. Please contact support.',
          done: true,
          tasks: results,
        })
      }

      // If the brief is missing audio or captions, synthesize them locally so
      // we never ship a silent clip just because the analyze-idea step was
      // skipped (e.g. a topic shortcut or a manual generate). We derive
      // captions from the per-scene Runway prompts (~6 words each) and the
      // voiceover script by concatenating those captions.
      const fallbackCaptions: string[] =
        haveBriefCaptions
          ? meta!.scene_captions!
          : (meta?.scenes ?? []).map((s) => {
              const words = s.replace(/[.!?]+/g, ' ').split(/\s+/).filter(Boolean)
              return words.slice(0, 6).join(' ')
            }).filter((c) => c.length > 0)
      const fallbackVoiceover: string =
        haveBriefAudio
          ? meta!.voiceover_script!
          : (() => {
              const fromCaptions = fallbackCaptions.join('. ').trim()
              const base = (meta?.prompt ?? '').trim()
              const merged = fromCaptions || base
              if (!merged) return 'Watch this story unfold. Follow for more.'
              return `${merged}. Follow for more.`
            })()
      if (!haveBriefAudio || !haveBriefCaptions) {
        console.log(
          `[generate-video/status] generation ${video.id} synthesised compose inputs — ` +
          `voiceover_chars=${fallbackVoiceover.length} captions=${fallbackCaptions.length} ` +
          `(brief had vo=${haveBriefAudio} captions=${haveBriefCaptions})`,
        )
      }

      let composeResult: { renderId: string; voiceoverUrl: string | null; composedDurationSec: number }
      try {
        composeResult = await startComposition({
          userId: user.id,
          clipUrls: allClipUrls,
          voiceoverScript: fallbackVoiceover,
          sceneCaptions: fallbackCaptions,
          totalDurationSec: meta?.duration ?? 30,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[generate-video/status] composition start failed: ${msg}`)
        await finalizeGeneration(supabase, String(video.id), 'failed', { credits_used: 0 })
        return NextResponse.json({
          generation_id: video.id,
          status: 'failed',
          phase: 'composing_failed',
          error: 'Final video rendering failed. Please try again.',
          done: true,
          tasks: results,
        })
      }

      const pendingMeta = await patchMeta(
        supabase,
        String(video.id),
        {
          completed_clip_urls: allClipUrls,
          pending_scenes: [],
          compose_render_id: composeResult.renderId,
          compose_status: 'rendering',
          voiceover_url: composeResult.voiceoverUrl ?? undefined,
        },
        meta,
      )

      console.log(
        `[generate-video/status] generation ${video.id}: Runway done, composition ` +
        `submitted (renderId=${composeResult.renderId}, dur=${composeResult.composedDurationSec}s, ` +
        `vo=${!!composeResult.voiceoverUrl})`,
      )

      return NextResponse.json({
        generation_id: video.id,
        status: 'processing',
        phase: 'composing',
        compose_progress: 5,
        done: false,
        succeeded,
        playable: allClipUrls.length,
        total: results.length,
        clips_done: allClipUrls.length,
        clips_total: pendingMeta?.scenes.length ?? meta?.scenes.length ?? allClipUrls.length,
        completed_clip_urls: allClipUrls,
        tasks: results,
      })
    }

    // ââ Legacy path: poll by raw `tasks=` query param. âââââââââââââââââââââââ
    const tasksParam = req.nextUrl.searchParams.get('tasks') ?? ''
    const ids = tasksParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing tasks or generation_id parameter.' }, { status: 400 })
    }
    if (ids.length > 8) {
      return NextResponse.json({ error: 'Too many tasks requested.' }, { status: 400 })
    }

    const results = await fetchTaskStates(ids)
    const done = results.every(
      (r) => r.status === 'SUCCEEDED' || r.status === 'FAILED' || r.status === 'CANCELLED'
    )
    const anyFailed = results.some((r) => r.status === 'FAILED' || r.status === 'CANCELLED')
    const succeeded = results.filter((r) => r.status === 'SUCCEEDED').length
    const playable = results.filter(
      (r) => r.status === 'SUCCEEDED' && looksLikeVideoUrl(r.videoUrl)
    ).length

    return NextResponse.json({
      done,
      anyFailed,
      succeeded,
      playable,
      total: results.length,
      tasks: results,
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
