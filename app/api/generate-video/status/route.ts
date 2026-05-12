import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRunwayTask, startRunwayTask, type RunwayTaskState } from '@/lib/runway'
import {
  decodeGenerationMeta,
  finalizeGeneration,
  isStale,
  touchGeneration,
  type GenerationMeta,
} from '@/lib/generations'

export const maxDuration = 30

function looksLikeVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$|&)/.test(lower)) return false
  return true
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
        const primary = typeof video.video_url === 'string' ? video.video_url : null
        return NextResponse.json({
          generation_id: video.id,
          status,
          video_url: primary,
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

      const primaryUrl = allClipUrls[0]
      // Flat per-job pricing: Basic = 1 credit, Pro = 2 credits, regardless of
      // clip count. The cap defends against legacy in-flight rows that were
      // saved under the old per-clip multiplication.
      const rawCost = meta?.cost ?? 1
      const cost = meta?.quality === 'pro' ? 2 : Math.max(1, Math.min(2, rawCost))

      // Persist the complete list of clip URLs into meta so that cached reads
      // (status returning early because the row is already finalised) can hand
      // back every clip, not just the primary one.
      const finalMeta = meta
        ? JSON.stringify({ ...meta, completed_clip_urls: allClipUrls, pending_scenes: [] })
        : undefined
      const finalisePatch: Record<string, unknown> = {
        video_url: primaryUrl,
        credits_used: cost,
      }
      if (finalMeta) finalisePatch.script = finalMeta

      // Atomic finalise: only one polling request gets to flip processing -> completed,
      // so credits can never be deducted twice.
      const won = await finalizeGeneration(supabase, String(video.id), 'completed', finalisePatch)

      let creditsDeducted = false
      if (won) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('video_credits')
          .eq('id', user.id)
          .single()

        if (profileErr) {
          console.error('[generate-video/status] could not load credits for deduction:', profileErr.message)
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
            console.log(`[generate-video/status] generation ${video.id} -> completed, charged ${cost} credit(s) (balance ${current} -> ${next})`)
          }
        }
      }

      return NextResponse.json({
        generation_id: video.id,
        status: 'completed',
        done: true,
        succeeded,
        playable: allClipUrls.length,
        total: results.length,
        video_url: primaryUrl,
        all_clip_urls: allClipUrls,
        completed_clip_urls: allClipUrls,
        clips_total: meta?.scenes.length ?? allClipUrls.length,
        tasks: results,
        cost,
        creditsDeducted,
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
