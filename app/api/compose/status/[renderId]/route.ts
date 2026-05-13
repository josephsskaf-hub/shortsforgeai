import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { pollCreatomateRender } from '@/lib/compose'

export const maxDuration = 30
// Push #050 — this route reads auth cookies and writes to the videos
// table; explicit dynamic so Next never tries to prerender it.
export const dynamic = 'force-dynamic'

type Quality = 'basic' | 'basic_ai' | 'pro'

function creditCostFor(quality: Quality): number {
  // Matches the per-quality cost shown to the user on the Generate screen.
  // The UI display lives in app/(dashboard)/generate/GenerateClient.tsx — keep
  // these two in sync when adjusting prices. Basic / Basic AI = 15, Pro = 20.
  switch (quality) {
    case 'pro':
      return 20
    case 'basic':
    case 'basic_ai':
    default:
      return 15
  }
}

// Push #050 — persist the finished video to `videos` so it appears in
// Visual History on the Generate page and on /history. Writes through
// the service-role admin client so RLS doesn't block us (the user-
// scoped client only has INSERT policies if push #050's migration ran).
//
// Best-effort: every failure path logs but never throws — Visual
// History is a nice-to-have, not part of the user's video delivery,
// so a missing column / missing table must NEVER block returning the
// final_video_url to the client.
async function persistCompletedVideo(args: {
  userId: string
  renderId: string
  videoUrl: string
  quality: Quality
  duration: number
  topic: string
  creditsUsed: number
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[compose/status] history persist skipped — service-role env missing')
    return
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // First try with all the columns the push #050 migration adds. If
  // any of duration / quality / platform / render_id don't exist yet
  // on this DB, the second attempt retries with the legacy column set
  // we know has been present since migration 003.
  const wideRow = {
    user_id: args.userId,
    status: 'completed',
    video_url: args.videoUrl,
    credits_used: args.creditsUsed,
    topic: args.topic,
    duration: args.duration,
    quality: args.quality,
    platform: 'YouTube Shorts',
    render_id: args.renderId,
  }
  const narrowRow = {
    user_id: args.userId,
    status: 'completed',
    video_url: args.videoUrl,
    credits_used: args.creditsUsed,
    topic: args.topic,
  }

  const wide = await admin.from('videos').insert(wideRow).select('id').maybeSingle()
  if (!wide.error) {
    console.log(`[compose/status] persisted video id=${wide.data?.id ?? '?'} for user=${args.userId.slice(0, 8)}`)
    return
  }
  const msg = wide.error.message ?? ''
  const isColumnMissing = /column .* does not exist|42703/.test(msg)
  if (!isColumnMissing) {
    console.warn('[compose/status] videos insert (wide) failed:', JSON.stringify({
      message: wide.error.message,
      code: (wide.error as { code?: string }).code,
    }))
    return
  }
  // Retry with the legacy column set.
  const narrow = await admin.from('videos').insert(narrowRow).select('id').maybeSingle()
  if (!narrow.error) {
    console.log(`[compose/status] persisted video (narrow) id=${narrow.data?.id ?? '?'}`)
    return
  }
  console.warn('[compose/status] videos insert (narrow) also failed:', JSON.stringify({
    message: narrow.error.message,
    code: (narrow.error as { code?: string }).code,
  }))
}

export async function GET(
  req: NextRequest,
  { params }: { params: { renderId: string } }
) {
  try {
    const supabase = createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const renderId = (params.renderId ?? '').trim()
    if (!renderId) {
      return NextResponse.json({ error: 'renderId is required.' }, { status: 400 })
    }

    const qParam = (req.nextUrl.searchParams.get('quality') ?? 'basic_ai').toString()
    const quality: Quality =
      qParam === 'basic' || qParam === 'pro' ? qParam : 'basic_ai'
    const deductedParam = req.nextUrl.searchParams.get('deducted') === '1'

    // Push #050 — topic + duration travel as query params so we can record
    // them in the videos history row on success. Both are optional: the
    // route still works without them, the history row just has nulls.
    const durationParam = Number(req.nextUrl.searchParams.get('duration') ?? '')
    const duration = Number.isFinite(durationParam) && durationParam > 0 ? Math.floor(durationParam) : 30
    const topic = (req.nextUrl.searchParams.get('topic') ?? '').toString().slice(0, 1000)

    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json(
        { error: 'Render service is not configured.' },
        { status: 500 }
      )
    }

    let state
    try {
      state = await pollCreatomateRender(renderId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose/status] poll failed:', msg)
      return NextResponse.json(
        { error: 'Render service unreachable.' },
        { status: 502 }
      )
    }

    if (state.status === 'succeeded' && state.url) {
      let creditsDeducted = false
      let creditsRemaining: number | null = null
      const cost = creditCostFor(quality)

      // Idempotency: the client tells us whether it has already seen a "done"
      // for this render. If so, we skip deduction so refresh / multi-tab polls
      // don't double-charge.
      if (!deductedParam) {
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('video_credits')
          .eq('id', user.id)
          .single()
        if (!fetchError) {
          const current = profile?.video_credits ?? 0
          const next = Math.max(0, current - cost)
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ video_credits: next })
            .eq('id', user.id)
          if (!updateError) {
            creditsDeducted = true
            creditsRemaining = next
          } else {
            console.error('[compose/status] credit deduct error:', updateError.message)
          }
        } else {
          console.error('[compose/status] credit fetch error:', fetchError.message)
        }

        // Push #050 — persist the completed video for Visual History.
        // Only on the first "done" response (deductedParam=false) so a
        // refresh-driven status re-poll doesn't insert duplicates. Errors
        // are swallowed inside the helper — history is non-blocking.
        await persistCompletedVideo({
          userId: user.id,
          renderId,
          videoUrl: state.url,
          quality,
          duration,
          topic,
          creditsUsed: cost,
        })
      }

      return NextResponse.json({
        phase: 'done',
        final_video_url: state.url,
        progress: 100,
        creditsDeducted,
        creditsRemaining,
      })
    }

    if (state.status === 'failed' || state.status === 'cancelled') {
      return NextResponse.json({
        phase: 'failed',
        error: state.error ?? 'Render failed.',
        progress: 0,
      })
    }

    return NextResponse.json({
      phase: 'composing',
      progress: state.progress,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[compose/status] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Status lookup failed. Please retry.' },
      { status: 500 }
    )
  }
}
