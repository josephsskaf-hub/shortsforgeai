import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// send-activation-nudge — Push #426
//
// D0 activation email. Only 1 in 244 signups ever used the free AI video —
// people sign up, get distracted, and never feel the "wow". This cron runs
// hourly and emails users who signed up 1–6 hours ago and still haven't
// generated ANY video: "your first AI video is free, one click away".
//
// Guard rails: max 1 nudge per user ever (profiles.activation_nudge_sent_at),
// skips test/founder accounts, skips anyone who already generated or paid.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const LIFECYCLE_EMAILS_ENABLED = process.env.KINEO_LIFECYCLE_EMAILS_ENABLED === 'true'
// Push #431 — Joseph's rule: no personal name on outbound. Activation nudge is
// lead-nurture → goes out as the TEAM from hello@ (support@ = support only).
const FROM_EMAIL = 'Kineo Team <hello@usekineo.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.usekineo.com'
const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial'])

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
  // KINEO-ACTIVATION-COPY-2026-07-06 — free plan gives 2 free videos, NOT
  // "30 credits" (stale copy that misled every signup). Short, founder-to-user
  // tone, one CTA to the video creator.
  const url = `${APP_URL}/generate?utm_source=lifecycle&utm_medium=email&utm_campaign=d0_activation`
  const text = `Hey,

It's the team at Kineo. You signed up a little while ago but haven't made your first video yet — so here's a nudge, because the first one is the fun part.

Create, watch, download and share up to 3 watermarked Fast videos every 24 hours with no card. Type any idea ("the Bermuda Triangle mystery", "how Bezos starts his day") and the AI writes the script, adds the voiceover, captions and footage.

Make your first video here: ${url}

Stuck on anything? Just reply to this email — a real person reads every message.

Kineo Team
usekineo.com`

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6;max-width:480px;">
  <p style="margin:0 0 14px;">Hey,</p>
  <p style="margin:0 0 14px;">It's the team at Kineo. You signed up a little while ago but haven't made your first video yet — so here's a nudge, because the first one is the fun part.</p>
  <p style="margin:0 0 14px;">Create, watch, download and share up to <strong>3 watermarked Fast videos every 24 hours</strong> with no card. Type any idea ("the Bermuda Triangle mystery", "how Bezos starts his day") and the AI writes the script, adds the voiceover, captions and footage.</p>
  <p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;background:#2997ff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:10px;">Make my first video →</a></p>
  <p style="margin:0 0 14px;">Stuck on anything? Just reply to this email — a real person reads every message.</p>
  <p style="margin:0 0 2px;">Kineo Team</p>
  <p style="margin:0;"><a href="https://www.usekineo.com" style="color:#2997ff;">usekineo.com</a></p>
</div>`

  return { text, html }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Keep every non-approved segment untouched during the Lote 1 micro-test.
  if (!LIFECYCLE_EMAILS_ENABLED) {
    return NextResponse.json({ paused: true, sent: 0, reason: 'lifecycle_email_gate' })
  }
  if (!RESEND_API_KEY) {
    console.error('[send-activation-nudge] RESEND_API_KEY not set')
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

  // Users created 1–30h ago, never nudged, still on free plan.
  // Window widened from 6h → 30h because Vercel Hobby only allows DAILY
  // crons (more frequent schedules block ALL deployments!). A daily run
  // with a 30h window still reaches every signup exactly once.
  const from = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('profiles')
    .select('id, email, plan, created_at, activation_nudge_sent_at')
    .gte('created_at', from)
    .lte('created_at', to)
    .is('activation_nudge_sent_at', null)

  if (error) {
    console.error('[send-activation-nudge] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const u of candidates ?? []) {
    const email = u.email?.trim()
    const plan = (u.plan ?? 'free').toLowerCase()

    if (!email || isTestEmail(email) || PAID_PLANS.has(plan)) {
      skipped++
      await admin
        .from('profiles')
        .update({ activation_nudge_sent_at: new Date().toISOString() })
        .eq('id', u.id)
      continue
    }

    // Already generated a video? They're activated — no nudge needed.
    const { count } = await admin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id)
    if ((count ?? 0) > 0) {
      skipped++
      await admin
        .from('profiles')
        .update({ activation_nudge_sent_at: new Date().toISOString() })
        .eq('id', u.id)
      continue
    }

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
          reply_to: 'hello@usekineo.com',
          subject: 'Your first Fast video is one minute away',
          text,
          html,
        }),
      })

      if (res.ok) {
        sent++
        await admin
          .from('profiles')
          .update({ activation_nudge_sent_at: new Date().toISOString() })
          .eq('id', u.id)
        console.log(`[send-activation-nudge] sent to ${email}`)
      } else {
        console.error(`[send-activation-nudge] resend failed for ${email}:`, await res.text())
        // not marked — retried next hour
      }
    } catch (err) {
      console.error(`[send-activation-nudge] error for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, skipped, total: (candidates ?? []).length })
}
