// Run this in Supabase SQL editor if `video_credits` doesn't exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_credits integer DEFAULT 2;

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Push #299 — 2 free credits on signup (up from 1). Improves activation rate.
const DEFAULT_CREDITS = 2

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('video_credits, free_ai_generate_used, plan')
      .eq('id', user.id)
      .single()

    // feature/ai-avatar CP2 — avatar_credits queried SEPARATELY and best-effort,
    // so the main balance never breaks if this code reaches an environment
    // where the avatar_credits migration hasn't run yet (deploy-order safety).
    let avatarCredits = 0
    let avatarFaceUrl: string | null = null
    {
      const { data: avData, error: avErr } = await supabase
        .from('profiles')
        .select('avatar_credits, avatar_face_url')
        .eq('id', user.id)
        .single()
      if (avErr) {
        // Fix 1 (12/06) — distinguish "migration not deployed yet" (undefined
        // column/table → safe to default to 0) from a REAL transient error.
        // The old catch-all silently told paying users they had 0 avatar
        // credits on any DB/RLS blip. A real error now returns 503 so the
        // client retries instead of rendering a false zero balance.
        // BUGFIX 05/07 (KINEO-CREDITS-503) — a blip on the SECONDARY avatar_credits
        // balance must NEVER 503 the whole endpoint. Returning no `credits` made the
        // generator show a false "out of credits" to users with a real video_credits
        // balance (the modal-with-504-credits bug). Degrade gracefully: keep the main
        // balance, default the avatar add-on to 0.
        console.error('[credits] avatar_credits fetch failed (degrading avatar to 0):', avErr.message)
      } else {
        avatarCredits = (avData as { avatar_credits?: number } | null)?.avatar_credits ?? 0
        // Face-app wave 1 — saved face for the "Use my saved face" one-click flow.
        const face = (avData as { avatar_face_url?: string | null } | null)?.avatar_face_url
        avatarFaceUrl = typeof face === 'string' && face ? face : null
      }
    }

    if (error) {
      // Column may not exist yet — return default safely
      if (error.code === '42703' || error.message?.includes('video_credits')) {
        return NextResponse.json({ credits: DEFAULT_CREDITS, migrationNeeded: true })
      }
      // No row found (new user before profiles row exists) — 0 credits until paid.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ credits: 0 })
      }
      // Don't fall back to DEFAULT_CREDITS on an unknown error — that would hide a
      // real DB failure and let users start a generation they can't actually pay for.
      console.error('[credits GET] db error:', error.code, error.message)
      return NextResponse.json(
        { error: 'Could not load your credit balance. Please retry.' },
        { status: 500 }
      )
    }

    const credits = data?.video_credits ?? DEFAULT_CREDITS
    // #384 — also surface whether the 1 free AI-Generate trial is still available,
    // so the generator can label the AI card "1 free · watermark".
    // #404 — surface the plan + per-engine flags so the generator can show the
    // right engine card unlocked: Starter→Fast, Creator→Seedance, Studio→Kling.
    const planVal = (data?.plan ?? 'free') as string
    const isStarter = planVal === 'starter' || planVal === 'starter_trial'
    const isCreator = planVal === 'basic' || planVal === 'basic_trial'
    const isStudio = planVal === 'pro' || planVal === 'pro_trial'
    return NextResponse.json({
      credits,
      // feature/ai-avatar CP2 — separate premium add-on balance.
      avatarCredits,
      // Face-app wave 1 — last approved face photo (avatar library).
      avatarFaceUrl,
      freeAiUsed: data?.free_ai_generate_used === true,
      plan: planVal,
      isStarter,
      isCreator,
      isStudio,
    })
  } catch (err) {
    console.error('[credits GET] unexpected:', err)
    return NextResponse.json({ credits: 0, error: 'Failed to load credits' }, { status: 500 })
  }
}
