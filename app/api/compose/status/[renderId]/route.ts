import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { pollCreatomateRender } from '@/lib/compose'
import { persistRenderAssets } from '@/lib/renderAssets'

// Push #230 — bumped 30→60 to give the post-render asset migration
// (download Creatomate video + thumbnail, re-upload to Supabase Storage)
// headroom on the single "done" poll. Matches /api/generate-video-fast.
export const maxDuration = 60
// Push #050 — this route reads auth cookies and writes to the videos
// table; explicit dynamic so Next never tries to prerender it.
export const dynamic = 'force-dynamic'

type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro' | 'cinematic_ai'

function creditCostFor(quality: Quality): number {
  // Matches the per-quality cost shown to the user on the Generate screen.
  // The UI display lives in app/(dashboard)/generate/GenerateClient.tsx — keep
  // these two in sync when adjusting prices. Push #084 added 'fast' = 1
  // credit for the Pexels + TTS Fast Mode pipeline. Basic / Basic AI = 15,
  // Pro = 20. Push #315 added 'cinematic_ai' = 3 for fal.ai Wan 2.1.
  switch (quality) {
    case 'fast':
      return 1
    case 'cinematic_ai':
      return 3
    case 'pro':
      return 20
    case 'basic':
    case 'basic_ai':
    default:
      return 15
  }
}

