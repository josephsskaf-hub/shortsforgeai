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
      return NextResponse.json({ plan: 'free', isPro: false, cinematic_tokens: 0 })
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

    return NextResponse.json({
      plan: info.tier,
      isPro: info.isPro,
      cinematic_tokens: cinematicTokens,
    })
  } catch (err) {
    console.error('[me/plan] unexpected:', err)
    return NextResponse.json({ plan: 'free', isPro: false, cinematic_tokens: 0 })
  }
}
