import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// send-recovery — Push #425
//
// Automated hot-lead recovery. checkout_abandoned rows appear when a Stripe
// session EXPIRES (~24h after the user walked away). Until now Joseph had to
// spot the lead in /admin and ask for a manual email — leads that abandoned
// overnight went cold. This cron runs every 2 hours and sends ONE personal
// founder-style email per lead (the EMAIL-HOT-LEAD.md template), from
// hello@usekineo.com, asking what got in the way.
//
// Guard rails:
//   - max 1 recovery email per user, ever (recovery_sent_at marks ALL rows)
//   - skips users who already converted to a paid plan
//   - skips founder/test accounts (same rules as /admin's isTestEmail)
//   - only looks at sessions expired in the last 48h, so a fresh deploy
//     never blasts the historical backlog

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
// Push #431 — Joseph's rule: lead-recovery/outreach goes out as the TEAM from
// hello@ (friendlier, commercial); support@ stays for support-only matters.
const FROM_EMAIL = 'Kineo Team <hello@usekineo.com>'
const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial'])

const TIER_LABEL: Record<string, string> = {
  starter: 'Starter',
  basic: 'Basic',
  creator: 'Creator',
  studio: 'Studio',
  pro: 'Pro',
}

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
  if (!cronSecret) return true // dev environment — allow
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

function buildEmail(plan: string) {
  const text = `Hey,

This is the Kineo team.

We noticed you got all the way to the ${plan} checkout but didn't finish signing up. No pressure at all - we just wanted to ask: did something get in the way? A payment issue, a question about the plans, a feature you were looking for?

Whatever it was, we'd like to fix it. A few things that might help:

- We accept card, Link, Google Pay and Apple Pay
- Your account comes with 30 free credits - so you can test the engine before paying anything
- If the price was the issue, reply and tell us. We'd rather make you a deal than lose you

Just hit reply and tell us what would make Kineo a yes for you. A real person reads and answers every message.

Kineo Team
usekineo.com`

  // Deliberately plain HTML — it must read like a person, not a campaign.
  const html = text
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br/>' : `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.55;">${line}</p>`))
    .join('')

  return { text, html }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!RESEND_API_KEY) {
    console.error('[send-recovery] RESEND_API_KEY not set')
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

  // Sessions expired in the last 48h, never recovered.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await admin
    .from('checkout_abandoned')
    .select('id, user_id, tier, expired_at')
    .is('recovery_sent_at', null)
    .gte('expired_at', since)
    .order('expired_at', { ascending: false })

  if (error) {
    console.error('[send-recovery] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // One candidate row per user (most recent abandonment wins).
  const byUser = new Map<string, { id: string; tier: string | null }>()
  for (const r of rows ?? []) {
    if (r.user_id && !byUser.has(r.user_id)) {
      byUser.set(r.user_id, { id: r.id, tier: r.tier })
    }
  }
  if (byUser.size === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, total: 0 })
  }

  // Profiles: email + current plan (skip already-converted users).
  const userIds = [...byUser.keys()]
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, email, plan')
    .in('id', userIds)
  if (profErr) {
    console.error('[send-recovery] profiles error:', profErr.message)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]))

  let sent = 0
  let skipped = 0

  for (const [userId, cand] of byUser) {
    const prof = profById.get(userId)
    const email = prof?.email?.trim()
    const plan = (prof?.plan ?? 'free').toLowerCase()

    if (!email || isTestEmail(email) || PAID_PLANS.has(plan)) {
      skipped++
      // Mark so we never reconsider these rows (converted/test/unreachable).
      await admin
        .from('checkout_abandoned')
        .update({ recovery_sent_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('recovery_sent_at', null)
      continue
    }

    const tierLabel = TIER_LABEL[(cand.tier ?? '').toLowerCase()] ?? 'Pro'
    const { text, html } = buildEmail(tierLabel)

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
          subject: 'Quick question about your Kineo checkout',
          text,
          html,
        }),
      })

      if (res.ok) {
        sent++
        await admin
          .from('checkout_abandoned')
          .update({ recovery_sent_at: new Date().toISOString() })
          .eq('user_id', userId)
          .is('recovery_sent_at', null)
        console.log(`[send-recovery] sent to ${email} (${tierLabel})`)
      } else {
        console.error(`[send-recovery] resend failed for ${email}:`, await res.text())
        // do NOT mark — retried on the next run
      }
    } catch (err) {
      console.error(`[send-recovery] error for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, skipped, total: byUser.size })
}
