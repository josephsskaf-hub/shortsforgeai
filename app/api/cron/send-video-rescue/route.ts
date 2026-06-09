import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// send-video-rescue — #477
//
// The warmest leak in the funnel: users who CREATED a video (felt the "wow")
// but never paid. From the 30-day funnel ~76 activate and only ~5 pay — that's
// ~71 people who proved intent and walked. This cron emails them once, a day
// after their last Short, with the founding 50%-off offer AND the $4.90 Starter
// Pack (low-commitment) so the hardest step (first payment) is easy to take.
//
// Guard rails:
//   - max 1 rescue email per user, ever (profiles.video_rescue_sent_at)
//   - must have >=1 video AND latest video >= 24h ago (don't email mid-session)
//   - skips paid plans and founder/test accounts
//   - skips users in checkout_abandoned (they're owned by send-recovery, so we
//     never double-email the same person)
//   - caps sends per run so the historical backlog drips out over a day or two

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
// Joseph's rule: lead-nurture goes out as the TEAM from hello@ (support@ = support only).
const FROM_EMAIL = 'ShortsForgeAI Team <hello@shortsforgeai.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shortsforgeai.com'
const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial'])
const MAX_PER_RUN = 60
const DAY_MS = 24 * 60 * 60 * 1000

function isTestEmail(email: string): boolean {
  const e = email.toLowerCase()
  return (
    e.startsWith('josephsskaf') ||
    e.startsWith('josephskaf') ||
    e.endsWith('@shortsforgeai.com') ||
    e.startsWith('test') ||
    e.includes('mailinator') ||
    e.startsWith('smoketest')
  )
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

function buildEmail() {
  const upgradeUrl = `${APP_URL}/pricing?promo=FOUNDING50`
  const packUrl = `${APP_URL}/api/stripe/checkout?pack=starter`
  const makeUrl = `${APP_URL}/generate`
  const text = `Hey,

This is the ShortsForgeAI team.

You already did the hard part — you generated a real Short with AI: script, voiceover, captions and footage, all automatic. Nice work.

If you want to keep posting without the hassle, two easy ways to keep going:

- Founding offer: 50% off your first month. Cancel anytime, 7-day money-back: ${upgradeUrl}
- Not ready for a subscription? Grab 10 more Shorts for $4.90, one-time (no plan): ${packUrl}

Or just make another one right now: ${makeUrl}

If something got in the way — price, an idea that didn't land, anything — just reply. A real person reads every message.

ShortsForgeAI Team
shortsforgeai.com`

  const html = text
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? '<br/>'
        : `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.55;">${line.replace(
            /(https?:\/\/[^\s]+)/g,
            (m) => `<a href="${m}" style="color:#2563EB;font-weight:bold;">${m}</a>`
          )}</p>`
    )
    .join('')

  return { text, html }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!RESEND_API_KEY) {
    console.error('[send-video-rescue] RESEND_API_KEY not set')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase service env missing' }, { status: 500 })
  }
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Un-rescued profiles (dedupe via video_rescue_sent_at).
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, plan, is_pro, video_rescue_sent_at')
    .is('video_rescue_sent_at', null)
    .limit(5000)
  if (error) {
    console.error('[send-video-rescue] profiles query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2) Latest video per user.
  const latestVideoByUser = new Map<string, number>()
  {
    const { data: vids } = await admin.from('videos').select('user_id, created_at').limit(10000)
    for (const v of (vids ?? []) as Array<{ user_id?: string | null; created_at?: string | null }>) {
      if (!v.user_id) continue
      const t = v.created_at ? new Date(v.created_at).getTime() : 0
      const prev = latestVideoByUser.get(v.user_id) ?? 0
      if (t > prev) latestVideoByUser.set(v.user_id, t)
    }
  }

  // 3) Users already in the abandoned-checkout recovery flow — exclude.
  const abandonedUsers = new Set<string>()
  {
    const { data: ab } = await admin.from('checkout_abandoned').select('user_id').limit(10000)
    for (const a of (ab ?? []) as Array<{ user_id?: string | null }>) {
      if (a.user_id) abandonedUsers.add(a.user_id)
    }
  }

  const now = Date.now()
  let sent = 0
  let skipped = 0

  for (const u of profiles ?? []) {
    if (sent >= MAX_PER_RUN) break
    const email = u.email?.trim()
    const plan = (u.plan ?? 'free').toLowerCase()
    const paid = PAID_PLANS.has(plan) || u.is_pro === true

    // Invalid / test / already paid → mark so we never reconsider.
    if (!email || isTestEmail(email) || paid) {
      skipped++
      await admin.from('profiles').update({ video_rescue_sent_at: new Date().toISOString() }).eq('id', u.id)
      continue
    }

    const latest = latestVideoByUser.get(u.id) ?? 0
    // No video yet → not activated; leave for later (do NOT mark).
    if (latest === 0) { skipped++; continue }
    // Made a video too recently → email a day later (do NOT mark).
    if (now - latest < DAY_MS) { skipped++; continue }
    // In the abandoned-checkout flow → send-recovery owns them (do NOT mark).
    if (abandonedUsers.has(u.id)) { skipped++; continue }

    const { text, html } = buildEmail()
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          reply_to: 'hello@shortsforgeai.com',
          subject: 'You made a Short 🎬 — here’s 50% off to make more',
          text,
          html,
        }),
      })
      if (res.ok) {
        sent++
        await admin.from('profiles').update({ video_rescue_sent_at: new Date().toISOString() }).eq('id', u.id)
        console.log(`[send-video-rescue] sent to ${email}`)
      } else {
        console.error(`[send-video-rescue] resend failed for ${email}:`, await res.text())
        // not marked — retried next run
      }
    } catch (err) {
      console.error(`[send-video-rescue] error for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, skipped, total: (profiles ?? []).length })
}
