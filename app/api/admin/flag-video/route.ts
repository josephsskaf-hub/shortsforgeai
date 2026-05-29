// Push #355 — Admin endpoint to manually flag a video for lifestyle pollution.
// Usage: POST /api/admin/flag-video
// Body: { "render_id": "...", "flagged": true }   (use render_id from Creatomate)
//    OR { "generation_id": "...", "flagged": true } (use the UUID from generate-video-fast)
//
// Allows the channel owner to mark videos they watch and identify as having
// lifestyle-polluted B-roll. This populates broll_metrics.lifestyle_pollution_flagged
// which feeds the lifestyle_pollution_rate column in the broll_quality_by_vertical view.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth check — only signed-in users can flag (add IP/role guard later if needed)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { render_id?: string; generation_id?: string; flagged?: boolean }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const flagged = body.flagged !== false // default true

    // Service-role client so we can bypass RLS on broll_metrics
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service config missing.' }, { status: 500 })
    }
    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let updateQuery = admin
      .from('broll_metrics')
      .update({ lifestyle_pollution_flagged: flagged })

    if (body.render_id) {
      updateQuery = updateQuery.eq('render_id', body.render_id)
    } else if (body.generation_id) {
      updateQuery = updateQuery.eq('generation_id', body.generation_id)
    } else {
      return NextResponse.json(
        { error: 'Provide render_id or generation_id.' },
        { status: 400 },
      )
    }

    const { error, count } = await updateQuery.select()
    if (error) {
      console.error('[flag-video] update failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const key = body.render_id ? `render_id=${body.render_id}` : `generation_id=${body.generation_id}`
    console.log(`[flag-video] ${key} flagged=${flagged} rows_updated=${count ?? '?'}`)

    return NextResponse.json({ ok: true, flagged, key })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[flag-video] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
