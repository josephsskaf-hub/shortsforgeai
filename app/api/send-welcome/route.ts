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
  <title>Welcome to ShortsForgeAI</title>
</head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#3B82F6,#2563EB);display:inline-flex;align-items:center;justify-content:center;font-size:20px;line-height:40px;text-align:center;">⚡</div>
                <span style="font-size:20px;font-weight:900;background:linear-gradient(135deg,#60A5FA,#22D3EE);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px;">ShortsForgeAI</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#13131f;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px;">
              <p style="color:#e2e8f0;font-size:18px;font-weight:700;margin:0 0 8px;">${greeting}</p>
              <p style="color:#94a3b8;font-size:15px;margin:0 0 28px;line-height:1.6;">Welcome to <strong style="color:#c7d2fe;">ShortsForgeAI</strong> 🎬</p>
              <div style="background:rgba(59, 130, 246,0.12);border:1px solid rgba(59, 130, 246,0.25);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <p style="color:#60A5FA;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 8px;">⚡ Pick your plan to start</p>
                <p style="color:#c7d2fe;font-size:24px;font-weight:900;margin:0 0 4px;">From $4.90/month</p>
                <p style="color:#64748b;font-size:13px;margin:0;line-height:1.5;">50 Fast Mode videos on Basic, 100 + Cinematic Mode on Pro. 7-day money-back guarantee.</p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                <tr><td style="padding:6px 0;"><span style="color:#34d399;margin-right:8px;">✓</span><span style="color:#94a3b8;font-size:14px;">AI script + neural voiceover pipeline</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#34d399;margin-right:8px;">✓</span><span style="color:#94a3b8;font-size:14px;">Auto-captions engine</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#34d399;margin-right:8px;">✓</span><span style="color:#94a3b8;font-size:14px;">Stock footage library — no camera needed</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#34d399;margin-right:8px;">✓</span><span style="color:#94a3b8;font-size:14px;">Watermark-free MP4 output</span></td></tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.01em;box-shadow:0 4px 22px rgba(59, 130, 246,0.4);">
                      👉 See plans &amp; start
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px 20px;">
                <p style="color:#475569;font-size:13px;margin:0;line-height:1.6;">
                  Two paid plans, flat monthly price. Basic <strong style="color:#60A5FA;">$4.90/mo</strong> (50 videos / mo), Pro <strong style="color:#60A5FA;">$9.90/mo</strong> (100 videos / mo + priority queue). Cancel anytime.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
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
        subject: '⚡ Welcome to ShortsForgeAI — pick your plan',
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
    return NextRes