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
  const url = `${APP_URL}/generate`
  const text = `Hey,

This is the Kineo team — welcome!

You created your account a little while ago. Quick heads-up in case you missed it: your account comes with 2 free videos to try — no card needed. Make one in about 60 seconds and see how it feels.

Type literally any idea ("the Bermuda Triangle mystery", "how Bezos starts his day") and the AI writes the script, adds the voiceover, captions and footage. About a minute later you have a ready-to-post Short.

Make your free video here: ${url}

If anything is confusing or not working, just reply to this email - a real person reads every message.

Kineo Team
usekineo.com`

  const html = text
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? '<br/>'
        : `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.55;">${
            line.includes(url)
              ? line.replace(url, `<a href="${url}" style="color:#2997ff;font-weight:bold;">${url}</a>`)
              : line
          }</p>`
    )
    .join('')

  return { text, html }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
          subject: 'You have 30 free credits waiting — 1 click away',
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
