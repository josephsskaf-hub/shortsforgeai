import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { finalizeGeneration } from '@/lib/generations'

export const maxDuration = 10

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const generationId = typeof body?.generation_id === 'string' ? body.generation_id : null
    if (!generationId) {
      return NextResponse.json({ error: 'generation_id is required.' }, { status: 400 })
    }

    const { data: row } = await supabase
      .from('videos')
      .select('id,user_id,status')
      .eq('id', generationId)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
    }
    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    if (row.status !== 'processing') {
      // Already terminal — treat as success so the UI clears its banner.
      return NextResponse.json({ ok: true, status: row.status })
    }

    const moved = await finalizeGeneration(supabase, generationId, 'cancelled', {
      credits_used: 0,
    })
    if (moved) {
      console.log(`[generate-video/cancel] cancelled generation ${generationId} for user ${user.id}`)
    }

    return NextResponse.json({ ok: true, status: 'cancelled' })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video/cancel] unexpected error:', msg)
    return NextResponse.json({ error: 'Cancel failed.' }, { status: 500 })
  }
}
