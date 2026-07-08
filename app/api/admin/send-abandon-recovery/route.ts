// Cart-abandonment recovery blast (admin-only) — idempotent + batched.
//
// KINEO-ABANDON-RECOVERY-2026-07-08 — email everyone who clicked a checkout
// button (*_checkout_clicked event) but never paid, offering 20% off any plan
// with code KINEO20 (auto-applied via the link). Attacks the #1 leak: abandonment
// at the decision moment. Idempotent via profiles.abandon_emailed; only flags on a
// successful send; paces sends under Resend's free 100/day cap.
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
const SUBJECT = 'Still thinking it over? Here is 20% off'

// The checkout-click events fired across pricing, homepage, and the watermark moment.
const CHECKOUT_EVENTS = [
  'starter_checkout_clicked',
  'basic_checkout_clicked',
  'pro_checkout_clicked',
  'starter_pack_checkout_clicked',
]

// Ramon already bought — never email him a recovery offer.
const RAMON = 'ramonwilliamson@gmail.com'

// Disposable / throwaway inbox domains — sending to these hurts sender reputation.
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
  <p>Hey — Joseph here, founder of <b>Kineo</b> 🎬</p>
  <p>I noticed you got as far as checkout but didn't finish. No pressure — but if price was the thing holding you back, let me help.</p>
  <p style="font-size:18px;margin:18px 0"><b>Here's 20% off any plan.</b></p>
  <p style="margin:26px 0">
    <a href="https://usekineo.com/pricing?promo=KINEO20&utm_source=abandon_email&utm_campaign=recovery20" style="background:#2997ff;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Claim 20% off &rarr;</a>
  </p>
  <p style="color:#475569;font-size:14px">The discount applies automatically at checkout (code <b>KINEO20</b>). Cancel anytime · 7-day money-back guarantee.</p>
  <p>If something else held you back — a feature or a question — just reply to this email. It comes straight to me.</p>
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

    // 1) user_ids that fired a checkout-click event (the universe of abandoners).
    const { data: evRows, error: evErr } = await admin
      .from('events')
      .select('user_id')
      .in('name', CHECKOUT_EVENTS)
      .not('user_id', 'is', null)
    if (evErr) {
      return NextResponse.json({ error: `events query failed: ${evErr.message}` }, { status: 500 })
    }
    const clickerIds = Array.from(
      new Set((evRows ?? []).map((e) => (e as { user_id: string | null }).user_id).filter(Boolean) as string[]),
    )
    if (clickerIds.length === 0) {
      return NextResponse.json({ mode: 'DRY_RUN', remaining_unemailed: 0, note: 'no checkout-click events yet' })
    }

    // 2) those clickers' profiles: unpaid + not yet recovery-emailed.
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email, plan, is_pro, has_paid')
      .in('id', clickerIds)
      .eq('abandon_emailed', false)
    if (error) {
      return NextResponse.json({ error: `profiles query failed: ${error.message}` }, { status: 500 })
    }

    type Row = {
      id: string
      email: string | null
      plan: string | null
      is_pro: boolean | null
      has_paid: boolean | null
    }

    const seen = new Set<string>()
    const recipients = (rows ?? [])
      .map((r) => {
        const row = r as Row
        return { id: row.id, email: (row.email ?? '').trim().toLowerCase(), plan: (row.plan ?? '').toLowerCase(), is_pro: !!row.is_pro, has_paid: !!row.has_paid }
      })
      // free / unpaid only — never chase someone who already pays
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
        cohort: 'clicked checkout, unpaid, non-disposable, not yet recovery-emailed',
        clickers_total: clickerIds.length,
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
          await admin.from('profiles').update({ abandon_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[abandon-recovery] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[abandon-recovery] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    console.log(`[abandon-recovery] batch done: sent=${sent} failed=${failed}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length })
  } catch (err) {
    console.error('[abandon-recovery] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
