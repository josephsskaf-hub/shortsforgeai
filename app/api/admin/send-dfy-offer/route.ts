// KINEO-DFY-OFFER-2026-07-08 — Done-For-You campaign (admin-only) — idempotent + batched.
//
// Offer: "30 AI Shorts done for you — $97 one-time". Sent to every unpaid signup
// (same audience rules as send-pack-offer). The lead doesn't have to operate the
// tool: they reply "YES", we produce 30 Shorts with Kineo and deliver.
//
// Modeled on send-pack-offer: per-recipient flag (profiles.dfy_offer_emailed,
// migration add_dfy_offer_emailed_flag ALREADY APPLIED in prod) so a re-run never
// double-sends; flags only on SUCCESSFUL send; paced for Resend's 100/day cap.
//
// MODES (all admin-gated, GET):
//   (no params)            → DRY RUN: who would receive it (count + sample).
//   ?confirm=SEND&limit=N  → send to the next N unflagged recipients (default 90).
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
const SUBJECT = "You don't have to make the videos yourself"

const WINDOW_START = '2026-01-01T00:00:00Z'
const WINDOW_END = '2026-07-10T00:00:00Z'

// Ramon bought the Starter Pack — the DFY offer is fine for him? No: keep the
// same exclusion as pack-offer to stay conservative with the one paying customer.
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
  <p>Hi — Joseph here, founder of <b>Kineo</b>.</p>
  <p>You signed up to make faceless Shorts. But making videos every day is a job — so let us do the job for you.</p>
  <p style="font-size:18px;margin:18px 0"><b>Done-For-You: 30 AI Shorts — $97 (one-time)</b></p>
  <ul>
    <li>You pick the niche (or we pick one proven to go viral)</li>
    <li>We script, generate, and deliver 30 ready-to-post vertical Shorts within 7 days</li>
    <li>Built with the same engine behind our 11K+ view viral Shorts</li>
    <li>Titles, descriptions, and hashtags included for every video</li>
  </ul>
  <p>That's $3.20 per video — less than one editor charges for a single one.</p>
  <p><b>Only 10 spots this week</b> (real limit — each pack takes production time).</p>
  <p style="margin:26px 0"><b>Reply "YES" to this email</b> and I'll send the payment link + a 2-minute niche form.</p>
  <p>— Joseph, founder<br/>Kineo · https://usekineo.com</p>
  <p style="color:#64748b;font-size:13px">P.S. Prefer doing it yourself? Your credits are waiting: <a href="https://usekineo.com/pricing?utm_source=dfy_email&utm_campaign=dfy97&promo=KINEO20">usekineo.com</a> — code KINEO20 for 20% off.</p>
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

    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email, plan, is_pro, has_paid, video_credits, created_at')
      .gte('created_at', WINDOW_START)
      .lt('created_at', WINDOW_END)
      .eq('dfy_offer_emailed', false)
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
      // free / unpaid only
      .filter((r) => !r.has_paid && !r.is_pro && !PAID_PLANS.has(r.plan))
      .filter((r) => isValidExternalEmail(r.email))
      .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    const limitParam = Number(req.nextUrl.searchParams.get('limit'))
    const batchSize = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 90

    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        cohort: 'all unpaid signups, non-internal, non-disposable, not yet DFY-emailed',
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
          await admin.from('profiles').update({ dfy_offer_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[dfy-offer] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[dfy-offer] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    const { count: remainingAfter } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', WINDOW_START)
      .lt('created_at', WINDOW_END)
      .eq('dfy_offer_emailed', false)

    console.log(`[dfy-offer] batch done: sent=${sent} failed=${failed} remaining=${remainingAfter ?? '?'}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length, remaining_flag_false: remainingAfter ?? null })
  } catch (err) {
    console.error('[dfy-offer] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
