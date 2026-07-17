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
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
      return NextResponse.json({ ok: false, reason: 'invalid_code' })
    }

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

    // First-touch is permanent. If the referral row exists but a previous
    // request failed before stamping profiles.affiliate_id, repair the profile
    // instead of leaving commissions permanently disconnected.
    const { data: existing, error: existingError } = await admin
      .from('affiliate_referrals')
      .select('id, affiliate_id')
      .eq('referred_user_id', user.id)
      .maybeSingle()
    if (existingError) {
      console.error('[affiliate attribute] existing lookup error:', existingError.code, existingError.message)
      return NextResponse.json({ ok: false, reason: 'lookup_failed' })
    }

    const stampProfile = async (affiliateId: string): Promise<boolean> => {
      const { data: stamped, error } = await admin
        .from('profiles')
        .update({ affiliate_id: affiliateId })
        .eq('id', user.id)
        .select('id, affiliate_id')
        .maybeSingle()
      if (error) {
        console.error('[affiliate attribute] profile stamp error:', error.code, error.message)
        return false
      }
      return stamped?.id === user.id && stamped?.affiliate_id === affiliateId
    }

    if (existing?.affiliate_id) {
      const repaired = await stampProfile(existing.affiliate_id)
      return repaired
        ? NextResponse.json({ ok: true, already: true })
        : NextResponse.json({ ok: false, reason: 'profile_stamp_failed' })
    }

    const { data: aff } = await admin
      .from('affiliates')
      .select('id, user_id, status')
      .eq('code', code)
      .maybeSingle()
    if (!aff) return NextResponse.json({ ok: false, reason: 'unknown_code' })
    if (aff.status !== 'active') return NextResponse.json({ ok: false, reason: 'inactive_affiliate' })

    // No self-referral.
    if (aff.user_id && aff.user_id === user.id) {
      return NextResponse.json({ ok: false, reason: 'self_referral' })
    }

    // Idempotent insert — the unique(referred_user_id) constraint wins any race.
    const { data: inserted, error: insErr } = await admin
      .from('affiliate_referrals')
      .insert({
        affiliate_id: aff.id,
        referred_user_id: user.id,
        email: user.email ?? null,
        status: 'signup',
      })
      .select('id, affiliate_id')
      .maybeSingle()
    if (insErr && insErr.code !== '23505') {
      console.error('[affiliate attribute] insert error:', insErr.code, insErr.message)
      return NextResponse.json({ ok: false, reason: 'insert_failed' })
    }

    // A concurrent request can win the unique(referred_user_id) race. Re-read
    // the canonical row and stamp THAT affiliate, never the losing request's
    // code, so first-touch remains deterministic.
    let canonicalAffiliateId = inserted?.affiliate_id as string | undefined
    if (!canonicalAffiliateId) {
      const { data: canonical, error: canonicalError } = await admin
        .from('affiliate_referrals')
        .select('affiliate_id')
        .eq('referred_user_id', user.id)
        .maybeSingle()
      if (canonicalError || !canonical?.affiliate_id) {
        if (canonicalError) {
          console.error('[affiliate attribute] race reconciliation error:', canonicalError.code, canonicalError.message)
        }
        return NextResponse.json({ ok: false, reason: 'reconciliation_failed' })
      }
      canonicalAffiliateId = canonical.affiliate_id
    }

    if (!canonicalAffiliateId) {
      return NextResponse.json({ ok: false, reason: 'reconciliation_failed' })
    }
    const stamped = await stampProfile(canonicalAffiliateId)
    if (!stamped) return NextResponse.json({ ok: false, reason: 'profile_stamp_failed' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[affiliate attribute] unexpected:', err)
    return NextResponse.json({ ok: false })
  }
}
