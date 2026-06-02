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
    try {
      const body = await req.json()
      if (typeof body?.gclid === 'string' && body.gclid.trim()) {
        gclid = body.gclid.trim().slice(0, 255)
      }
      if (typeof body?.utm_source === 'string' && body.utm_source.trim()) {
        utm_source = body.utm_source.trim().slice(0, 255)
      }
    } catch {
      /* no/invalid JSON body — keep nulls */
    }

    // Country comes from Vercel's edge geo header (already received in prod).
    const signup_country = req.headers.get('x-vercel-ip-country') || null

    // First-touch only: read current values and patch ONLY the columns that are
    // still null AND for which we now have a value. Never overwrite, never null-out.
    const { data: profile } = await supabase
      .from('profiles')
      .select('gclid, utm_source, signup_country')
      .eq('id', user.id)
      .single()

    const patch: Record<string, string> = {}
    if (!profile?.gclid && gclid) patch.gclid = gclid
    if (!profile?.utm_source && utm_source) patch.utm_source = utm_source
    if (!profile?.signup_country && signup_country) patch.signup_country = signup_country

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
