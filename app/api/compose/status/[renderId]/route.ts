import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { pollCreatomateRender } from '@/lib/compose'
import { persistRenderAssets } from '@/lib/renderAssets'
import { refundRenderCredits } from '@/lib/credits/refund'

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

// KINEO-PRICING-V3C-2026-07-10 — creditCostFor now takes isPaidUser so Fast
// can cost 1 credit for PAYING accounts while staying 0 for free users (the
// KINEO-ZERO-SIGNUP watch-free funnel is untouched).
function creditCostFor(quality: Quality, isPaidUser = false): number {
  // Matches the per-quality cost shown to the user on the Generate screen.
  // The UI display lives in app/(dashboard)/generate/GenerateClient.tsx — keep
  // these two in sync when adjusting prices. Push #084 added 'fast' = 1
  // credit for the Pexels + TTS Fast Mode pipeline. Basic / Basic AI = 15,
  // Pro = 20. Push #315 added 'cinematic_ai' = 3 for fal.ai Wan 2.1.
  switch (quality) {
    case 'fast':
      // KINEO-ZERO-SIGNUP-2026-07-09 — Fast is FREE again (was 1cr since
      // KINEO-FAST-1CR-2026-07-06). InVideo model: render/watch free with
      // watermark, pay $4.90 to download (KINEO-DL-PAYWALL). Fast costs
      // ~$0.02-0.05 to serve — it's the growth engine, not the revenue line.
      // KINEO-PRICING-V3C-2026-07-10 — for PAYING accounts (has_paid=true or
      // any paid plan) Fast now costs 1 credit per video. Free users stay at
      // 0 (watermarked render + download paywall — funnel unchanged). Product
      // rule: a paid user with 0 balance still renders fine — the debit is
      // simply skipped ([fast-credit] skip below); never break a render over
      // 1 credit.
      return isPaidUser ? 1 : 0
    case 'avatar':
      // KINEO-AVATAR-120-2026-07-06 — AI Avatar folded into the UNIVERSAL
      // video_credits system (was the separate avatar_credits add-on @ 1/video).
      // 120 universal credits per avatar video. This value now drives the
      // STANDARD video-credit deduction path (avatar is in the
      // shouldDeductCredits whitelist below), so the old debit_avatar_credit
      // block was removed — there is exactly ONE debit path for avatar.
      // KINEO-AVATAR-220-2026-07-07 — repriced 120→220 (real VEED cost ~$9.60/video).
      // KINEO-REBASE-2026-07-10 — 220 → 110 (2:1 credit rebase; same USD value).
      return 110
    case 'presenter':
      // KINEO-PRESENTER-2026-07-10 — AI Presenter (Kling AI Avatar v2 Standard,
      // $0.0562/s → ~$3.37 per 60s). 70 credits ≈ $11.62 of Creator credit
      // value → ~71% margin (Joseph subiu 60→70 em 10/07). Keep in sync with
      // AVATAR_CREDIT_COST in generate-avatar.
      return 70
    case 'cinematic_ai':
      // KINEO-REBASE-2026-07-10 — 40 → 20 (2:1 rebase). Keep in sync with
      // SEEDANCE_CREDIT_COST in generate-video-cinematic.
      return 20
    case 'cinematic_kling':
      // KINEO-KLING-90-2026-07-06 margin math intact.
      // KINEO-REBASE-2026-07-10 — 90 → 45 (2:1 rebase; same USD value).
      // KINEO-PRICING-V3B-2026-07-10 — 45 → 50 (margin bump). Keep in sync
      // with KLING_CREDIT_COST in generate-video-cinematic.
      return 50
    case 'cinematic_veo':
      // #489/#491 — Veo 3.1 Fast premium. Keep in sync with VEO_CREDIT_COST.
      // KINEO-REBASE-2026-07-10 — 180 → 90.
      return 90
    case 'cinematic_sora':
      // #491 — Sora 2 premium (engine still BLOCKED upstream).
      // KINEO-REBASE-2026-07-10 — 200 → 100.
      return 100
    case 'cinematic_hollywood':
      // KINEO-REBASE-2026-07-10 — Hollywood = 150 créditos: preço FINAL aprovado
      // 10/07. Keep in sync with HOLLYWOOD_CREDIT_COST in generate-video-cinematic.
      return 150
    case 'pro':
      // KINEO-REBASE-2026-07-10 — legacy 20 → 10.
      return 10
    case 'basic':
    case 'basic_ai':
    default:
      // KINEO-REBASE-2026-07-10 — legacy 15 → 8 (ceil of 15/2).
      return 8
  }
}

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

    const qParam = (req.nextUrl.searchParams.get('quality') ?? 'basic_ai').toString()
    // Push #361 — REVENUE-LEAK FIX: 'cinematic_ai' was missing from this
    // whitelist, so every AI Generated render silently collapsed to 'basic_ai'
    // → quality_mode=basic_ai, credits_used=15, and shouldDeductCredits=false
    // (so NOTHING was charged). Accept cinematic_ai here so creditCostFor()=30
    // and the fast||cinematic_ai deduction path both fire correctly.
    // KINEO-HOLLYWOOD-2026-07-09 — cinematic_hollywood accepted (same #361
    // revenue-leak lesson: an unlisted quality silently collapses to basic_ai
    // and charges nothing).
    const quality: Quality =
      qParam === 'fast' || qParam === 'basic' || qParam === 'pro' || qParam === 'cinematic_ai' || qParam === 'cinematic_kling' || qParam === 'cinematic_veo' || qParam === 'cinematic_sora' || qParam === 'cinematic_hollywood' || qParam === 'avatar' || qParam === 'presenter'
        ? (qParam as Quality)
        : 'basic_ai'
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
      let wasFreeAiTrial = false // #384 — true when this render used the free AI trial (0 credits charged)
      // KINEO-PRICING-V3C-2026-07-10 — true when a PAID user's Fast render was
      // delivered without the 1-credit debit (balance < 1). Fail-open by design.
      let fastCreditSkipped = false

      // KINEO-PRICING-V3C-2026-07-10 — Fast costs 1 credit for PAYING accounts
      // only. Resolve paid status server-side from the profile (never trust the
      // client). Mirrors the PAID_PLANS + has_paid rule in /api/compose (the
      // watermark decision) so billing and watermark stay keyed to the same
      // truth. Lookup failure → treated as free (no debit) — fail-open: a DB
      // blip must never charge or block anyone.
      let fastIsPaidUser = false
      if (quality === 'fast' && !deductedParam) {
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
          console.warn('[fast-credit] paid-status lookup failed — treating as free (no debit):',
            e instanceof Error ? e.message : String(e))
        }
      }
      const cost = creditCostFor(quality, fastIsPaidUser)

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
      const shouldDeductCredits = quality === 'cinematic_ai' || quality === 'cinematic_kling' || quality === 'cinematic_veo' || quality === 'cinematic_sora' || quality === 'cinematic_hollywood' || quality === 'avatar' || quality === 'presenter' || (quality === 'fast' && fastIsPaidUser)

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
      if (shouldDeductCredits && !deductedParam) {
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

      // Idempotency: the client tells us whether it has already seen a "done"
      // for this render. If so, we skip deduction so refresh / multi-tab polls
      // don't double-charge. Server-side guard above handles the cross-session
      // case (refresh, mobile browser, multi-tab).
      if (!deductedParam && !serverAlreadyDeducted) {
        if (shouldDeductCredits) {
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('video_credits, free_ai_generate_used')
            .eq('id', user.id)
            .single()
          if (!fetchError) {
            const current = profile?.video_credits ?? 0
            // #384 — FREE AI-GENERATE TRIAL. This succeeded render is the free
            // trial when: AI mode AND the user hasn't used their free AI yet AND
            // they couldn't pay the 30-credit price. In that case we BURN THE
            // FREE QUOTA (flip the flag) and do NOT touch video_credits — the 3
            // Fast credits stay intact. Only happens on SUCCESS, so a failed
            // render never costs the user their free trial.
            const isFreeAiTrial =
              quality === 'cinematic_ai' &&
              profile?.free_ai_generate_used !== true &&
              current < cost
            if (quality === 'fast' && current < cost) {
              // KINEO-PRICING-V3C-2026-07-10 — PRODUCT DECISION: never break a
              // Fast render over 1 credit. A paying user with balance 0 still
              // gets their clean video delivered normally — we just skip the
              // debit (no watermark fallback, no 402). This branch also keeps
              // debit_video_credits from ever being called with an
              // insufficient balance for Fast.
              fastCreditSkipped = true
              creditsDeducted = true // settled — polls/refreshes must not retry
              creditsRemaining = current
              console.log(`[fast-credit] skip — paid user ${user.id.slice(0, 8)} balance ${current} < cost ${cost}; delivering without debit`)
            } else if (isFreeAiTrial) {
              // Conditional flip: only the FIRST render to reach here wins, so
              // two near-simultaneous trials can't both go free.
              const { data: claimed, error: claimErr } = await supabase
                .from('profiles')
                .update({ free_ai_generate_used: true })
                .eq('id', user.id)
                .eq('free_ai_generate_used', false)
                .select('id')
              if (claimErr) {
                console.error('[compose/status] free-trial flag flip error:', claimErr.message)
              }
              if (claimed && claimed.length > 0) {
                // We won the claim: free trial granted, credits untouched.
                creditsDeducted = true
                creditsRemaining = current
                wasFreeAiTrial = true
                console.log(`[compose/status] FREE AI trial consumed for user ${user.id.slice(0, 8)} — credits untouched (${current})`)
              } else {
                // Lost the race (flag already true) → fall back to normal charge.
                // Fix 1 (12/06) — atomic + idempotent via RPC (ledger keyed by
                // render_id), replacing the racy read→compute→write.
                const { data: lostBalance, error: lostErr } = await supabase
                  .rpc('debit_video_credits', { p_render: renderId, p_cost: cost })
                if (!lostErr && typeof lostBalance === 'number') {
                  creditsDeducted = true
                  creditsRemaining = lostBalance
                } else {
                  console.error('[compose/status] credit deduct RPC error (trial race):', lostErr?.message)
                }
              }
            } else {
              // Fix 1 (12/06) — ATOMIC debit via RPC. One ledger row per
              // render_id (PRIMARY KEY) makes the charge idempotent across
              // tabs, refreshes and concurrent polls; the decrement runs
              // inside the DB, so the old under-/double-charge races are gone.
              const { data: newBalance, error: rpcErr } = await supabase
                .rpc('debit_video_credits', { p_render: renderId, p_cost: cost })
              if (!rpcErr && typeof newBalance === 'number') {
                creditsDeducted = true
                creditsRemaining = newBalance
                // Push #430 — a paid AI render also burns the legacy
                // free-AI-trial flag (behavior preserved from the old path).
                if (quality === 'cinematic_ai' && profile?.free_ai_generate_used !== true) {
                  await supabase
                    .from('profiles')
                    .update({ free_ai_generate_used: true })
                    .eq('id', user.id)
                }
              } else {
                console.error('[compose/status] credit deduct RPC error:', rpcErr?.message ?? 'no balance returned')
              }
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
            // #384 — free AI trial charges 0 credits; reflect that in history.
            // KINEO-PRICING-V3C-2026-07-10 — a skipped Fast debit also
            // recorded as 0 (nothing was actually charged).
            creditsUsed: wasFreeAiTrial || fastCreditSkipped ? 0 : cost,
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
      const creditsRefunded = await refundRenderCredits(renderId)
      return NextResponse.json({
        phase: 'failed',
        error:
          (state.error ?? 'Render failed.') +
          (creditsRefunded > 0
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
