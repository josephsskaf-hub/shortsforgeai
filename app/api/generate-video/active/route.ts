import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  decodeGenerationMeta,
  fetchActiveGeneration,
  finalizeGeneration,
  isStale,
} from '@/lib/generations'

export const maxDuration = 10

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const active = await fetchActiveGeneration(supabase, user.id)
    if (!active) {
      return NextResponse.json({ active: null })
    }

    // Sweep stale jobs so the user is never blocked.
    if (isStale({ created_at: active.created_at, updated_at: active.updated_at })) {
      console.log(`[generate-video/active] sweeping stale generation ${active.id}`)
      await finalizeGeneration(supabase, active.id, 'failed', { credits_used: 0 })
      return NextResponse.json({ active: null, swept: true })
    }

    const meta = decodeGenerationMeta(active.script)

    return NextResponse.json({
      active: {
        generation_id: active.id,
        status: 'processing',
        created_at: active.created_at,
        updated_at: active.updated_at ?? active.created_at,
        prompt: active.prompt ?? meta?.prompt ?? '',
        scenes: meta?.scenes ?? [],
        tasks: meta?.task_ids ?? [],
        cost: meta?.cost ?? 1,
        clips_total: meta?.scenes?.length ?? (meta?.task_ids?.length ?? 1),
        clips_done: meta?.completed_clip_urls?.length ?? 0,
        completed_clip_urls: meta?.completed_clip_urls ?? [],
        duration: meta?.duration ?? 10,
        quality: meta?.quality ?? 'basic_ai',
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video/active] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Could not load active generation.' },
      { status: 500 }
    )
  }
}
