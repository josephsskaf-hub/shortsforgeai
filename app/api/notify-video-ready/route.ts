import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Push #104 — email the user when their video is ready. Mirrors the
// env conventions used by /api/send-welcome (RESEND_API_KEY +
// RESEND_FROM_EMAIL fallback) and the same auth model: the caller must
// be signed in and may only target their own email, so this endpoint
// cannot be turned into a generic spam relay.
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Kineo <support@usekineo.com>'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    let body: { email?: string; videoUrl?: string; topic?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const email = (body.email ?? '').toString()
    const videoUrl = (body.videoUrl ?? '').toString()
    const topic = (body.topic ?? '').toString().slice(0, 200)

    if (!email || !videoUrl) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    // Only let the caller email themselves — prevents this from becoming
    // a "send arbitrary email" endpoint.
    if (email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    if (!RESEND_API_KEY) {
      // Silent success when Resend isn't configured — the route is a
      // best-effort notification, not a hard requirement.
      return NextResponse.json({ ok: true, skipped: true })
    }

    const safeTopic = (topic || 'your topic').replace(/[<>]/g, '')
    const safeVideoUrl = videoUrl.replace(/"/g, '')

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#161618;color:#fff;padding:32px;border-radius:16px;">
        <h1 style="color:#2997ff;font-size:24px;margin:0 0 8px">Your Short is ready! ⚡</h1>
        <p style="color:#94a3b8;margin:0 0 24px">Your AI-generated YouTube Short about "<strong style="color:#fff">${safeTopic}</strong>" is ready to download.</p>
        <a href="${safeVideoUrl}" style="display:inline-block;background:#2997ff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
          ⬇ Download Your Short
        </a>
        <p style="color:#64748b;font-size:12px;margin:24px 0 0">Want a clean export and 24 more Fast Shorts this month? <a href="https://www.usekineo.com/pricing" style="color:#2997ff;">Starter is $4.90 for the first month, then $9.90/month →</a></p>
        <p style="color:#475569;font-size:11px;margin:16px 0 0">Kineo · <a href="https://www.usekineo.com" style="color:#475569;">usekineo.com</a></p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: '⚡ Your Short is ready to download!',
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[notify-video-ready] Resend error:', res.status, text)
      return NextResponse.json({ ok: false })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify-video-ready] unexpected error:', err)
    return NextResponse.json({ ok: false })
  }
}