// Push #050 — persist the finished video to `videos` so it appears in
// Visual History on the Generate page and on /history. Writes through
// the service-role admin client so RLS doesn't block us.
//
// Push #052 (QA fix A) — the staging `public.videos` table uses the
// columns `title` and `final_video_url`, not `topic` and `video_url`
// like my push #050 migration assumed. Every insert was failing the
// "column does not exist" branch silently. We now try the staging
// schema FIRST and only fall back to the legacy names if the staging
// columns themselves don't exist on a given environment.
//
// Best-effort: every failure path logs but never throws — Visual
// History is a nice-to-have, not part of the user's video delivery,
// so a missing column / missing table must NEVER block returning the
// final_video_url to the client.
async function persistCompletedVideo(args: {
  userId: string
  renderId: string
  videoUrl: string
  snapshotUrl: string | null
  quality: Quality
  duration: number
  topic: string
  creditsUsed: number
}): Promise<{ ok: boolean; id?: string; schema?: 'staging' | 'legacy' | 'minimal'; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[history] persist skipped — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
    return { ok: false, error: 'service-role env missing' }
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Bug fix — the previous version bailed out on any non-column error
  // from the staging insert, which masked schema/constraint mismatches
  // and left the user with no row. We now try three progressively
  // smaller row shapes; the first one that succeeds wins.

  // Schema #1 — staging (title + final_video_url + extended columns).
  const stagingRow = {
    user_id: args.userId,
    title: args.topic.slice(0, 200) || 'Untitled Short',
    final_video_url: args.videoUrl,
    thumbnail_url: args.snapshotUrl ?? null,
    status: 'completed',
    duration: args.duration,
    quality: args.quality,
    platform: 'YouTube Shorts',
    render_id: args.renderId,
  }

  console.log('[history] insert attempt (staging schema):', JSON.stringify({
    table: 'videos',
    user_id_prefix: args.userId.slice(0, 8),
    render_id: args.renderId,
    final_video_url_host: safeUrlHost(args.videoUrl),
    duration: args.duration,
    quality: args.quality,
  }))

  const stagingInsert = await admin
    .from('videos')
    .insert(stagingRow)
    .select('id')
    .maybeSingle()

  if (!stagingInsert.error) {
    const id = stagingInsert.data?.id ?? '?'
    console.log(`[history] insert OK (staging schema) id=${id}`)
    return { ok: true, id: String(id), schema: 'staging' }
  }

  console.warn('[history] insert (staging schema) failed:', JSON.stringify({
    message: stagingInsert.error.message,
    code: (stagingInsert.error as { code?: string }).code,
    details: (stagingInsert.error as { details?: string }).details,
    hint: (stagingInsert.error as { hint?: string }).hint,
  }))

  // Schema #2 — legacy (video_url + topic + credits_used + extras from
  // migration 004). Try unconditionally now: even non-column errors
  // (NOT NULL, CHECK constraints unique to the staging shape) should
  // not stop us from attempting the legacy row.
  const legacyRow = {
    user_id: args.userId,
    status: 'completed',
    video_url: args.videoUrl,
    thumbnail_url: args.snapshotUrl ?? null,
    credits_used: args.creditsUsed,
    topic: args.topic,
    duration: args.duration,
    quality: args.quality,
    render_id: args.renderId,
  }
  console.log('[history] retrying with legacy schema (topic/video_url)…')
  const legacyInsert = await admin
    .from('videos')
    .insert(legacyRow)
    .select('id')
    .maybeSingle()
  if (!legacyInsert.error) {
    const id = legacyInsert.data?.id ?? '?'
    console.log(`[history] insert OK (legacy schema) id=${id}`)
    return { ok: true, id: String(id), schema: 'legacy' }
  }
  console.warn('[history] insert (legacy schema) failed:', JSON.stringify({
    message: legacyInsert.error.message,
    code: (legacyInsert.error as { code?: string }).code,
    details: (legacyInsert.error as { details?: string }).details,
  }))

  // Schema #3 — minimal. Only columns guaranteed by migration 004
  // baseline. Last-resort attempt so the row always lands in My Videos.
  const minimalRow = {
    user_id: args.userId,
    status: 'completed',
    video_url: args.videoUrl,
    topic: args.topic.slice(0, 500) || 'Untitled Short',
  }
  console.log('[history] retrying with minimal schema (user_id/status/video_url/topic)…')
  const minimalInsert = await admin
    .from('videos')
    .insert(minimalRow)
    .select('id')
    .maybeSingle()
  if (!minimalInsert.error) {
    const id = minimalInsert.data?.id ?? '?'
    console.log(`[history] insert OK (minimal schema) id=${id}`)
    return { ok: true, id: String(id), schema: 'minimal' }
  }
  console.warn('[history] insert (minimal schema) also failed:', JSON.stringify({
    message: minimalInsert.error.message,
    code: (minimalInsert.error as { code?: string }).code,
    details: (minimalInsert.error as { details?: string }).details,
  }))
  return { ok: false, error: minimalInsert.error.message }
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
    const quality: Quality =
      qParam === 'fast' || qParam === 'basic' || qParam === 'pro' ? qParam : 'basic_ai'
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
      const cost = creditCostFor(quality)

      // Push #230 — URL returned to the client. Defaults to the Creatomate
      // output; upgraded to the permanent Supabase URL after the asset
      // migration runs on the first "done" poll.
      let responseVideoUrl = state.url

      // Push #088 — Cinematic renders (any non-'fast' quality) no longer
      // deduct from `video_credits`. They were already paid for by a
      // cinematic_token consumed upstream in /api/generate-video. Only
      // Fast Mode still draws from the regular credit pool.
      // Push #315 — cinematic_ai also deducts from video_credits (3 credits).
      const shouldDeductCredits = quality === 'fast' || quality === 'cinematic_ai'

      // Server-side idempotency guard (push #fix-double-deduction):
      // Check whether this render_id has already been persisted in `videos`.
      // The client-side `deducted=1` param only works within a single browser
      // session — a page refresh, mobile browser, or second tab resets the
      // client ref to false, causing a second deduction for the same render.
      // By checking the DB here we prevent double-charging regardless of
      // how many sessions are polling this render concurrently.
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
        } else {
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
          const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ShortsForgeAI <hello@shortsforgeai.com>'
          if (RESEND_API_KEY && user.email) {
            const safeTopic = (topic || 'your topic').replace(/[<>]/g, '')
            const safeVideoUrl = finalVideoUrl.replace(/"/g, '')
            const html = `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a1a;color:#fff;padding:32px;border-radius:16px;">
                <h1 style="color:#34d399;font-size:24px;margin:0 0 8px">Your Short is ready! ⚡</h1>
                <p style="color:#94a3b8;margin:0 0 24px">Your AI-generated YouTube Short about "<strong style="color:#fff">${safeTopic}</strong>" is ready to download.</p>
                <a href="${safeVideoUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#22D3EE);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
                  ⬇ Download Your Short
                </a>
                <p style="color:#64748b;font-size:12px;margin:24px 0 0">Want to make 50 more Shorts/month? <a href="https://shortsforgeai.com/pricing" style="color:#34d399;">Upgrade to Basic — $9.90/mo →</a></p>
                <p style="color:#475569;font-size:11px;margin:16px 0 0">ShortsForgeAI · <a href="https://shortsforgeai.com" style="color:#475569;">shortsforgeai.com</a></p>
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
      }

      return NextResponse.json({
        phase: 'done',
        final_video_url: responseVideoUrl,
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
