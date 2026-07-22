// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 2;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OFFER_290_ENABLED } from '@/lib/flags'

// KINEO-ZERO-SIGNUP-2026-07-09 — new signups start at 0 credits (InVideo
// model): Fast renders are free to generate/watch (watermarked) and the money
// moment is the $4.90 download unlock. Was 2 (Push #299). The DB trigger
// handle_new_user + the profiles.video_credits column default were updated to
// 0 in the same change — this constant is only the missing-column fallback.
const DEFAULT_CREDITS = 0

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // KINEO-ADMIN-GEO-2026-07-06 — record where this user connects from (IP +
    // country) so the admin Users page can show it. Fire-and-forget; never blocks
    // or fails the credits response. Vercel provides these headers per request.
    try {
      const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '').trim() || null
      const country = req.headers.get('x-vercel-ip-country') || null
      if (ip || country) {
        void supabase.from('profiles').update({ last_ip: ip, last_country: country }).eq('id', user.id)
      }
    } catch { /* non-blocking */ }

    const { data, error } = await supabase
      .from('profiles')
      .select('video_credits, plan')
      .eq('id', user.id)
      .single()

    // feature/ai-avatar CP2 — avatar_credits queried SEPARATELY and best-effort,
    // so the main balance never breaks if this code reaches an environment
    // where the avatar_credits migration hasn't run yet (deploy-order safety).
    let avatarCredits = 0
    let avatarFaceUrl: string | null = null
    // KINEO-WM-CHECKOUT-2026-07-07 — surface has_paid so the generator can hide the
    // "remove watermark" post-render CTA for pack/plan buyers (they stay on the
    // 'free' plan but get clean Fast output). Read best-effort alongside the avatar
    // add-on so a missing column on a stale env never breaks the balance response.
    let hasPaid = false
    // Auto-start and other entitlement-sensitive clients may only trust the
    // paid/free verdict when this secondary query completed successfully.
    // A transient/RLS/schema failure must never turn a pack buyer into "free".
    let entitlementsResolved = false
    // KINEO-OFFER290-2026-07-07 — surface offer290_used so the first-purchase
    // banner can enforce its 1-per-account gate on the client. Best-effort:
    // defaults false if the column isn't deployed yet.
    let offer290Used = false
    {
      const { data: avData, error: avErr } = await supabase
        .from('profiles')
        .select('avatar_credits, avatar_face_url, has_paid, offer290_used')
        .eq('id', user.id)
        .single()
      if (avErr) {
        // Fix 1 (12/06) — distinguish "migration not deployed yet" (undefined
        // column/table → safe to default to 0) from a REAL transient error.
        // The old catch-all silently told paying users they had 0 avatar
        // credits on any DB/RLS blip. A real error now returns 503 so the
        // client retries instead of rendering a false zero balance.
        // BUGFIX 05/07 (KINEO-CREDITS-503) — a blip on the SECONDARY avatar_credits
        // balance must NEVER 503 the whole endpoint. Returning no `credits` made the
        // generator show a false "out of credits" to users with a real video_credits
        // balance (the modal-with-504-credits bug). Degrade gracefully: keep the main
        // balance, default the avatar add-on to 0.
        console.error('[credits] avatar_credits fetch failed (degrading avatar to 0):', avErr.message)
      } else {
        entitlementsResolved = true
        avatarCredits = (avData as { avatar_credits?: number } | null)?.avatar_credits ?? 0
        // Face-app wave 1 — saved face for the "Use my saved face" one-click flow.
        const face = (avData as { avatar_face_url?: string | null } | null)?.avatar_face_url
        avatarFaceUrl = typeof face === 'string' && face ? face : null
        // KINEO-WM-CHECKOUT-2026-07-07 — paid flag (pack or plan). Defaults false.
        hasPaid = (avData as { has_paid?: boolean } | null)?.has_paid === true
        // KINEO-OFFER290-2026-07-07 — one-time offer already claimed?
        offer290Used = (avData as { offer290_used?: boolean } | null)?.offer290_used === true
      }
    }

    // KINEO-OFFER290-2026-07-07 — timestamp of the user's FIRST video (min
    // created_at). The first-purchase banner shows a 24h countdown from this
    // moment. Only computed when the offer flag is ON (avoids an extra query
    // otherwise). Best-effort — a failure just leaves first_video_at null and
    // the banner hides.
    let firstVideoAt: string | null = null
    if (OFFER_290_ENABLED) {
      const { data: firstVid } = await supabase
        .from('videos')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      firstVideoAt = (firstVid as { created_at?: string } | null)?.created_at ?? null
    }

    if (error) {
      // Column may not exist yet — return default safely
      if (error.code === '42703' || error.message?.includes('video_credits')) {
        return NextResponse.json({ credits: DEFAULT_CREDITS, migrationNeeded: true })
      }
      // No row found (new user before profiles row exists) — 0 credits until paid.
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          credits: 0,
          entitlementsResolved: true,
          hasPaid: false,
          plan: 'free',
          isStarter: false,
          isCreator: false,
          isStudio: false,
        })
      }
      // Don't fall back to DEFAULT_CREDITS on an unknown error — that would hide a
      // real DB failure and let users start a generation they can't actually pay for.
      console.error('[credits GET] db error:', error.code, error.message)
      return NextResponse.json(
        { error: 'Could not load your credit balance. Please retry.' },
        { status: 500 }
      )
    }

    const credits = data?.video_credits ?? DEFAULT_CREDITS
    // Keep the retired flag true for compatibility with older cached clients:
    // premium AI no longer has a free trial, so they must never unlock it.
    // #404 — surface the plan + per-engine flags so the generator can show the
    // right engine card unlocked: Starter→Fast, Creator→Seedance, Studio→Kling.
    const planVal = (data?.plan ?? 'free') as string
    const isStarter = planVal === 'starter' || planVal === 'starter_trial'
    const isCreator = planVal === 'basic' || planVal === 'basic_trial'
    const isStudio = planVal === 'pro' || planVal === 'pro_trial'
    return NextResponse.json({
      credits,
      // feature/ai-avatar CP2 — separate premium add-on balance.
      avatarCredits,
      // Face-app wave 1 — last approved face photo (avatar library).
      avatarFaceUrl,
      freeAiUsed: true,
      // KINEO-WM-CHECKOUT-2026-07-07 — true once the user has paid (pack or plan);
      // drives hiding the post-render "remove watermark" upsell.
      hasPaid,
      entitlementsResolved,
      // KINEO-OFFER290-2026-07-07 — first-purchase urgency offer inputs. The
      // <Offer290Banner/> uses offer290Enabled + firstVideoAt + hasPaid +
      // offer290Used to decide whether to show (and to run the 24h countdown).
      offer290Enabled: OFFER_290_ENABLED,
      offer290Used,
      firstVideoAt,
      plan: planVal,
      isStarter,
      isCreator,
      isStudio,
    })
  } catch (err) {
    console.error('[credits GET] unexpected:', err)
    return NextResponse.json({ credits: 0, error: 'Failed to load credits' }, { status: 500 })
  }
}
