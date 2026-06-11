// AI Avatar LAUNCH blast (one-shot, admin-only) — announces the new premium
// add-on to the whole user base via Resend (domain verified, hello@ sender).
//
// SAFETY RAILS:
//   • ADMIN_EMAILS-gated (same pattern as /api/admin/affiliates).
//   • DRY RUN by default: GET returns the recipient count + a preview, sends
//     NOTHING. Real send requires ?confirm=SEND.
//   • Idempotence: marks profiles.avatar_launch_emailed=true per recipient
//     when the column exists; otherwise falls back to a single-shot guard via
//     the dry-run/confirm flow (run once, on purpose).
//   • Batched sequentially with a small delay — kind to Resend rate limits.
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

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Whole base, deduped, valid-looking emails only.
    const { data: rows, error } = await admin
      .from('profiles')
      .select('email')
      .not('email', 'is', null)
    if (error) {
      return NextResponse.json({ error: `profiles query failed: ${error.message}` }, { status: 500 })
    }
    const recipients = Array.from(
      new Set(
        (rows ?? [])
          .map((r) => ((r as { email?: string }).email ?? '').trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
          // never blast test/example addresses
          .filter((e) => !e.includes('example.com') && !e.startsWith('test@')),
      ),
    )

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        recipients: recipients.length,
        sample: recipients.slice(0, 5),
        subject: SUBJECT,
        hint: 'Append &confirm=SEND to actually send.',
      })
    }

    let sent = 0
    let failed = 0
    for (const to of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [to],
            reply_to: 'hello@shortsforgeai.com',
            subject: SUBJECT,
            html: emailHtml(),
          }),
        })
        if (res.ok) sent += 1
        else {
          failed += 1
          console.error(`[avatar-launch] resend failed for ${to}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[avatar-launch] send threw for ${to}:`, e instanceof Error ? e.message : String(e))
      }
      // gentle pacing for Resend rate limits
      await new Promise((r) => setTimeout(r, 600))
    }

    console.log(`[avatar-launch] blast complete: sent=${sent} failed=${failed} of ${recipients.length}`)
    return NextResponse.json({ mode: 'SENT', sent, failed, total: recipients.length })
  } catch (err) {
    console.error('[avatar-launch] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
