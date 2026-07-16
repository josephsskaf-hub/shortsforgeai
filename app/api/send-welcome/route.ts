import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = 'https://www.usekineo.com'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Kineo <support@usekineo.com>'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name, activationPath } = await request.json()

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
    const safeActivationPath =
      typeof activationPath === 'string' &&
      activationPath.startsWith('/') &&
      !activationPath.startsWith('//')
        ? activationPath
        : '/generate?welcome=1'
    const dashboardUrl = `${APP_URL}${safeActivationPath}`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Create your first Kineo Short</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:38px;height:38px;border-radius:12px;background:#2997ff;display:inline-flex;align-items:center;justify-content:center;font-size:18px;text-align:center;">⚡</div>
                <span style="font-size:20px;font-weight:900;color:#f5f5f7;letter-spacing:-0.5px;">Kineo</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#161618;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">
              <p style="color:#e2e8f0;font-size:18px;font-weight:700;margin:0 0 6px;">${greeting}</p>
              <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;line-height:1.6;">Your account is ready. Your first AI Short is one click away.</p>

              <!-- hero benefit box -->
              <div style="background:rgba(41,151,255,0.08);border:1px solid rgba(41,151,255,0.28);border-radius:14px;padding:20px 24px;margin-bottom:28px;text-align:center;">
                <p style="color:#2997ff;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">UP TO 3 FAST VIDEOS / 24H — NO CARD</p>
                <p style="color:#f1f5f9;font-size:28px;font-weight:900;margin:0 0 4px;letter-spacing:-0.5px;">See your idea become a Short</p>
                <p style="color:#64748b;font-size:13px;margin:0;">Script, voice, footage and captions — automatically.</p>
              </div>

              <!-- feature list -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">AI writes your script + voiceover in seconds</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Auto-captions — no editing skill needed</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Stock footage library — no camera needed</span></td></tr>
                <tr><td style="padding:7px 0;"><span style="color:#34d399;margin-right:10px;font-size:16px;">✓</span><span style="color:#e2e8f0;font-size:14px;font-weight:600;">Watch the finished preview before deciding to pay</span></td></tr>
              </table>

              <!-- single CTA button -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display:inline-block;background:#2997ff;color:#ffffff;font-size:17px;font-weight:900;text-decoration:none;padding:18px 48px;border-radius:14px;letter-spacing:0.01em;box-shadow:0 6px 28px rgba(41,151,255,0.45);">
                      Create My First Short →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align:center;color:#475569;font-size:12px;margin:0 0 28px;">Free videos include a Kineo watermark · Start with any idea</p>

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
                — The Kineo Team<br />
                <a href="${APP_URL}" style="color:#2997ff;text-decoration:none;">usekineo.com</a>
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

Your Kineo account is ready. Create, watch, download and share up to 3 watermarked Fast videos every 24 hours — no card required.

Your Short includes:
- AI script + neural voiceover pipeline
- Auto-captions engine
- Stock footage library — no camera needed
- A finished preview before you decide to pay

👉 Create your first Short:
${dashboardUrl}

— The Kineo Team
usekineo.com`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: '🎬 Create your first Kineo Short — no card needed',
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
