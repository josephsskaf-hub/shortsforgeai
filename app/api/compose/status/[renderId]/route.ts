import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { pollCreatomateRender } from '@/lib/compose'
import { persistRenderAssets } from '@/lib/renderAssets'
import { refundRenderCredits } from '@/lib/credits/refund'
// KINEO-CREDIT-INTENT-2026-07-11 — the billing decision now reads the engine
// (and price) from the server-side render_jobs intent row, NEVER from the
// client's ?quality / ?deducted query params. creditCostFor is the single
// shared price table (was a local copy here).
import { creditCostFor, normalizeQuality } from '@/lib/credits/engineCost'
import { releaseFailedFreeFastClaim, settleComposeCreditHoldForRender } from '@/lib/credits/composeHold'
import { getRenderIntent } from '@/lib/credits/renderIntent'
import {
  loadPrepaidAvatarClaimForRender,
  settleAvatarCreditHoldForRender,
  type VerifiedAvatarBirthClaim,
} from '@/lib/avatar/reservation'
import {
  loadSettledCinematicClaimForRender,
  type CinematicClaim,
} from '@/lib/cinematic/claim'

// Push #230 — bumped 30→60 to give the post-render asset migration
// (download Creatomate video + thumbnail, re-upload to Supabase Storage)
// headroom on the single "done" poll. Matches /api/generate-video-fast.
export const maxDuration = 60
// Push #050 — this route reads auth cookies and writes to the videos
// table; explicit dynamic so Next never tries to prerender it.
export const dynamic = 'force-dynamic'

// feature/ai-avatar — 'avatar' added.
// KINEO-AVATAR-120-2026-07-06 — avatar is now billed like every other engine:
// 120 UNIVERSAL video_credits, deducted on SUCCESS only through the standard
// debit_video_credits path (avatar is in the shouldDeductCredits whitelist).
// The old separate avatar_credits / debit_avatar_credit billing was retired.
// Protection rule intact: a failed render never charges (debit is success-only,
// idempotent by render_id).
// KINEO-HOLLYWOOD-2026-07-09 — 'cinematic_hollywood' added (260 cr, provisional).
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro' | 'cinematic_ai' | 'cinematic_kling' | 'cinematic_veo' | 'cinematic_sora' | 'cinematic_hollywood' | 'avatar' | 'presenter'

// KINEO-CREDIT-INTENT-2026-07-11 — creditCostFor moved to
// lib/credits/engineCost.ts so the render-BIRTH route (/api/compose) and this
// render-SETTLE route price every engine from the SAME table (no drift). The
// isPaidUser arg still lets Fast cost 1 credit for paying accounts / 0 for free.

