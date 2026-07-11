// KINEO-HOT-UPSELL-2026-07-10 — SNIPER de conversão (meta: 10 pagantes).
// One-off, admin-gated, idempotente via public.events (name='hot_upsell_sent').
// 3 segmentos, MENSAGEM CERTA PRA CADA UM (não é blast genérico):
//   A) Abandonou checkout nas últimas 48h (mostrou o cartão!) → destrava a
//      objeção: KINEO20 (20% off), pack $4.90 como plano B, Apple Pay/Link.
//   B) PQL multi-vídeo (2-7 vídeos gerados, nunca pagou) → provou valor;
//      oferta de menor atrito: pack $4.90/10 vídeos + KINEO20 pra plano.
//   C) Abhijeet (cliente $200/mês vindo do funil) → pessoal: as 2 features
//      que ELE pediu (footage próprio + voz própria) foram construídas HOJE.
// GET sem params = DRY RUN · ?confirm=SEND = dispara (respeita Resend 100/dia
// — este lote tem ~15, cabe na sobra de hoje).
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

const FROM_EMAIL = 'Joseph at Kineo <joseph@usekineo.com>'
const REPLY_TO = 'joseph@usekineo.com'
const PRICING = 'https://usekineo.com/pricing?promo=KINEO20&utm_source=hot_upsell'
const AVATAR = 'https://usekineo.com/avatar?utm_source=hot_upsell'

type Target = { email: string; segment: 'abandon' | 'pql'; videos?: number }

// Lista curada 10/07 do banco: abandonos 48h + PQLs ativos (disposables e
// internos já filtrados na curadoria).
const TARGETS: Target[] = [
  // A — abandonou checkout (48h)
  { email: 'asdurr987@gmail.com', segment: 'abandon', videos: 3 },
  { email: 'ducnamnguyen99n@gmail.com', segment: 'abandon' },
  { email: 'rohitsarkar44777@gmail.com', segment: 'abandon', videos: 5 },
  { email: 'toodletwirl@gmail.com', segment: 'abandon' },
  { email: 'arikcarikc4@gmail.com', segment: 'abandon' },
  { email: 'fatimakhan1558@gmail.com', segment: 'abandon' },
  { email: 'sudumoni65@gmail.com', segment: 'abandon' },
  { email: 'goudarun336@gmail.com', segment: 'abandon' },
  // B — PQL multi-vídeo sem abandono
  { email: 'nooributter+1@gmail.com', segment: 'pql', videos: 7 },
  { email: 'thesuccesscodesofficial@gmail.com', segment: 'pql', videos: 5 },
  { email: 'mikewesser@gmail.com', segment: 'pql', videos: 4 },
  { email: 'michaelnyanje75@gmail.com', segment: 'pql', videos: 2 },
  { email: 'pertrovicluka@gmail.com', segment: 'pql', videos: 2 },
  { email: 'robertposton007@gmail.com', segment: 'pql', videos: 5 },
]

const ABHIJEET = 'abhijeetgoel77@gmail.com'

function abandonHtml(videos?: number): { subject: string; html: string } {
  return {
    subject: "Your Kineo checkout didn't go through — here's 20% off",
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
  <p>Hey — Joseph here, founder of <b>Kineo</b>.</p>
  <p>I saw a checkout from your account that didn't finish${typeof videos === 'number' && videos > 0 ? ` — and that you've already made ${videos} video${videos === 1 ? '' : 's'} with us` : ''}. If something got in the way, two things that might help:</p>
  <p><b>1) 20% off any plan</b> with code <b>KINEO20</b> (applies automatically):<br/>
  <a href="${PRICING}" style="color:#2997ff;font-weight:bold">usekineo.com/pricing → KINEO20 applied</a></p>
  <p><b>2) No subscription?</b> The $4.90 pack = 10 videos, credits never expire.</p>
  <p>And since you last looked, Kineo got a big upgrade: <b>AI Presenter</b> (talking host with perfect lip-sync), <b>Character Lock</b> (same face in every video), and you can now use <b>your own footage and your own voice</b>.</p>
  <p>Card being rejected? We also take <b>Apple Pay and Link</b> at checkout. Or just reply — I'll sort it personally.</p>
  <p>— Joseph, founder · Kineo</p>
</div>`,
  }
}

