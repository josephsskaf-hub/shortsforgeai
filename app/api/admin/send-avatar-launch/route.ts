// AI Avatar LAUNCH blast (admin-only) — v2, idempotent + batched.
//
// WHY v2: the free Resend tier caps at 100 emails/day. v1 had no "already
// emailed" tracking, so a re-run (or the next daily batch) would email the
// same people again. v2 adds profiles.avatar_launch_emailed and only ever
// targets unflagged recipients, marking the flag on a SUCCESSFUL send.
//
// MODES (all admin-gated, GET):
//   (no params)            → DRY RUN: how many remain (flag=false), sample.
//   ?backfill=1            → page Resend's sent-email log and mark every
//                            recipient who ALREADY received this subject, so
//                            the first paid batch never double-sends to the
//                            ~100 that went out on the free tier.
//   ?confirm=SEND&limit=N  → send to the next N unflagged recipients (default
//                            80, safely under the free 100/day cap), pacing
//                            each send, marking the flag on success.
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

const FROM_EMAIL = 'ShortsForgeAI Team <hello@shortsforgeai.com>'
const SUBJECT = 'Your face. Your script. One click. 🎭'

function emailHtml(): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
  <p>Big one today: <b>AI Avatar Video</b> is live on ShortsForgeAI.</p>
  <p>Upload a photo — yours or anyone's (with permission) — and your next Short shows that person <i>speaking your script</i>, lip-synced in 720p, with footage, captions and music around it.</p>
  <p><b>No camera. No mic. No editing.</b></p>
  <p>Avatar videos are a premium add-on, separate from your plan credits:</p>
  <ul>
    <li><b>$29</b> — 1 video</li>
    <li><b>$79</b> — 3 videos</li>
    <li><b>$239</b> — 10 videos</li>
  </ul>
  <p>Studio members get <b>15% off</b> automatically.</p>
  <p style="margin:24px 0">
    <a href="https://shortsforgeai.com/generate?avatar=1&utm_source=launch_email" style="background:#a855f7;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Try AI Avatar →</a>
  </p>
  <p>— Joseph, founder<br/>ShortsForgeAI · https://shortsforgeai.com</p>
</div>`
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const isEmail = (e: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.includes('example.com') && !e.startsWith('test@')

/**
 * Backfill: read Resend's recent sent emails and mark every recipient who
 * already received THIS subject as avatar_launch_emailed=true. Resend's list
 * endpoint returns recent emails; we page until we stop finding matches or hit
 * a page budget. Best-effort — never throws.
 */
async function backfillFromResend(admin: ReturnType<typeof adminClient>): Promise<{ marked: number; scanned: number }> {
  const key = process.env.RESEND_API_KEY as string
  let scanned = 0
  const matchedEmails = new Set<string>()
  let url = 'https://api.resend.com/emails?limit=100'
  for (let page = 0; page < 20; page++) {
    let json: { data?: Array<{ to?: string[] | string; subject?: string }>; next?: string | null } | null = null
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
      if (!res.ok) break
      json = await res.json()
    } catch {
      break
    }
    const items = Array.isArray(json?.data) ? json!.data! : []
    if (items.length === 0) break
    for (const it of items) {
      scanned++
      if ((it.subject ?? '').includes('Your face. Your script')) {
        const tos = Array.isArray(it.to) ? it.to : it.to ? [it.to] : []
        for (const t of tos) {
          const e = (t ?? '').trim().toLowerCase()
          if (e) matchedEmails.add(e)
        }
      }
    }
    const next = json?.next
    if (!next) break
    url = next.startsWith('http') ? next : `https://api.resend.com/emails?after=${next}&limit=100`
  }

  let marked = 0
  const list = Array.from(matchedEmails)
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50)
    const { error, count } = await admin
      .from('profiles')
      .update({ avatar_launch_emailed: true }, { count: 'exact' })
      .in('email', chunk)
    if (!error && typeof count === 'number') marked += count
  }
  return { marked, scanned }
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

    // ── Backfill mode ─────────────────────────────────────────────────────
    if (req.nextUrl.searchParams.get('backfill') === '1') {
      const { marked, scanned } = await backfillFromResend(admin)
      return NextResponse.json({ mode: 'BACKFILL', marked_as_already_emailed: marked, resend_emails_scanned: scanned })
    }

    // Pull unflagged recipients only (idempotent target set).
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, email')
      .not('email', 'is', null)
      .eq('avatar_launch_emailed', false)
    if (error) {
      return NextResponse.json({ error: `profiles query failed: ${error.message}` }, { status: 500 })
    }
    const pending = (rows ?? [])
      .map((r) => ({ id: (r as { id: string }).id, email: ((r as { email?: string }).email ?? '').trim().toLowerCase() }))
      .filter((r) => isEmail(r.email))
    // de-dupe by email, keep first id
    const seen = new Set<string>()
    const recipients = pending.filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)))

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    const limitParam = Number(req.nextUrl.searchParams.get('limit'))
    const batchSize = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 80

    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        remaining_unemailed: recipients.length,
        next_batch_size: Math.min(batchSize, recipients.length),
        sample: recipients.slice(0, 5).map((r) => r.email),
        subject: SUBJECT,
        hint: 'Append &confirm=SEND (optionally &limit=N) to send the next batch. Use ?backfill=1 first to mark already-sent recipients.',
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
            reply_to: 'hello@shortsforgeai.com',
            subject: SUBJECT,
            html: emailHtml(),
          }),
        })
        if (res.ok) {
          sent += 1
          // Mark on success only — a failed send stays pending for the next batch.
          await admin.from('profiles').update({ avatar_launch_emailed: true }).eq('id', r.id)
        } else {
          failed += 1
          console.error(`[avatar-launch] resend failed for ${r.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[avatar-launch] send threw for ${r.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((res) => setTimeout(res, 700))
    }

    const { count: remainingAfter } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_launch_emailed', false)
      .not('email', 'is', null)

    console.log(`[avatar-launch] batch done: sent=${sent} failed=${failed} remaining=${remainingAfter ?? '?'}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, batch_size: batch.length, remaining_unemailed: remainingAfter ?? null })
  } catch (err) {
    console.error('[avatar-launch] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
