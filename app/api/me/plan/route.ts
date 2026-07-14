import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserPlan } from '@/lib/plan'

// Push #087 — client-readable plan endpoint. The /generate page calls
// this to decide whether to lock the Cinematic mode card. Returns
// `{ plan: 'free' | 'basic' | 'pro', isPro: boolean, cinematic_tokens }`.
// Push #088 added `cinematic_tokens` so the Generate UI can render the
// "1 token / 0 tokens left" badge without a second roundtrip. Anonymous
// callers see free + isPro=false (UI never tries to show Cinematic to
// signed-out users since the page already redirects to /login).

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      // KINEO-TAAFT-REVIEW-2026-07-14 — signup_utm_source added to every
      // response shape so client parsing never sees an undefined key.
      return NextResponse.json({ plan: 'free', isPro: false, cinematic_tokens: 0, signup_utm_source: null })
    }

    const info = await fetchUserPlan(supabase, user.id)

    // Read cinematic_tokens directly so the response is exact even on
    // environments where the column is missing (we degrade to 0 silently).
    let cinematicTokens = 0
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('cinematic_tokens')
        .eq('id', user.id)
        .single()
      if (!error && data && typeof data.cinematic_tokens === 'number') {
        cinematicTokens = data.cinematic_tokens
      }
    } catch (e) {
      // Column might not exist yet on a stale staging env — keep 0.
      console.warn('[me/plan] cinematic_tokens read failed:', e instanceof Error ? e.message : String(e))
    }

    // KINEO-TAAFT-REVIEW-2026-07-14 — TAAFT is our #1 signup channel (~72%)
    // but our listing rating is the growth lever, so the Generate page needs
    // to know WHERE this user signed up from to show the post-render review
    // ask. Read in its OWN try/catch + separate query so a missing column on
    // a stale env can never break the cinematic_tokens read above — we just
    // degrade to null and the review card silently never renders.
    let signupUtmSource: string | null = null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('signup_utm_source')
        .eq('id', user.id)
        .single()
      if (!error && data && typeof data.signup_utm_source === 'string' && data.signup_utm_source) {
        signupUtmSource = data.signup_utm_source
      }
    } catch (e) {
      console.warn('[me/plan] signup_utm_source read failed:', e instanceof Error ? e.message : String(e))
    }

    return NextResponse.json({
      plan: info.tier,
      isPro: info.isPro,
      cinematic_tokens: cinematicTokens,
      signup_utm_source: signupUtmSource,
    })
  } catch (err) {
    console.error('[me/plan] unexpected:', err)
    return NextResponse.json({ plan: 'free', isPro: false, cinematic_tokens: 0, signup_utm_source: null })
  }
}
