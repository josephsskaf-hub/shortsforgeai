import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sweepStuckRenderDebits } from '@/lib/credits/refund'

// Cron route: fires daily via Vercel Cron (see vercel.json).
// Finds users who signed up 20–28 hours ago and have no paid plan,
// then sends a single reminder email nudging them to start their trial.
//
// Idempotency: we track sent reminders in a `reminder_sent_at` column
// on profiles. If the column is null AND the user hasn't subscribed, we
// send once. Subsequent cron runs skip them.

export const dynamic = 'force-dynamic'
// KINEO-REBASE-2026-07-10 — 30 → 300 (Vercel Pro): this daily cron now also
// triggers the abandon-recovery batch (paced ~700ms/send), which can take
// ~60s on top of the reminder loop.
export const maxDuration = 300

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Kineo <support@usekineo.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://usekineo.com'

// Guard: only Vercel Cron or the internal secret can call this route.
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // dev environment — allow
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // AUTO-REFUND daily sweep (TAAFT feedback) — piggybacked on this existing
  // daily cron instead of a new vercel.json entry (Vercel Hobby silently
  // rejects deploys when cron limits are exceeded). Refunds `video` debits
  // older than 2h that never produced a `videos` row (i.e. charged but the
  // render never completed). Idempotent per render via refund_render_credits.
  // Runs BEFORE the RESEND early-return so a missing email key never skips it.
  try {
    const sweep = await sweepStuckRenderDebits()
    console.log('[send-reminders] stuck-render refund sweep:', JSON.stringify(sweep))
  } catch (e) {
    console.error('[send-reminders] refund sweep failed:', e instanceof Error ? e.message : String(e))
  }

  // KINEO-REBASE-2026-07-10 — ROBÔ DE ABANDONO NA ROTINA. Piggybacked on this
  // existing daily cron (NOT a new vercel.json entry): one server-to-server
  // call to /api/admin/send-abandon-recovery with the CRON_SECRET bearer
  // (the route accepts it alongside the admin cookie). The endpoint is
  // idempotent by design — profiles.abandon_emailed is flagged on successful
  // send only — so the daily run only ever emails NEW checkout-abandoners.
  // limit=60 keeps the paced batch (~700ms/send) well inside maxDuration and
  // under Resend's daily cap alongside the other lifecycle emails.
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const res = await fetch(
        `${APP_URL}/api/admin/send-abandon-recovery?confirm=SEND&limit=60`,
        { headers: { authorization: `Bearer ${cronSecret}` }, cache: 'no-store' },
      )
      const body = await res.json().catch(() => null)
      console.log('[send-reminders] abandon-recovery daily batch:', res.status, JSON.stringify(body))
    } else {
      console.warn('[send-reminders] CRON_SECRET not set — abandon-recovery batch skipped')
    }
  } catch (e) {
    console.error('[send-reminders] abandon-recovery call failed:', e instanceof Error ? e.message : String(e))
  }

  if (!RESEND_API_KEY) {
    console.error('[send-reminders] RESEND_API_KEY not set')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const supabase = createClient()

  // Find users who signed up 20–28 hours ago, have no paid plan, and
  // haven't received a reminder yet.
  const now = new Date()
  const from = new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, reminder_sent_at')
    .gte('created_at', from)
    .lte('created_at', to)
    .is('reminder_sent_at', null)
    .in('plan', ['free', null])

  if (error) {
    console.error('[send-reminders] DB query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targets = users ?? []
  console.log(`[send-reminders] ${targets.length} users to remind`)

  let sent = 0
  let failed = 0

  for (const user of targets) {
    if (!user.email) continue

    const name = user.full_name?.split(' ')[0] || null
    const greeting = name ? `Hey ${name},` : 'Hey Creator,'
    const pricingUrl = `${APP_URL}/pricing`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Still thinking? 3 days free — Kineo</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-size:20px;font-weight:900;color:#f5f5f7;">Kineo</span>
            </td>
          </tr>
          <tr>
            <td style="background:#161618;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">
              <p style="color:#e2e8f0;font-size:18px;font-weight:700;margin:0 0 6px;">${greeting}</p>
              <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;line-height:1.6;">You created your account yesterday but haven't started your free trial yet.</p>

              <div style="background:rgba(41,151,255,0.08);border:1px solid rgba(41,151,255,0.3);border-radius:14px;padding:20px 24px;margin-bottom:28px;text-align:center;">
                <p style="color:#2997ff;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">⏰ YOUR TRIAL IS STILL AVAILABLE</p>
                <p style="color:#f1f5f9;font-size:24px;font-weight:900;margin:0 0 4px;">3 days free. No charge today.</p>
                <p style="color:#64748b;font-size:13px;margin:0;">Cancel before Day 4 → $0. No questions asked.</p>
              </div>

              <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.7;">
                In 3 days you could post your first 5 Shorts — AI writes the script, records the voiceover, adds captions, and assembles the video. You just download and post.
              </p>

              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="${pricingUrl}" style="display:inline-block;background:#2997ff;color:#ffffff;font-size:17px;font-weight:900;text-decoration:none;padding:18px 48px;border-radius:14px;letter-spacing:0.01em;box-shadow:0 6px 28px rgba(41,151,255,0.4);">
                      Start My Free Trial →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align:center;color:#475569;font-size:12px;margin:0 0 24px;">Starter $9.90 · Creator $19.90 · Studio $37.90/mo after trial · Cancel anytime</p>

              <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;">
                <p style="color:#475569;font-size:12px;margin:0;text-align:center;line-height:1.6;">
                  Questions? Just reply to this email.<br />
                  <a href="${APP_URL}" style="color:#2997ff;text-decoration:none;">usekineo.com</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [user.email],
          subject: '⏰ Your free 3-day trial is waiting — don\'t miss it',
          html,
          text: `${greeting}\n\nYou signed up for Kineo but haven't started your free trial yet.\n\n3 days free — no charge today. Cancel before Day 4 and you pay nothing.\n\nStart here: ${pricingUrl}\n\n— The Kineo Team`,
        }),
      })

      if (res.ok) {
        // Mark the user so we don't send a second reminder.
        await supabase
          .from('profiles')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', user.id)
        sent++
        console.log(`[send-reminders] sent to ${user.email}`)
      } else {
        failed++
        console.error(`[send-reminders] resend failed for ${user.email}:`, await res.text())
      }
    } catch (err) {
      failed++
      console.error(`[send-reminders] error for ${user.email}:`, err)
    }
  }

  return NextResponse.json({ sent, failed, total: targets.length })
}
