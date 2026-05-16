import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserPlan } from '@/lib/plan'

// Push #087 — client-readable plan endpoint. The /generate page calls
// this to decide whether to lock the Cinematic mode card. Returns
// `{ plan: 'free' | 'basic' | 'pro', isPro: boolean }`. Anonymous
// callers see free + isPro=false (UI never tries to show Cinematic to
// signed-out users since the page already redirects to /login).

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ plan: 'free', isPro: false })
    }

    const info = await fetchUserPlan(supabase, user.id)
    return NextResponse.json({ plan: info.tier, isPro: info.isPro })
  } catch (err) {
    console.error('[me/plan] unexpected:', err)
    return NextResponse.json({ plan: 'free', isPro: false })
  }
}
