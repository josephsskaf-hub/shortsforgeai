// Push #087 — single source of truth for "what plan tier is this user on?"
// used by server routes (gating Cinematic/Runway to Pro) and the client
// (locking the Cinematic card and upgrade prompts).
//
// Reads from public.profiles. The schema has both `plan` (TEXT — 'free'
// | 'basic' | 'pro') and `is_pro` (BOOLEAN). We trust `plan` first; if
// the column is missing or empty we fall back to `is_pro`, then to a
// credit-balance heuristic so the gate degrades gracefully on legacy
// rows that pre-date the plan column.

import type { SupabaseClient } from '@supabase/supabase-js'

export type PlanTier = 'free' | 'basic' | 'pro'

export interface PlanInfo {
  tier: PlanTier
  isPro: boolean
}

// Fallback thresholds for legacy rows that have no `plan` and no `is_pro`
// signal. Tuned to the new 50/100 grant model: Pro grants 100, Basic
// grants 50, Free starts at 2. Anyone with >50 credits must be Pro
// (Basic can't exceed its grant). Anyone with >2 credits is at least Basic
// (Free maxes out at 2).
const PRO_CREDIT_THRESHOLD = 51
const BASIC_CREDIT_THRESHOLD = 3

export async function fetchUserPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanInfo> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, is_pro, video_credits')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { tier: 'free', isPro: false }
    console.warn('[plan] profile fetch failed, defaulting to free:', error.message)
    return { tier: 'free', isPro: false }
  }

  const row = (data ?? {}) as { plan?: string | null; is_pro?: boolean | null; video_credits?: number | null }
  const planRaw = (row.plan ?? '').toString().toLowerCase().trim()

  if (planRaw === 'pro') return { tier: 'pro', isPro: true }
  if (planRaw === 'basic') return { tier: 'basic', isPro: false }
  if (planRaw === 'free') return { tier: 'free', isPro: false }

  if (row.is_pro === true) return { tier: 'pro', isPro: true }

  const credits = typeof row.video_credits === 'number' ? row.video_credits : 0
  if (credits >= PRO_CREDIT_THRESHOLD) return { tier: 'pro', isPro: true }
  if (credits >= BASIC_CREDIT_THRESHOLD) return { tier: 'basic', isPro: false }
  return { tier: 'free', isPro: false }
}
