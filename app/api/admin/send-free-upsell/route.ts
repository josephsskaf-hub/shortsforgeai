// Free-trier upsell blast (admin- or cron-gated) — idempotent + batched.
//
// KINEO-FREE-UPSELL-2026-07-23 — emails users who USED the free generator
// (free_ai_generate_used=true) but never paid AND never even clicked checkout
// (so /api/admin/send-abandon-recovery — which targets *_checkout_clicked
// events — never reaches them). ~230 warm users today sit in this gap. Offers
// the same recurring-by-design intro ($4.90 first month, ?intro=1) so a rescue
// becomes a subscription, not a one-off coupon. Mirrors send-abandon-recovery's
// safety model exactly (internal/disposable filters, paced sends, flag-on-success).
//
// Idempotent via profiles.free_upsell_emailed (flagged on SUCCESSFUL send only),
// so the daily cron only ever emails NEW qualifying users — nobody twice.
//
// MODES (admin- or cron-gated, GET):
//   (no params)            → DRY RUN: who would receive it (count + sample).
//   ?confirm=SEND&limit=N  → send to the next N unflagged recipients (default 40),
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
const SUBJECT = 'Your Kineo video — now without the watermark'

const RAMON = 'ramonwilliamson@gmail.com'

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
  <p>You already made a video with Kineo — nice. The only thing between you and posting it clean is the watermark.</p>
  <p style="font-size:18px;margin:18px 0"><b>Unlock watermark-free MP4s for $4.90 your first month</b> — 25 credits, cancel anytime.</p>
  <p style="margin:26px 0">
    <a href="https://usekineo.com/api/stripe/checkout?tier=starter&intro=1" style="background:#2997ff;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Unlock my clean video &rarr;</a>
  </p>
  <p style="color:#475569;font-size:14px">Renews at $9.90/mo after the first month — cancel anytime with two clicks · 7-day money-back guarantee. Want to post daily? The Creator plan (150 credits + 1 Hollywood film/month) is also half off: <a href="https://usekineo.com/api/stripe/checkout?tier=basic&intro=1" style="color:#2997ff">first month $9.90</a>.</p>
  <p>Stuck on anything — a niche, a topic, an export? Just reply to this email. It comes straight to me.</p>
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
    const cronSecret = process.env.CRON_SECRET
    const isCronCall =
      !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`

    if (!isCronCall) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const email = (user?.email ?? '').toLowerCase()
      if (!user || !ADMIN_EMAILS.has(email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Service credentials not configured' }, { status: 500 })
    }

    const admin = adminClient()

    // Cohort: used the free generator, still unpaid, not yet upsell-emailed.
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email, plan, is_pro, has_paid')
      .eq('free_ai_generate_used', true)
      .eq('has_paid', false)
      .eq('free_upsell_emailed', false)
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
      .filter((r) => !r.has_paid && !r.is_pro && !PAID_PLANS.has(r.plan))
      .filter((r) => isValidExternalEmail(r.email))
      .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    const limitParam = Number(req.nextUrl.searchParams.get('limit'))
    const batchSize = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 40

    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        cohort: 'used free generator, unpaid, non-disposable, not yet upsell-emailed',
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
          await admin.from('profiles').update({ free_upsell_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[free-upsell] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[free-upsell] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    console.log(`[free-upsell] batch done: sent=${sent} failed=${failed}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length })
  } catch (err) {
    console.error('[free-upsell] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