function pqlHtml(videos?: number): { subject: string; html: string } {
  const n = typeof videos === 'number' && videos > 0 ? videos : 2
  return {
    subject: `You've made ${n} videos on Kineo — the cheapest way to keep going`,
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
  <p>Hey — Joseph here, founder of <b>Kineo</b>.</p>
  <p>You've made <b>${n} video${n === 1 ? '' : 's'}</b> with us — you clearly get the workflow. Here's the cheapest way to keep the momentum:</p>
  <p style="font-size:17px"><b>10 videos for $4.90, one-time.</b> No subscription, watermark-free, credits never expire.</p>
  <p style="margin:22px 0">
    <a href="${PRICING}" style="background:#2997ff;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Get 10 videos for $4.90 →</a>
  </p>
  <p>Want a plan instead? Code <b>KINEO20</b> gives 20% off any tier. And everything new is included: <b>AI Presenter</b> (talking host), <b>Character Lock</b> (same face every video), <b>your own footage &amp; voice</b>.</p>
  <p>Reply anytime — I read every email.</p>
  <p>— Joseph, founder · Kineo</p>
</div>`,
  }
}

function abhijeetHtml(): { subject: string; html: string } {
  return {
    subject: 'You asked for own footage + own voice — I built both today',
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
  <p>Hey Abhijeet — Joseph here, founder of Kineo.</p>
  <p>Your two requests from today are <b>live in your account right now</b>:</p>
  <p><b>🎬 Your own footage:</b> on the Generate page you'll find "My footage" — upload your photos/clips and the scenes use THEM (stock only fills the gaps). Your script is narrated word-for-word with "Use my script as is".</p>
  <p><b>🎙️ Your own voice:</b> upload a ready voiceover (MP3/WAV) and we skip the AI narrator entirely — captions sync to YOUR audio. Or record ~1 min in the AI Presenter page and every video can speak in your cloned voice.</p>
  <p>Both are included on any paid plan. Since you asked for them, here's <b>20% off</b>: code <b>KINEO20</b> —
  <a href="${PRICING}" style="color:#2997ff;font-weight:bold">Creator comes out to $19.92/mo</a> (150 credits, 1 Hollywood film included).</p>
  <p style="margin:22px 0">
    <a href="${AVATAR}" style="background:#2997ff;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Try it now →</a>
  </p>
  <p>Anything else you need for Bahi Khata's videos, reply here — requests from you ship fast, as you can see. 🙂</p>
  <p>— Joseph, founder · Kineo</p>
</div>`,
  }
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

    const admin = adminClient()

    // Idempotência: pula quem já recebeu (events.name='hot_upsell_sent') ou
    // quem JÁ PAGOU desde a curadoria (nunca fazer upsell pra pagante).
    const { data: sentRows } = await admin
      .from('events')
      .select('metadata')
      .eq('name', 'hot_upsell_sent')
    const alreadySent = new Set(
      (sentRows ?? []).map((r) => {
        try { return ((r as { metadata: { email?: string } }).metadata?.email ?? '').toLowerCase() } catch { return '' }
      }),
    )
    const allEmails = [...TARGETS.map((t) => t.email), ABHIJEET]
    const { data: paidRows } = await admin
      .from('profiles')
      .select('email, has_paid, plan')
      .in('email', allEmails)
    const paidSet = new Set(
      (paidRows ?? [])
        .filter((r) => (r as { has_paid: boolean }).has_paid === true)
        .map((r) => ((r as { email: string }).email ?? '').toLowerCase()),
    )

    const queue: Array<{ email: string; subject: string; html: string; segment: string }> = []
    for (const t of TARGETS) {
      const e = t.email.toLowerCase()
      if (alreadySent.has(e) || paidSet.has(e)) continue
      const tpl = t.segment === 'abandon' ? abandonHtml(t.videos) : pqlHtml(t.videos)
      queue.push({ email: t.email, subject: tpl.subject, html: tpl.html, segment: t.segment })
    }
    if (!alreadySent.has(ABHIJEET) && !paidSet.has(ABHIJEET)) {
      const tpl = abhijeetHtml()
      queue.push({ email: ABHIJEET, subject: tpl.subject, html: tpl.html, segment: 'abhijeet' })
    }

    const confirm = req.nextUrl.searchParams.get('confirm') === 'SEND'
    if (!confirm) {
      return NextResponse.json({
        mode: 'DRY_RUN',
        queued: queue.length,
        by_segment: {
          abandon: queue.filter((q) => q.segment === 'abandon').length,
          pql: queue.filter((q) => q.segment === 'pql').length,
          abhijeet: queue.filter((q) => q.segment === 'abhijeet').length,
        },
        recipients: queue.map((q) => `${q.segment}: ${q.email}`),
        hint: 'Append ?confirm=SEND to fire.',
      })
    }

    let sent = 0
    let failed = 0
    for (const q of queue) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, to: [q.email], reply_to: REPLY_TO, subject: q.subject, html: q.html }),
        })
        if (res.ok) {
          sent += 1
          await admin.from('events').insert({ name: 'hot_upsell_sent', metadata: { email: q.email.toLowerCase(), segment: q.segment } })
        } else {
          failed += 1
          console.error(`[hot-upsell] resend failed for ${q.email}:`, await res.text())
        }
      } catch (e) {
        failed += 1
        console.error(`[hot-upsell] send threw for ${q.email}:`, e instanceof Error ? e.message : String(e))
      }
      await new Promise((r) => setTimeout(r, 700))
    }

    console.log(`[hot-upsell] done: sent=${sent} failed=${failed}`)
    return NextResponse.json({ mode: 'SENT', sent, failed })
  } catch (err) {
    console.error('[hot-upsell] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