// Push #050 — persist the finished video to `videos` so it appears in
// Visual History on the Generate page and on /history. Writes through
// the service-role admin client so RLS doesn't block us.
//
// Push #357 — rewritten as a SINGLE canonical INSERT against the real
// production schema (was a staging/legacy/minimal fallback chain that masked
// the `video_url`/`quality_mode` vs `final_video_url`/`quality` mismatch and
// silently dropped render_id, leaving the anti-duplicate index inactive).
//
// Still best-effort: a failure logs (console.error) but never throws — Visual
// History must never block returning the video URL to the client. The one
// hard guarantee now is that a SUCCESS row always carries render_id.
async function persistCompletedVideo(args: {
  userId: string
  renderId: string
  videoUrl: string
  snapshotUrl: string | null
  quality: Quality
  duration: number
  topic: string
  creditsUsed: number
}): Promise<{ ok: boolean; id?: string; error?: string; duplicate?: boolean }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[history] persist skipped — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'service-role env missing' }
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Push #357 — SINGLE canonical INSERT against the real production `videos`
  // schema. The old staging/legacy/minimal fallback chain masked the schema
  // mismatch (prod has `video_url`/`quality_mode`, not `final_video_url`/
  // `quality`) and silently fell through to a minimal row that DROPPED
  // render_id — which left videos_render_id_unique inactive (NULL render_id is
  // excluded by the partial index) and let duplicates back in. We now write
  // render_id ALWAYS, plus every other relevant column, in one shot.
  //
  // Real prod columns: user_id, title, video_url, thumbnail_url, platform,
  // duration, quality_mode, credits_used, niche, topic, script, hashtags,
  // youtube_description, status, render_id.

  // Derive a short, human-readable title from the topic/script: first
  // non-empty line, with any [Pexels: ...] / bracketed directives stripped.
  const derivedTitle =
    (args.topic.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? args.topic)
      .replace(/\[[^\]]*\]/g, '')
      .trim()
      .slice(0, 120) || null

  const row = {
    user_id: args.userId,
    status: 'completed',
    video_url: args.videoUrl,
    thumbnail_url: args.snapshotUrl ?? null,
    render_id: args.renderId, // never null for a success row → keeps unique index ACTIVE
    topic: args.topic,
    title: derivedTitle,
    platform: 'YouTube Shorts',
    duration: args.duration,
    quality_mode: args.quality,
    credits_used: args.creditsUsed,
  }

  console.log('[history] insert (canonical schema #357):', JSON.stringify({
    user_id_prefix: args.userId.slice(0, 8),
    render_id: args.renderId,
    video_url_host: safeUrlHost(args.videoUrl),
    duration: args.duration,
    quality_mode: args.quality,
    credits_used: args.creditsUsed,
    has_thumbnail: !!args.snapshotUrl,
  }))

  const { data, error } = await admin
    .from('videos')
    .insert(row)
    .select('id')
    .maybeSingle()

  if (!error) {
    const id = data?.id ?? '?'
    console.log(`[history] insert OK id=${id} render_id=${args.renderId}`)
    return { ok: true, id: String(id) }
  }

  // Idempotency: 23505 on videos_render_id_unique means this render was already
  // persisted (refresh / multi-tab / multi-session re-poll). Not a failure —
  // log explicitly for tracing and skip the re-insert.
  if ((error as { code?: string }).code === '23505') {
    console.log(`[history] DUPLICATE render_id=${args.renderId} — already persisted (videos_render_id_unique); skipping re-insert`)
    return { ok: true, duplicate: true }
  }

  // Real failure — never swallow silently. Surface the full PostgREST error.
  console.error('[history] insert FAILED:', JSON.stringify({
    code: (error as { code?: string }).code,
    message: error.message,
    details: (error as { details?: string }).details,
    hint: (error as { hint?: string }).hint,
    render_id: args.renderId,
  }))
  return { ok: false, error: error.message }
}

