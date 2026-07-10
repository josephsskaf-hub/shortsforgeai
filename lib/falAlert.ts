// KINEO-FAL-ALERT-LIB-2026-07-10 — shared fal-balance alarm.
// Extracted from generate-video-cinematic (KINEO-FAL-ALARM-2026-07-06) so the
// AVATAR-family engines (Presenter/VEED/OmniHuman/Animate/Gesture matte) also
// alert the founder when fal reports an exhausted balance. Incident 10/07:
// fal hit $0 and the Avatar Studio only showed a generic 502 — no e-mail, no
// signal, while every AI engine was down in prod.
// Fire-and-forget, throttled to once per 30 min per lambda instance.

export function looksExhausted(e: { status?: number; message?: string; body?: unknown }): boolean {
  const blob = `${e?.message ?? ''} ${JSON.stringify(e?.body ?? '')}`.toLowerCase()
  return e?.status === 403 || /exhaust|locked|insufficient|balance|quota|payment/.test(blob)
}

let LAST_FAL_ALERT = 0

export async function alertFalExhausted(context: string): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key || key === 'your_resend_api_key_here') return
    const now = Date.now()
    if (now - LAST_FAL_ALERT < 30 * 60 * 1000) return
    LAST_FAL_ALERT = now
    const from = process.env.RESEND_FROM_EMAIL || 'Kineo <support@usekineo.com>'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: ['josephsskaf@gmail.com'],
        subject: '🚨 Kineo: fal.ai balance EXHAUSTED — AI videos are failing',
        text: `The fal.ai balance is exhausted — AI renders are failing RIGHT NOW.\n\nContext: ${context}\nTime: ${new Date().toISOString()}\n\nRecharge fal.ai to restore AI generation: https://fal.ai/dashboard/billing`,
      }),
    })
    console.error('[fal-alert] FAL BALANCE EXHAUSTED — founder alerted')
  } catch (e) {
    console.error('[fal-alert] alert email failed:', e instanceof Error ? e.message : String(e))
  }
}
