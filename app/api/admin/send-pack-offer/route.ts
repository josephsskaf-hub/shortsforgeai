// Starter-Pack win-back blast (admin-only) — idempotent + batched.
//
// KINEO-PACK-OFFER-2026-07-06 — one-time campaign: email everyone who signed up
// on Jul 5–6 2026 (the admin-funnel cohort) offering the $4.90 Starter Pack, now
// 25 Fast Shorts. Excludes Ramon (already bought), internal accounts, paid users,
// and disposable/throwaway inboxes (they only hurt the young domain's reputation).
//
// Modeled on send-avatar-launch: per-recipient flag (profiles.pack_offer_emailed)
// so a re-run never double-sends; only flags on a SUCCESSFUL send; paces sends to
// stay under Resend's free 100/day cap.
//
// MODES (all admin-gated, GET):
//   (no params)            → DRY RUN: who would receive it (count + sample).
//   ?confirm=SEND&limit=N  → send to the next N unflagged recipients (default 90),
//                            pacing each send, marking the flag on success.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

// hello@ = prospecção/resgate de leads (support@ is reserved for support).
const FROM_EMAIL = 'Joseph at Kineo <hello@usekineo.com>'
const REPLY_TO = 'hello@usekineo.com'
const SUBJECT = 'Your 25-Short pack — $4.90, no subscription'

// KINEO-PACK-WIDEN-2026-07-08 — widened from the Jul 5–6 cohort to ALL signups
// (launch onward → end of today) so the $4.90 win-back reaches every unpaid lead
// who hasn't been offered it yet. Idempotency (profiles.pack_offer_emailed) still
// guarantees nobody is emailed twice — the 108 already contacted are auto-skipped.
const WINDOW_START = '2026-01-01T00:00:00Z'
const WINDOW_END = '2026-07-09T00:00:00Z'

// Ramon already bought the pack — never email him this offer.
const RAMON = 'ramonwilliamson@gmail.com'

// Disposable / throwaway inbox domains seen in this cohort (+ common ones).
// Sending to these bounces or lands nowhere and hurts sender reputation.
const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com', 'gmeenramy.com', 'kinws.com', 'doefy.com', 'x-box.in',
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com', 'tempmail.com',
  '10minutemail.com', 'trashmail.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'mohmal.com', 'temp-mail.org', 'fakeinbox.com',
])

function isInternal(email: string): boolean {
  if (email === RAMON) return true
  if (ADMIN_EMAILS.has(email)) return true
  if (email.startsWith('josephsskaf') || email.startsWith('josephskaf')) return true
  if (email.startsWith('joseph+') || email.startsWith('joseph-')) return true
  if (email === 'victoriaskaf96@gmail.com') return true
  const dom = email.split('@')[1] ?? ''
  if (dom === 'shortsforgeai.com' || dom === 'usekineo.com' || dom === 'theresanaiforthat.com') return true
  return false
}

const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial'])

function isValidExternalEmail(email: string): boolean {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false
  if (email.includes('example.com') || email.startsWith('test@') || email.startsWith('smoketest')) return false
  const dom = email.split('@')[1] ?? ''
  if (DISPOSABLE_DOMAINS.has(dom)) return false
  if (isInternal(email)) return false
  return true
}

function emailHtml(): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
  <p>Hey — thanks for trying <b>Kineo</b> 🎬</p>
  <p>You can turn any idea into a finished, faceless YouTube Short in about a minute — footage, voiceover, captions and music, done for you.</p>
  <p>Here's a founder deal to keep the momentum going:</p>
  <p style="font-size:18px;margin:18px 0"><b>25 Shorts for a one-time $4.90.</b></p>
  <ul>
    <li>No subscription</li>
    <li>Watermark-free</li>
    <li>Credits never expire</li>
  </ul>
  <p style="margin:26px 0">
    <a href="https://usekineo.com/pricing?utm_source=winback_email&utm_campaign=starter25" style="background:#2997ff;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Get 25 Shorts for $4.90 →</a>
  </p>
  <p>Just reply to this email if you need anything — I read every one.</p>
  <p>— Joseph, founder<br/>Kineo · https://usekineo.com</p>
</div>`
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = (user?.email ?? '').toLowerCase()
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Service credentials not configured' }, { status: 500 })
    }

    const admin = adminClient()

    // Cohort: Jul 5–6 signups not yet emailed this offer.
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email, plan, is_pro, has_paid, video_credits, created_at')
      .gte('created_at', WINDOW_START)
      .lt('created_at', WINDOW_END)
      .eq('pack_offer_emailed', false)
    if (error) {
      return NextResponse.json({ error: `profiles query failed: ${error.message}` }, { status: 500 })
    }

    type Row = {
      id: string
      email: string | null
      plan: string | null
      is_pro: boolean | null
      has_paid: boolean | null
      video_credits: number | null
      created_at: string | null
    }

    const seen = new Set<string>()
    const recipients = (rows ?? [])
      .map((r) => {
        const row = r as Row
        return { id: row.id, email: (row.email ?? '').trim().toLowerCase(), plan: (row.plan ?? '').toLowerCase(), is_pro: !!row.is_pro, has_paid: !!row.has_paid }
      })
      // free / unpaid only — never offer the entry pack to someone already paying
      .filter((r) => !r.has_paid && !r.is_pro && !PAID_PLANS.has(r.plan))
      // valid external, non-disposable, non-internal, non-Ramon
      .filter((r) => isValidExternalEmail(r.email))
      // de-dupe by email
      .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    const limitParam = Number(req.nextUrl.searchParams.get('limit'))
    const batchSize = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 90

    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        cohort: 'signups 2026-07-05 → 2026-07-06, unpaid, non-Ramon, non-disposable',
        remaining_unemailed: recipients.length,
        next_batch_size: Math.min(batchSize, recipients.length),
        sample: recipients.slice(0, 8).map((r) => r.email),
        subject: SUBJECT,
        from: FROM_EMAIL,
        hint: 'Append &confirm=SEND (optionally &limit=N) to send the next batch.',
      })
    }

    const batch = recipients.slice(0, batchSize)
    let sent = 0
    let failed = 0
    for (const r of batch) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [r.email],
            reply_to: REPLY_TO,
            subject: SUBJECT,
            html: emailHtml(),
          }),
        })
        if (res.ok) {
          sent += 1
          // Flag on success only — a failed send stays pending for the next batch.
          await admin.from('profiles').update({ pack_offer_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[pack-offer] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[pack-offer] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    const { count: remainingAfter } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', WINDOW_START)
      .lt('created_at', WINDOW_END)
      .eq('pack_offer_emailed', false)

    console.log(`[pack-offer] batch done: sent=${sent} failed=${failed} remaining=${remainingAfter ?? '?'}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length, remaining_flag_false: remainingAfter ?? null })
  } catch (err) {
    console.error('[pack-offer] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
