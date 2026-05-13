import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pollCreatomateRender } from '@/lib/compose'

export const maxDuration = 30

type Quality = 'basic' | 'basic_ai' | 'pro'

function creditCostFor(quality: Quality): number {
  // Matches the per-quality cost shown to the user on the Generate screen.
  // The UI display lives in app/(dashboard)/generate/GenerateClient.tsx — keep
  // these two in sync when adjusting prices.
  switch (quality) {
    case 'pro':
      return 2
    case 'basic':
    case 'basic_ai':
    default:
      return 1
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { renderId: string } }
) {
  try {
    const supabase = createClient()
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

      // Idempotency: the client tells us whether it has already seen a "done"
      // for this render. If so, we skip deduction so refresh / multi-tab polls
      // don't double-charge.
      if (!deductedParam) {
        const cost = creditCostFor(quality)
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