function safeUrlHost(u: string): string {
  try {
    return new URL(u).host
  } catch {
    return 'invalid-url'
  }
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

    // ── KINEO-CREDIT-INTENT-2026-07-11 — AUTHORITATIVE ENGINE FROM THE SERVER ──
    // The billing decision must NEVER trust the client. /api/compose recorded
    // the real engine + intended cost in render_jobs, keyed by render_id, at
    // render BIRTH. We read it here and it WINS over the ?quality query param.
    // Forging ?quality=fast (to make a 110-credit Avatar settle as a free Fast
    // video) no longer works — the recurrence of "avatar nunca debitava por
    // quality ausente" is closed.
    const resumeRequested = req.nextUrl.searchParams.get('resume') === '1'
    const intent = await getRenderIntent(renderId)
    if (intent === undefined) {
      return NextResponse.json(
        { error: 'Render ownership is temporarily unavailable. Please retry.' },
        { status: 503 },
      )
    }
    // A restored client snapshot is not an authority boundary. Resume is
    // allowed only when the server-side render intent exists and belongs to the
    // authenticated user; missing/mismatched ids fail closed without revealing
    // whether another user's render exists.
    if (intent && intent.userId !== user.id) {
      return NextResponse.json({ error: 'Render not found.' }, { status: 404 })
    }
    if (resumeRequested && !intent) {
      return NextResponse.json({ error: 'No resumable render found.' }, { status: 404 })
    }
    // A provider render id by itself is not authorization. All current render
    // paths publish a signed/server-side intent before returning the id; fail
    // closed for legacy or orphan ids instead of polling and exposing a URL to
    // whichever authenticated user guessed it.
    if (!intent) {
      return NextResponse.json({ error: 'Render not found.' }, { status: 404 })
    }
    const hasServerIntent = !!intent && intent.userId === user.id

    // Legacy fallback (no intent row = a render created before this deploy, or a
    // path that didn't record intent): keep the historical client-param parse.
    const qParam = (req.nextUrl.searchParams.get('quality') ?? 'basic_ai').toString()
    // Push #361 — REVENUE-LEAK FIX: an unlisted quality silently collapses to
    // 'basic_ai' (which charges nothing). normalizeQuality applies that same
    // defensive default to BOTH the intent value and the legacy query param.
    const clientQuality: Quality = normalizeQuality(qParam)
    const quality: Quality = hasServerIntent ? normalizeQuality(intent!.quality) : clientQuality
    const isFreeFastIntent =
      hasServerIntent && quality === 'fast' && intent!.cost === 0
    const isCinematicQuality =
      quality === 'cinematic_ai' || quality === 'cinematic_kling' ||
      quality === 'cinematic_veo' || quality === 'cinematic_sora' ||
      quality === 'cinematic_hollywood'
    let prepaidCinematicClaim: CinematicClaim | null = null
    let prepaidAvatarClaim: VerifiedAvatarBirthClaim | null = null
    let cinematicAdmin: ReturnType<typeof createAdminClient> | null = null
    let cinematicSecret = ''
    if (hasServerIntent && isCinematicQuality) {
      const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      cinematicSecret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      if (!adminUrl || !cinematicSecret) {
        return NextResponse.json(
          { error: 'Cinematic billing verification is temporarily unavailable.' },
          { status: 503 },
        )
      }
      cinematicAdmin = createAdminClient(adminUrl, cinematicSecret, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const prepaid = await loadSettledCinematicClaimForRender({
        db: cinematicAdmin,
        secret: cinematicSecret,
        userId: user.id,
        renderId,
      })
      if (!prepaid.ok) {
        console.error('[compose/status] cinematic billing verification failed:', prepaid.error)
        return NextResponse.json(
          { error: 'Cinematic billing verification is temporarily unavailable.' },
          { status: 503 },
        )
      }
      prepaidCinematicClaim = prepaid.claim
    }
    if (hasServerIntent && (quality === 'avatar' || quality === 'presenter')) {
      const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
      if (!adminUrl || !secret) {
        return NextResponse.json(
          { error: 'Avatar billing verification is temporarily unavailable.' },
          { status: 503 },
        )
      }
      const admin = createAdminClient(adminUrl, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const prepaid = await loadPrepaidAvatarClaimForRender({
        db: admin,
        secret,
        userId: user.id,
        renderId,
      })
      if (!prepaid.ok || !prepaid.claim) {
        console.error('[compose/status] avatar billing verification failed:', prepaid.ok ? 'claim missing' : prepaid.error)
        return NextResponse.json(
          { error: 'Avatar billing verification is temporarily unavailable.' },
          { status: 503 },
        )
      }
      prepaidAvatarClaim = prepaid.claim
    }

    const deductedParam = req.nextUrl.searchParams.get('deducted') === '1'
    // KINEO-CREDIT-INTENT — when we have server-side intent, the client's
    // "deducted=1" claim is IGNORED. Double-charge is still prevented server-side
    // by (a) debit_video_credits idempotency (PK render_id) and (b) the
    // videos-row guard below. The client bypass only survives for legacy
    // (no-intent) renders, where behavior is unchanged.
    const skipClientDeducted = hasServerIntent ? false : deductedParam
    if (hasServerIntent && quality !== clientQuality) {
      console.log(`[compose/status] intent override render=${renderId}: client sent '${clientQuality}', charging as '${quality}'`)
    }

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
      if (prepaidCinematicClaim?.status === 'released') {
        return NextResponse.json({
          phase: 'failed',
          error: 'This cinematic generation was closed and its credits were refunded.',
          creditsRefunded: prepaidCinematicClaim.creditCost,
          progress: 0,
        })
      }
      let creditsDeducted = prepaidCinematicClaim !== null || prepaidAvatarClaim !== null
      let creditsRemaining: number | null = null

      // KINEO-PRICING-V3C-2026-07-10 — Fast costs 1 credit for PAYING accounts
      // only. New renders use their signed server intent; this profile lookup is
      // retained solely for legacy renders that predate intent storage.
      let fastIsPaidUser = false
      if (quality === 'fast' && !skipClientDeducted) {
        try {
          const { data: payerProf } = await supabase
            .from('profiles')
            .select('has_paid, plan')
            .eq('id', user.id)
            .maybeSingle()
          const PAID_PLANS = new Set([
            'starter', 'starter_trial', 'basic', 'basic_trial',
            'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial',
          ])
          const planName = ((payerProf as { plan?: string } | null)?.plan ?? 'free').toLowerCase()
          fastIsPaidUser =
            (payerProf as { has_paid?: boolean } | null)?.has_paid === true ||
            PAID_PLANS.has(planName)
        } catch (e) {
          console.warn('[fast-credit] legacy paid-status lookup failed:',
            e instanceof Error ? e.message : String(e))
        }
      }
      // The render-birth route signed and stored the exact cost. Pin settlement
      // to that value so an upgrade/downgrade while the provider is rendering
      // cannot turn a free Fast preview into a debit (or a paid Fast render into
      // a free one). Legacy renders without a valid intent keep the old lookup.
      const intentCost =
        hasServerIntent && typeof intent!.cost === 'number' &&
        Number.isFinite(intent!.cost) && Number.isInteger(intent!.cost) &&
        intent!.cost >= 0 && intent!.cost <= 1000
          ? intent!.cost
          : null
      const cost = intentCost ?? creditCostFor(quality, fastIsPaidUser)

      // Push #230 — URL returned to the client. Defaults to the Creatomate
      // output; upgraded to the permanent Supabase URL after the asset
      // migration runs on the first "done" poll.
      let responseVideoUrl = state.url

      // Push #088 — Cinematic renders (any non-'fast' quality) no longer
      // deduct from `video_credits`. They were already paid for by a
      // cinematic_token consumed upstream in /api/generate-video. Only
      // Fast Mode still draws from the regular credit pool.
      // Push #315 — cinematic_ai also deducts from video_credits (3 credits).
      // KINEO-AVATAR-120-2026-07-06 — 'avatar' added to the standard
      // video_credits deduction whitelist. Avatar now charges 120 universal
      // credits (creditCostFor('avatar')=120) through the SAME atomic
      // debit_video_credits RPC as the cinematic engines — success-only,
      // idempotent by render_id. The separate avatar_credits debit block was
      // deleted below, so there is exactly one debit path (no double-charge).
      // KINEO-ZERO-SIGNUP-2026-07-09 — 'fast' removed from the whitelist: Fast
      // renders are free (creditCostFor('fast')=0), so there is nothing to debit.
      // KINEO-HOLLYWOOD-2026-07-09 — cinematic_hollywood debits like the other
      // fal engines (success-only, idempotent by render_id; the existing
      // auto-refund on failure covers it too).
      // KINEO-PRICING-V3C-2026-07-10 — 'fast' is back in the whitelist ONLY for
      // paying accounts (fastIsPaidUser). Free Fast stays out (nothing to debit).
      const shouldDeductCredits =
        (!prepaidCinematicClaim && isCinematicQuality) ||
        (!prepaidAvatarClaim && (quality === 'avatar' || quality === 'presenter')) ||
        (quality === 'fast' && (intentCost !== null ? intentCost > 0 : fastIsPaidUser))

      // Server-side idempotency guard (push #fix-double-deduction):
      // Check whether this render_id has already been persisted in `videos`.
      // The client-side `deducted=1` param only works within a single browser
      // session — a page refresh, mobile browser, or second tab resets the
      // client ref to false, causing a second deduction for the same render.
      // By checking the DB here we prevent double-charging regardless of
      // how many sessions are polling this render concurrently.
      // KINEO-AVATAR-120-2026-07-06 — avatar is now inside shouldDeductCredits,
      // so this guard covers it (no separate isAvatarRender term needed).
      let serverAlreadyDeducted = false
      if (shouldDeductCredits && !skipClientDeducted) {
        try {
          // The videos table is readable by the owner via RLS (SELECT policy).
          // We use render_id + user_id to confirm this exact render was already
          // persisted (and therefore already charged) for THIS user.
          const { data: existingRow } = await supabase
            .from('videos')
            .select('id')
            .eq('render_id', renderId)
            .eq('user_id', user.id)
            .maybeSingle()
          if (existingRow) {
            serverAlreadyDeducted = true
            creditsDeducted = true // Tell client this render is settled
            console.log(`[compose/status] render ${renderId} already in videos — skipping credit deduction`)
          }
        } catch (e) {
          // Non-fatal: if the check fails we fall through to the normal path.
          console.warn('[compose/status] idempotency check failed:', e instanceof Error ? e.message : String(e))
        }
      }

      if ((quality === 'avatar' || quality === 'presenter') && serverAlreadyDeducted) {
        const holdSettled = await settleAvatarCreditHoldForRender({
          userId: user.id,
          renderId,
        })
        if (!holdSettled) {
          console.warn(`[avatar-hold] retry could not settle hold for render=${renderId}`)
          return NextResponse.json(
            { phase: 'processing', reconcile: true, error: 'Finalizing your credit settlement. Please retry.', progress: 99 },
            { status: 503 },
          )
        }
      }

      if (serverAlreadyDeducted) {
        const composeHoldSettled = await settleComposeCreditHoldForRender({
          userId: user.id,
          renderId,
          reason: 'debited',
        })
        if (!composeHoldSettled) {
          console.warn(`[compose-hold] retry could not settle hold for render=${renderId}`)
          return NextResponse.json(
            { phase: 'processing', reconcile: true, error: 'Finalizing your credit settlement. Please retry.', progress: 99 },
            { status: 503 },
          )
        }
      }

      // Idempotency: the server guard above (videos row) + debit_video_credits
      // idempotency (PK render_id) prevent double-charging across refresh /
      // multi-tab / multi-session polls. The client's "deducted=1" is honored
      // ONLY as a legacy fallback (no intent row); with intent it is ignored.
      // KINEO-CREDIT-INTENT — deductionAttempted marks that we entered the
      // paid-debit path, so a FAILED premium debit is caught below (clean
      // premium video withheld) without mis-firing on the free / legacy paths.
      let deductionAttempted = false
      if (!skipClientDeducted && !serverAlreadyDeducted) {
        if (shouldDeductCredits) {
          deductionAttempted = true
            const { error: fetchError } = await supabase
              .from('profiles')
              .select('video_credits')
              .eq('id', user.id)
              .single()
            if (!fetchError) {
              // Every clean export settles its full signed intent cost. There is
              // no premium free trial and no zero-balance Fast exception.
              const { data: newBalance, error: rpcErr } = await supabase
                .rpc('debit_video_credits', { p_render: renderId, p_cost: cost })
              if (!rpcErr && typeof newBalance === 'number') {
                creditsDeducted = true
                creditsRemaining = newBalance
              } else {
                console.error('[compose/status] credit deduct RPC error:', rpcErr?.message ?? 'no balance returned')
              }
          } else {
            console.error('[compose/status] credit fetch error:', fetchError.message)
          }
        } else {
          // KINEO-AVATAR-120-2026-07-06 — the dedicated avatar debit block
          // (debit_avatar_credit) was REMOVED here. Avatar now flows through
          // the shouldDeductCredits branch above (120 universal video_credits
          // via debit_video_credits), so this else only handles the legacy
          // cinematic-token engines whose token was consumed at job start.
          // Cinematic — token was consumed at job start. Surface this in
          // the response so the client can still update its "credits left"
          // chip from the regular endpoint without double-decrementing.
          creditsDeducted = true
          creditsRemaining = null
        }

        // ── KINEO-CREDIT-INTENT-2026-07-11 — NEVER hand out a PAID premium
        // render for free. If we ATTEMPTED to charge a premium engine and the
        // debit did NOT settle (RPC error / insufficient balance), STOP here:
        // do not migrate assets, persist Visual History, email, or return a
        // clean final_video_url. The user is told they were NOT charged and can
        // retry (the idempotent RPC self-heals a transient blip on the next
        // poll). This includes paid Fast: a clean export never bypasses its
        // signed one-credit intent.
        if (shouldDeductCredits && deductionAttempted && !creditsDeducted) {
          console.error('[compose/status] PREMIUM-DEBIT-FAILED — refusing to deliver clean premium video (no charge settled):', JSON.stringify({
            render_id: renderId,
            user_id_prefix: user.id.slice(0, 8),
            quality,
            cost,
          }))
          return NextResponse.json({
            phase: 'failed',
            reconcile: true,
            error:
              "We couldn't confirm the credits for this clean video, so it wasn't delivered. " +
              'You have NOT been charged — please check your balance and try again.',
            creditsDeducted: false,
            creditsRemaining,
            progress: 0,
          })
        }

        if (shouldDeductCredits && creditsDeducted) {
          const composeHoldSettled = await settleComposeCreditHoldForRender({
            userId: user.id,
            renderId,
            reason: 'debited',
          })
          if (!composeHoldSettled) {
            console.warn(`[compose-hold] could not settle hold for render=${renderId}`)
            return NextResponse.json(
              { phase: 'processing', reconcile: true, error: 'Finalizing your credit settlement. Please retry.', progress: 99 },
              { status: 503 },
            )
          }
        }

        // Release the signed provider-cost hold immediately after the debit is
        // confirmed, before asset migration, history, email or push work. If a
        // serverless timeout happens later, a retry sees both an idempotent debit
        // and an already-settled hold instead of blocking the buyer for two hours.
        if ((quality === 'avatar' || quality === 'presenter') && creditsDeducted) {
          const holdSettled = await settleAvatarCreditHoldForRender({
            userId: user.id,
            renderId,
          })
          if (!holdSettled) {
            console.warn(`[avatar-hold] could not settle hold for render=${renderId}`)
            return NextResponse.json(
              { phase: 'processing', reconcile: true, error: 'Finalizing your credit settlement. Please retry.', progress: 99 },
              { status: 503 },
            )
          }
        }

        // Push #050 — persist the completed video for Visual History.
        // Only on the first "done" response (deductedParam=false) so a
        // refresh-driven status re-poll doesn't insert duplicates. Errors
        // are swallowed inside the helper — history is non-blocking.
        //
        // Push #052 (QA fix A) — wrap with explicit before/after logs at
        // the call site too, so we can confirm in Vercel logs that the
        // helper is reached AND see its result without having to dig
        // through the internal log lines.
        // Push #230 — copy the Creatomate output + thumbnail into permanent
        // Supabase Storage URLs BEFORE persisting, so the history row never
        // stores a Creatomate CDN URL that later expires. Best-effort and
        // bounded: on any failure persistRenderAssets returns the original
        // Creatomate URLs, so this can never block the user's video.
        let finalVideoUrl = state.url
        let finalThumbUrl = state.snapshotUrl
        try {
          const migrated = await persistRenderAssets({
            userId: user.id,
            renderId,
            videoUrl: state.url,
            snapshotUrl: state.snapshotUrl,
          })
          finalVideoUrl = migrated.videoUrl
          finalThumbUrl = migrated.thumbnailUrl
          responseVideoUrl = migrated.videoUrl
          console.log('[history] asset migration result:', JSON.stringify({
            video_migrated: migrated.videoUrl !== state.url,
            thumb_migrated: !!migrated.thumbnailUrl && migrated.thumbnailUrl !== state.snapshotUrl,
          }))
        } catch (e) {
          console.warn('[history] asset migration threw — keeping Creatomate URLs:',
            e instanceof Error ? e.message : String(e))
        }

        // Push #355 — record render_time_ms in broll_metrics.
        // Best-effort: never blocks the video response.
        try {
          const { data: metricsRow } = await supabase
            .from('broll_metrics')
            .select('submitted_at')
            .eq('render_id', renderId)
            .maybeSingle()
          if (metricsRow?.submitted_at) {
            const renderTimeMs = Date.now() - new Date(metricsRow.submitted_at).getTime()
            await supabase
              .from('broll_metrics')
              .update({ render_time_ms: renderTimeMs })
              .eq('render_id', renderId)
            console.log(`[broll_metrics] render_time_ms=${renderTimeMs} for render_id=${renderId}`)
          }
        } catch (metricsEx) {
          console.warn('[broll_metrics] render_time_ms update failed:', metricsEx instanceof Error ? metricsEx.message : String(metricsEx))
        }

        console.log('[history] attempting persist…', JSON.stringify({
          render_id: renderId,
          user_id_prefix: user.id.slice(0, 8),
          duration,
          quality,
          has_topic: topic.length > 0,
        }))
        try {
          const result = await persistCompletedVideo({
            userId: user.id,
            renderId,
            videoUrl: finalVideoUrl,
            snapshotUrl: finalThumbUrl,
            quality,
            duration,
            topic,
            creditsUsed: cost,
          })
          console.log('[history] persist result:', JSON.stringify(result))
        } catch (e) {
          // persistCompletedVideo is meant to never throw, but if it
          // somehow does we still want to know about it without
          // failing the user response.
          console.error('[history] persist threw unexpectedly:', e instanceof Error
            ? JSON.stringify({ name: e.name, message: e.message, stack: e.stack?.split('\n').slice(0, 3).join(' | ') })
            : String(e))
        }

        // Push #104 — fire-and-forget "your Short is ready" email via
        // Resend. Inlined here (rather than calling /api/notify-video-ready
        // over HTTP) so we don't have to forward auth cookies on a
        // server-to-server hop and so we don't pay a cold-start tax on the
        // user's polling response. Mirrors the env conventions of
        // /api/send-welcome.
        try {
          const RESEND_API_KEY = process.env.RESEND_API_KEY
          const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Kineo <support@usekineo.com>'
          if (RESEND_API_KEY && user.email) {
            const safeTopic = (topic || 'your topic').replace(/[<>]/g, '')
            const safeVideoUrl = finalVideoUrl.replace(/"/g, '')
            const html = `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#161618;color:#fff;padding:32px;border-radius:16px;">
                <h1 style="color:#2997ff;font-size:24px;margin:0 0 8px">Your Short is ready! ⚡</h1>
                <p style="color:#94a3b8;margin:0 0 24px">Your AI-generated YouTube Short about "<strong style="color:#fff">${safeTopic}</strong>" is ready to download.</p>
                <a href="${safeVideoUrl}" style="display:inline-block;background:#2997ff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
                  ⬇ Download Your Short
                </a>
                <p style="color:#64748b;font-size:12px;margin:24px 0 0">Want to make 50 more Shorts/month? <a href="https://usekineo.com/pricing" style="color:#2997ff;">Upgrade to Starter — $9.90/mo →</a></p>
                <p style="color:#475569;font-size:11px;margin:16px 0 0">Kineo · <a href="https://usekineo.com" style="color:#475569;">usekineo.com</a></p>
              </div>
            `
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: [user.email],
                subject: '⚡ Your Short is ready to download!',
                html,
              }),
            })
            if (!emailRes.ok) {
              const errText = await emailRes.text()
              console.warn('[notify-video-ready] resend non-2xx:', emailRes.status, errText.slice(0, 200))
            }
          }
        } catch (emailErr) {
          console.warn('[notify-video-ready] send failed:', emailErr instanceof Error ? emailErr.message : String(emailErr))
        }

        // Push #427 — Web Push "your video is ready" to every device the
        // user opted in on. Payload-less (text lives in public/sw.js).
        // Best-effort: failures never affect the polling response.
        try {
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('endpoint')
            .eq('user_id', user.id)
          if (subs && subs.length > 0) {
            const { sendPushToSubscriptions } = await import('@/lib/push')
            const { sent, gone } = await sendPushToSubscriptions(subs)
            if (gone.length > 0) {
              await supabase.from('push_subscriptions').delete().in('endpoint', gone)
            }
            if (sent > 0) console.log(`[push] video-ready sent to ${sent} device(s)`)
          }
        } catch (pushErr) {
          console.warn('[push] video-ready failed:', pushErr instanceof Error ? pushErr.message : String(pushErr))
        }
      }

      // #465 — look up the saved video's DB id (by render_id) so the client can
      // build the public /v/[id] share link on the done screen. Best-effort.
      let videoId: string | null = null
      try {
        const { data: vid } = await supabase
          .from('videos')
          .select('id')
          .eq('render_id', renderId)
          .maybeSingle()
        videoId = (vid?.id as string) ?? null
      } catch {}

      return NextResponse.json({
        phase: 'done',
        final_video_url: responseVideoUrl,
        video_id: videoId,
        progress: 100,
        creditsDeducted,
        creditsRemaining,
      })
    }

    if (state.status === 'failed' || state.status === 'cancelled') {
      // AUTO-REFUND (TAAFT feedback) — if anything was debited for this render
      // (credit_debits ledger row), give it back. Idempotent + race-safe: the
      // refund_render_credits RPC only claims rows WHERE refunded_at IS NULL,
      // so repeated polls of a failed render can never refund twice. On this
      // pipeline the debit normally only happens on SUCCESS, so this is a
      // safety net for debit-then-fail edge cases (timeouts, races).
      const composeHoldReleased = await settleComposeCreditHoldForRender({
        userId: user.id,
        renderId,
        reason: 'provider_failed',
      })
      if (!composeHoldReleased) {
        return NextResponse.json(
          { phase: 'processing', reconcile: true, error: 'Finalizing the failed render safely. Please retry.', progress: 0 },
          { status: 503 },
        )
      }
      if (isFreeFastIntent) {
        const freeClaimReleased = await releaseFailedFreeFastClaim({ userId: user.id, renderId })
        if (!freeClaimReleased) {
          return NextResponse.json(
            { phase: 'processing', reconcile: true, error: 'Restoring your free preview slot. Please retry.', progress: 0 },
            { status: 503 },
          )
        }
      }
      if (quality === 'avatar' || quality === 'presenter') {
        const avatarHoldReleased = await settleAvatarCreditHoldForRender({
          userId: user.id,
          renderId,
          reason: prepaidAvatarClaim ? 'compose_failed_after_asset_delivered' : 'provider_failed',
        })
        if (!avatarHoldReleased) {
          console.warn(`[avatar-hold] failed compose could not release hold for render=${renderId}`)
          return NextResponse.json(
            { phase: 'processing', reconcile: true, error: 'Finalizing the failed avatar safely. Please retry.', progress: 0 },
            { status: 503 },
          )
        }
      }
      // Cinematic and Avatar birth credits pay for raw Fal assets already
      // delivered to the authenticated owner. A downstream Creatomate failure
      // must not refund those assets; only terminal Fal failure refunds the
      // deterministic birth key in its dedicated status route.
      const prepaidProviderAsset = prepaidCinematicClaim !== null || prepaidAvatarClaim !== null
      const creditsRefunded = prepaidProviderAsset ? 0 : await refundRenderCredits(renderId)
      return NextResponse.json({
        phase: 'failed',
        error:
          (state.error ?? 'Render failed.') +
          (prepaidCinematicClaim
            ? ' Your AI scenes remain paid and protected; no second AI-scene charge is needed to reassemble them.'
            : prepaidAvatarClaim
            ? ' Your completed avatar remains paid and protected; no second avatar charge is needed to reassemble it.'
            : creditsRefunded > 0
            ? ` Your ${creditsRefunded} credits were automatically refunded.`
            : ' You were not charged for this video.'),
        creditsRefunded,
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
