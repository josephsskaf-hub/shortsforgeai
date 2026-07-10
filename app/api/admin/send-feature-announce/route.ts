// KINEO-FEATURE-ANNOUNCE-2026-07-10 — avatar-suite announcement blast
// (admin-only, idempotent, batched). Announces the 4 new features shipped
// 10/07 (AI Presenter, Character Lock, Transparent Gesture Clips, UGC
// Product Ads) to the WHOLE base — paid users learn about the new engines
// (credit upsell), free users get a fresh reason to come back.
//
// Modeled on send-pack-offer: per-recipient flag
// (profiles.feature_announce_emailed, migration 013) set on SUCCESSFUL send
// only; paced to respect Resend's free 100/day cap.
//
// MODES (admin-gated, GET):
//   (no params)            → DRY RUN: who would receive it (count + sample).
//   ?confirm=SEND&limit=N  → send next N unflagged recipients (default 80).
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

// joseph@usekineo.com EXISTS and receives replies (Workspace alias domain,
// send-as configured 01/07) — hello@ does NOT receive, never use it here.
const FROM_EMAIL = 'Joseph at Kineo <joseph@usekineo.com>'
const REPLY_TO = 'joseph@usekineo.com'
const SUBJECT = 'Your Kineo just got a face — meet AI Presenter 🎬'

const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com', 'gmeenramy.com', 'kinws.com', 'doefy.com', 'x-box.in',
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com', 'tempmail.com',
  '10minutemail.com', 'trashmail.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'mohmal.com', 'temp-mail.org', 'fakeinbox.com',
])

function isInternal(email: string): boolean {
  if (ADMIN_EMAILS.has(email)) return true
  if (email.startsWith('josephsskaf') || email.startsWith('josephskaf')) return true
  if (email.startsWith('joseph+') || email.startsWith('joseph-')) return true
  if (email === 'victoriaskaf96@gmail.com') return true
  const dom = email.split('@')[1] ?? ''
  if (dom === 'shortsforgeai.com' || dom === 'usekineo.com' || dom === 'theresanaiforthat.com') return true
  return false
}

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
  <p>Hey — Joseph here, founder of <b>Kineo</b> 👋</p>
  <p>We just shipped the biggest update since launch. Your account now includes <b>4 new tools</b>:</p>
  <p style="margin:16px 0 6px"><b>🎬 AI Presenter</b><br/>
  One photo + your script → a talking video with studio-grade lip-sync. Like HeyGen, inside your Kineo.</p>
  <p style="margin:14px 0 6px"><b>🎭 Character Lock</b><br/>
  Save a character once — the exact same face in every video you make. Perfect for a channel host or a brand persona.</p>
  <p style="margin:14px 0 6px"><b>🫥 Transparent gesture clips</b><br/>
  Your presenter waving, pointing, presenting — delivered as WebM with a REAL transparent background. Drop into slides, courses or edits. No green screen.</p>
  <p style="margin:14px 0 6px"><b>📦 UGC Product Ads</b><br/>
  Paste any product → a 15–30s creator-style ad, scripted and spoken for you. Free to generate the script.</p>
  <p style="margin-top:18px">Everything runs on your normal credits — nothing new to learn.</p>
  <p style="margin:26px 0">
    <a href="https://usekineo.com/avatar?utm_source=feature_email&utm_campaign=avatar_suite" style="background:#2997ff;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:bold">Try AI Presenter →</a>
  </p>
  <p style="font-size:13px;color:#64748b">Out of credits? The $4.90 pack (10 videos, never expires) covers your first presenter video and more.</p>
  <p>Just reply if you want me to walk you through any of it — I read every email.</p>
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

    // WHOLE base (paid + free) not yet announced — new engines are relevant
    // to everyone; idempotency flag prevents double sends across batches/days.
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email')
      .eq('feature_announce_emailed', false)
    if (error) {
      return NextResponse.json({ error: `profiles query failed: ${error.message}` }, { status: 500 })
    }

    const seen = new Set<string>()
    const recipients = (rows ?? [])
      .map((r) => ({ id: (r as { id: string }).id, email: ((r as { email: string | null }).email ?? '').trim().toLowerCase() }))
      .filter((r) => isValidExternalEmail(r.email))
      .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    const limitParam = Number(req.nextUrl.searchParams.get('limit'))
    const batchSize = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 80

    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        cohort: 'ALL profiles (paid + free), valid external, not yet announced',
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
          await admin.from('profiles').update({ feature_announce_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[feature-announce] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[feature-announce] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    const { count: remainingAfter } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('feature_announce_emailed', false)

    console.log(`[feature-announce] batch done: sent=${sent} failed=${failed} remaining=${remainingAfter ?? '?'}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length, remaining_flag_false: remainingAfter ?? null })
  } catch (err) {
    console.error('[feature-announce] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
