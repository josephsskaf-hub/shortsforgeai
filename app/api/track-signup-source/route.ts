import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// #383 — best-effort signup attribution.
//
// Records, on the user's profiles row:
//   - gclid         (from the client's first-touch sessionStorage, via body)
//   - utm_source    (same)
//   - signup_country(from Vercel's x-vercel-ip-country request header)
//
// CRITICAL: this route must NEVER break the signup flow. It is called
// fire-and-forget (not awaited) from both signup paths. It always returns a
// 200-ish JSON, never throws, and only FILLS columns that are still null
// (first-touch wins — a reload/return visit can never overwrite the original
// attribution, and organic signups simply stay null).
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // No session yet (e.g. email-confirmation flow before sign-in) — nothing to
    // attribute. Not an error for the caller; signup proceeds untouched.
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'no-session' })
    }

    // Parse gclid / utm_source from the body (best-effort; tolerate no/invalid body).
    let gclid: string | null = null
    let utm_source: string | null = null
    // KINEO-SOURCE-TRACK-2026-07-06 — Block 3.3 first-touch acquisition source.
    let signup_utm_source: string | null = null
    let signup_utm_medium: string | null = null
    let signup_utm_campaign: string | null = null
    let signup_referrer: string | null = null
    const clean = (v: unknown, max: number): string | null =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
    try {
      const body = await req.json()
      gclid = clean(body?.gclid, 255)
      utm_source = clean(body?.utm_source, 255)
      signup_utm_source = clean(body?.signup_utm_source, 255)
      signup_utm_medium = clean(body?.signup_utm_medium, 255)
      signup_utm_campaign = clean(body?.signup_utm_campaign, 255)
      signup_referrer = clean(body?.signup_referrer, 300)
    } catch {
      /* no/invalid JSON body — keep nulls */
    }

    // Cookie fallback (KINEO-SOURCE-TRACK-2026-07-06): if the client posted no
    // source fields (e.g. a bare call), recover them from the first-party
    // `kineo_src` cookie the client set on first landing. Survives OAuth.
    if (!signup_utm_source && !signup_utm_medium && !signup_utm_campaign && !signup_referrer) {
      try {
        const raw = req.cookies.get('kineo_src')?.value
        if (raw) {
          const c = JSON.parse(decodeURIComponent(raw)) as {
            utm_source?: string
            utm_medium?: string
            utm_campaign?: string
            referrer?: string
          }
          signup_utm_source = clean(c.utm_source, 255)
          signup_utm_medium = clean(c.utm_medium, 255)
          signup_utm_campaign = clean(c.utm_campaign, 255)
          signup_referrer = clean(c.referrer, 300)
        }
      } catch {
        /* malformed cookie — keep nulls */
      }
    }

    // Country comes from Vercel's edge geo header (already received in prod).
    const signup_country = req.headers.get('x-vercel-ip-country') || null

    // First-touch only: read current values and patch ONLY the columns that are
    // still null AND for which we now have a value. Never overwrite, never null-out.
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'gclid, utm_source, signup_country, signup_utm_source, signup_utm_medium, signup_utm_campaign, signup_referrer'
      )
      .eq('id', user.id)
      .single()

    const patch: Record<string, string> = {}
    if (!profile?.gclid && gclid) patch.gclid = gclid
    if (!profile?.utm_source && utm_source) patch.utm_source = utm_source
    if (!profile?.signup_country && signup_country) patch.signup_country = signup_country
    // KINEO-SOURCE-TRACK-2026-07-06 — Block 3.3: first-touch source columns,
    // only ever filled when still null (a reload/return visit never overwrites).
    if (!profile?.signup_utm_source && signup_utm_source) patch.signup_utm_source = signup_utm_source
    if (!profile?.signup_utm_medium && signup_utm_medium) patch.signup_utm_medium = signup_utm_medium
    if (!profile?.signup_utm_campaign && signup_utm_campaign) patch.signup_utm_campaign = signup_utm_campaign
    if (!profile?.signup_referrer && signup_referrer) patch.signup_referrer = signup_referrer

    if (Object.keys(patch).length > 0) {
      await supabase.from('profiles').update(patch).eq('id', user.id)
    }

    return NextResponse.json({ ok: true, written: Object.keys(patch) })
  } catch (err) {
    // Swallow everything — attribution failures must never surface to the user
    // or break signup. Log for observability only.
    console.error('[track-signup-source] non-fatal:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}
