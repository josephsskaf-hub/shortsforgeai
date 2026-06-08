import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Service-role client — bypasses RLS for the cross-row read/write (resolving
// another user's code and stamping the caller's referred_by). Same pattern as
// app/api/stripe/webhook/route.ts.
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    // Auth via the normal SSR client.
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { ref?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const ref = (body.ref ?? '').trim()
    if (!ref) return NextResponse.json({ ok: false })

    const admin = getAdminClient()

    // Already attributed — no-op (first-touch wins, never overwrite).
    const { data: me } = await admin
      .from('profiles')
      .select('id, referred_by')
      .eq('id', user.id)
      .single()
    if (me?.referred_by) {
      return NextResponse.json({ ok: true, already: true })
    }

    // Resolve the code (case-insensitive) → referrer profile. Codes never
    // contain LIKE wildcards, so ilike with the raw value is an exact,
    // case-insensitive match; a malicious wildcard matches many rows and
    // .single() then errors → treated as not-found below.
    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .ilike('referral_code', ref)
      .single()
    if (!referrer) return NextResponse.json({ ok: false })

    // No self-referral.
    if (referrer.id === user.id) return NextResponse.json({ ok: false })

    const { error: updErr } = await admin
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', user.id)
    if (updErr) {
      console.error('[referral attribute] update error:', updErr.code, updErr.message)
      return NextResponse.json({ ok: false })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[referral attribute] unexpected:', err)
    return NextResponse.json({ ok: false })
  }
}
