import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// #456 — saves an exit-intent lead to `leads`.
// #461 — Measure 2 (lead nurture): on a NEW lead, instantly emails the lead
// magnet (the 10 viral ideas) + a truthful free-Fast CTA via Resend.
// Turns a captured email into an activated signup. Best-effort: a send failure
// never breaks the capture.
export const dynamic = 'force-dynamic'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = 'Kineo Team <hello@usekineo.com>'
const APP_URL = 'https://www.usekineo.com'

const VIRAL_IDEAS = [
  'The island so dangerous it is illegal to visit (Snake Island)',
  'The deepest hole humans ever dug — and why they sealed it',
  'The colony that vanished overnight, leaving one word (Roanoke)',
  'How tiny Monaco became the richest place on Earth',
  'The Roman city frozen in time by a volcano (Pompeii)',
  'The radio signal from deep space that repeats every 16 days',
  'The city built in the desert with no rivers (Dubai)',
  'The 5 richest people and their strangest daily habits',
  'The abandoned Soviet city you can still walk through (Chernobyl)',
  'The mountain so tall planes fly around it, not over it',
]

async function sendLeadMagnet(email: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[lead-capture] RESEND_API_KEY not set — skipping magnet email')
    return
  }
  const url = `${APP_URL}/signup?utm_source=lead_magnet&utm_medium=email&utm_campaign=viral_ideas_activation`
  const list = VIRAL_IDEAS.map((idea, i) => `${i + 1}. ${idea}`).join('\n')
  const text = `Hey,

Here are your 10 viral Short ideas — pick any one and you have a video in 60 seconds:

${list}

Want to turn one into a real Short right now? Type it into Kineo and the AI writes the script, voiceover, captions and finds the footage. Create up to 3 watermarked Fast videos every 24 hours — no card needed.

Make a Fast video: ${url}

— Kineo Team
usekineo.com`

  const ideasHtml = VIRAL_IDEAS.map(
    (idea, i) =>
      `<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.5;"><b>${i + 1}.</b> ${idea}</p>`,
  ).join('')
  const html = `
<div style="font-family:Arial,sans-serif;color:#111;">
  <p style="font-size:15px;">Hey,</p>
  <p style="font-size:15px;">Here are your <b>10 viral Short ideas</b> — pick any one and you have a video in 60 seconds:</p>
  ${ideasHtml}
  <p style="font-size:15px;margin-top:16px;">Want to turn one into a real Short right now? Type it into Kineo — the AI writes the script, voiceover, captions and finds the footage. <b>Create up to 3 watermarked Fast videos every 24 hours, no card needed.</b></p>
  <p style="margin:20px 0;">
    <a href="${url}" style="background:#2997ff;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;display:inline-block;">Make a Fast video →</a>
  </p>
  <p style="font-size:13px;color:#555;">— Kineo Team<br/>usekineo.com</p>
</div>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        reply_to: 'hello@usekineo.com',
        subject: 'Your 10 viral Short ideas 🎬',
        text,
        html,
      }),
    })
  } catch (err) {
    console.error('[lead-capture] magnet email failed:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const raw = typeof body?.email === 'string' ? body.email : ''
    const email = raw.trim().toLowerCase()
    if (!email || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[lead-capture] Supabase service env missing')
      return NextResponse.json({ ok: true, saved: false })
    }

    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const country = req.headers.get('x-vercel-ip-country') ?? null
    const source = typeof body?.source === 'string' ? body.source.slice(0, 60) : 'unknown'
    const magnet = typeof body?.magnet === 'string' ? body.magnet.slice(0, 60) : null

    const { error } = await admin
      .from('leads')
      .insert({ email, source, magnet, signup_country: country })

    const isNewLead = !error
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error('[lead-capture] insert error:', error.message)
    }

    // #461 — only email on a brand-new lead (never re-spam a returning one).
    if (isNewLead) {
      await sendLeadMagnet(email)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[lead-capture] error:', msg)
    return NextResponse.json({ ok: true, saved: false })
  }
}
