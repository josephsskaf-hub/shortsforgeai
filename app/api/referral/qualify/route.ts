import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ── Referral reward config (easy to change) ──────────────────────────────
// Credits granted to BOTH the referrer and the referred user when the
// referred user qualifies (email confirmed + first video made).
const REFERRAL_REWARD_CREDITS = 30
// Abuse cap: a referrer is only rewarded for this many successful referrals.
// When the cap is reached the referred user STILL gets their bonus; only the
// referrer's reward + count increment are skipped.
const MAX_REFERRALS_PER_USER = 20
// ─────────────────────────────────────────────────────────────────────────

// Service-role client — bypasses RLS for all reads/writes. Same pattern as
// app/api/stripe/webhook/route.ts.
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Called by the REFERRED user (fire-and-forget from the dashboard). Wrapped in
// try/catch end-to-end — this never 500s the user flow; on any error it logs
// and returns { ok: false }.
export async function POST() {
  try {
    // Auth + email-confirmation status both come from the SSR auth client.
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }

    // Guard: the caller's email must be confirmed.
    if (!user.email_confirmed_at) {
      return NextResponse.json({ ok: false, reason: 'email_unconfirmed' })
    }

    const admin = getAdminClient()

    // Load the referred (calling) user's profile.
    const { data: me, error: meErr } = await admin
      .from('profiles')
      .select('id, referred_by, referral_reward_granted, video_credits')
      .eq('id', user.id)
      .single()
    if (meErr || !me) {
      console.error('[referral qualify] profile load error:', meErr?.code, meErr?.message)
      return NextResponse.json({ ok: false, reason: 'no_profile' })
    }

    // Guard: must have been referred.
    if (!me.referred_by) {
      return NextResponse.json({ ok: false, reason: 'not_referred' })
    }
    // Guard: idempotency — reward already paid for this user.
    if (me.referral_reward_granted === true) {
      return NextResponse.json({ ok: false, reason: 'already_granted' })
    }
    // Guard: no self-referral.
    if (me.referred_by === me.id) {
      return NextResponse.json({ ok: false, reason: 'self_referral' })
    }

    // Guard: the caller must have made at least one video.
    const { count: videoCount, error: vErr } = await admin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (vErr) {
      console.error('[referral qualify] video count error:', vErr.code, vErr.message)
      return NextResponse.json({ ok: false, reason: 'video_check_failed' })
    }
    if (!videoCount || videoCount < 1) {
      return NextResponse.json({ ok: false, reason: 'no_video' })
    }

    // Load the referrer.
    const { data: referrer, error: rErr } = await admin
      .from('profiles')
      .select('id, video_credits, referral_count')
      .eq('id', me.referred_by)
      .single()
    if (rErr || !referrer) {
      console.error('[referral qualify] referrer load error:', rErr?.code, rErr?.message)
      return NextResponse.json({ ok: false, reason: 'no_referrer' })
    }
    if (referrer.id === me.id) {
      return NextResponse.json({ ok: false, reason: 'self_referral' })
    }

    // ── Grant the REFERRED user's bonus (idempotent) ──
    // Flip the flag AND add credits in ONE update, conditioned on the flag
    // still being false. The .select() tells us whether THIS request actually
    // flipped it — so a concurrent retry that lost the race gets 0 rows back
    // and bails WITHOUT re-crediting the referrer below.
    const { data: grantedRows, error: grantErr } = await admin
      .from('profiles')
      .update({
        referral_reward_granted: true,
        video_credits: (me.video_credits ?? 0) + REFERRAL_REWARD_CREDITS,
      })
      .eq('id', me.id)
      .eq('referral_reward_granted', false)
      .select('id')
    if (grantErr) {
      console.error('[referral qualify] referred grant error:', grantErr.code, grantErr.message)
      return NextResponse.json({ ok: false, reason: 'grant_failed' })
    }
    if (!grantedRows || grantedRows.length === 0) {
      // A concurrent request already granted this user — do not double-pay.
      return NextResponse.json({ ok: false, reason: 'already_granted' })
    }

    // ── Grant the REFERRER's bonus, respecting the cap ──
    // Cap reached → the referred user keeps their bonus (granted above); we
    // simply skip rewarding/incrementing the referrer.
    const referrerCount = referrer.referral_count ?? 0
    if (referrerCount < MAX_REFERRALS_PER_USER) {
      const { error: refErr } = await admin
        .from('profiles')
        .update({
          video_credits: (referrer.video_credits ?? 0) + REFERRAL_REWARD_CREDITS,
          referral_count: referrerCount + 1,
        })
        .eq('id', referrer.id)
      if (refErr) {
        // The referred user is already credited; log but don't fail the flow.
        console.error('[referral qualify] referrer grant error:', refErr.code, refErr.message)
      } else {
        console.log(
          `[referral qualify] +${REFERRAL_REWARD_CREDITS} to both: referred ${me.id} & referrer ${referrer.id} (count ${referrerCount + 1})`
        )
      }
    } else {
      console.log(
        `[referral qualify] referrer ${referrer.id} at cap (${MAX_REFERRALS_PER_USER}) — referred ${me.id} still rewarded, referrer skipped`
      )
    }

    return NextResponse.json({ ok: true, granted: true })
  } catch (err) {
    console.error('[referral qualify] unexpected:', err)
    return NextResponse.json({ ok: false })
  }
}
