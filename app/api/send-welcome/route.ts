import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shortsforgeai.com'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ShortsForgeAI <hello@shortsforgeai.com>'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (typeof email !== 'string' || email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your_resend_api_key_here') {
      console.warn('[send-welcome] RESEND_API_KEY not configured — skipping welcome email')
      return NextResponse.json({ skipped: true })
    }

    const greeting = name ? `Hey ${name},` : 'Hey Creator,'
    // Push #282 — new users land on /pricing (no free credits since #281).
    const dashboardUrl = `${APP_URL}/pricing`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your 3-day free trial is waiting — ShortsForgeAI</title>
</head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#3B82F6,#2563EB);display:inline-flex;align-items:center;justify-content:center;font-size:18px;text-align:center;">⚡</div>
                <span style="font-size:20px;font-weight:900;color:#e2e8f0;letter-spacing:-0.5px;">ShortsForge<span style="color:#22D3EE;">AI</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#13131f;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">
              <p style="color:#e2e8f0;font-size:18px;font-weight:700;margin:0 0 6px;">${greeting}</p>
              <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;line-height:1.6;">Your account is ready. Here's what you get with a 3-day free trial:</p>

              <!-- hero benefit box -->
              <div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.28);border-radius:14px;padding:20px 24px;margin-bottom:28px;text-align:center;">
                <p style="color:#22D3EE;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">3 DAYS FREE — NO CHARGE TODAY</p>
                <p style="color:#f1f5f9;font-size:28px;font-weight:900;margin:0 0 4px;letter-spacing:-0.5px;">Try ShortsForgeAI Free</p>
                <p style="color:#64748b;font-size:13px;margin:0;">Cancel before Day 4 and you pay nothing. Ever.</p>
              </div>

              <!-- feature list -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">AI writes your script + voiceover in seconds</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Auto-captions — no editing skill needed</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Stock footage library — no camera needed</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Watermark-free MP4 — ready to post</span></td></tr>
              </table>

              <!-- single CTA button -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#22D3EE);color:#ffffff;font-size:17px;font-weight:900;text-decoration:none;padding:18px 48px;border-radius:14px;letter-spacing:0.01em;box-shadow:0 6px 28px rgba(59,130,246,0.45);">
                      Start My Free 3-Day Trial →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align:center;color:#475569;font-size:12px;margin:0 0 28px;">Basic $4.90/mo or Pro $9.90/mo after trial · Cancel anytime · 7-day money-back guarantee</p>

              <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
                <p style="color:#475569;font-size:13px;margin:0;line-height:1.6;text-align:center;">
                  Questions? Just reply to this email — we read every one.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="color:#334155;font-size:12px;margin:0;">
                — The ShortsForgeAI Team<br />
                <a href="${APP_URL}" style="color:#4f46e5;text-decoration:none;">shortsforgeai.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const text = `${greeting}

Welcome to ShortsForgeAI! 🎬

Pick a plan to start generating Shorts — flat monthly price, cancel anytime.
Every Short comes with:
- AI script + neural voiceover pipeline
- Auto-captions engine
- Stock footage library — no camera needed
- Watermark-free MP4 output

👉 See plans & start:
${dashboardUrl}

Two paid plans, flat monthly price. Basic $4.90/mo (50 videos), Pro $9.90/mo (100 videos + Cinematic Mode). 7-day money-back guarantee.

— The ShortsForgeAI Team
shortsforgeai.com`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: '⚡ Your 3-day free trial is waiting — ShortsForgeAI',
        html,
        text,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('[send-welcome] Resend error:', response.status, body)
      return NextResponse.json({ sent: false, error: 'Email provider rejected the request.' })
    }

    const data = await response.json()
    return NextResponse.json({ sent: true, id: data.id })
  } catch (err) {
    console.error('[send-welcome] Unexpected error:', err)
    return NextResponse.json({ sent: false, error: 'Welcome email could not be sent.' })
  }
}
