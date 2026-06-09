// #479 — Finalize affiliate attribution at signup (first-touch).
// Reads the sf_aff cookie set by /a/[code], resolves the affiliate, blocks
// self-referral, and records the referral ONCE (referred_user_id is unique →
// first-touch is permanent). Stamps profiles.affiliate_id for O(1) webhook
// lookup. Fire-and-forget from AffiliateAutoTrigger; never 500s the user flow.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COOKIE = 'sf_aff'

export async function POST() {
  try {
    const code = cookies().get(COOKIE)?.value?.trim().toUpperCase()
    if (!code) return NextResponse.json({ ok: false, reason: 'no_cookie' })

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // First-touch is permanent: if this user is already attributed, stop.
    const { data: existing } = await admin
      .from('affiliate_referrals')
      .select('id')
      .eq('referred_user_id', user.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: false, reason: 'already_attributed' })

    const { data: aff } = await admin
      .from('affiliates')
      .select('id, user_id')
      .eq('code', code)
      .single()
    if (!aff) return NextResponse.json({ ok: false, reason: 'unknown_code' })

    // No self-referral.
    if (aff.user_id && aff.user_id === user.id) {
      return NextResponse.json({ ok: false, reason: 'self_referral' })
    }

    // Idempotent insert — the unique(referred_user_id) constraint wins any race.
    const { error: insErr } = await admin.from('affiliate_referrals').insert({
      affiliate_id: aff.id,
      referred_user_id: user.id,
      email: user.email ?? null,
      status: 'signup',
    })
    if (insErr && insErr.code !== '23505') {
      console.error('[affiliate attribute] insert error:', insErr.code, insErr.message)
      return NextResponse.json({ ok: false, reason: 'insert_failed' })
    }

    // Stamp the profile so the Stripe webhook can find the affiliate in O(1).
    await admin.from('profiles').update({ affiliate_id: aff.id }).eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[affiliate attribute] unexpected:', err)
    return NextResponse.json({ ok: false })
  }
}
