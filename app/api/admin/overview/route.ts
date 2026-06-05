// Push #410 — Admin Overview API (one-page dashboard).
// Single round-trip payload for /admin: top KPIs, recent logins, and
// purchase-intent leads (started checkout / has Stripe customer but never
// paid). Service-role only, gated to admin emails, returns ONLY safe fields.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

// Monthly prices in USD for the MRR estimate (matches checkout TIER_PRICES).
const PLAN_PRICE_USD: Record<string, number> = {
  starter: 11.9,
  starter_trial: 11.9,
  basic: 24.9,
  basic_trial: 24.9,
  pro: 37.9,
  pro_trial: 37.9,
}

const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial'])

// Push #417 — keep founder/test/throwaway accounts out of every dashboard
// number so Joseph sees only REAL customers.
function isTestEmail(email: string): boolean {
  const e = email.toLowerCase()
  return (
    e.startsWith('josephsskaf') || // founder accounts incl. typo'd gmai.com + plus-aliases
    e.startsWith('josephskaf') || // hotmail variant
    e.endsWith('@shortsforgeai.com') || // internal accounts (joseph-test, faststest…)
    e.startsWith('test') ||
    e.includes('mailinator') ||
    e.startsWith('smoketest')
  )
}

export async function GET() {
  try {
    const cookieClient = createClient()
    const {
      data: { user },
    } = await cookieClient.auth.getUser()

    const email = user?.email?.toLowerCase() ?? ''
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const since7d = new Date(now - 7 * dayMs).toISOString()
    const since24h = new Date(now - 1 * dayMs).toISOString()

    // ── auth.users (emails, created_at, last_sign_in_at) ────────────────
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) {
      console.error('[admin/overview] listUsers error:', authErr.message)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }
    // Push #417 — drop test/founder accounts from EVERYTHING below.
    const allAuthUsers = authData?.users ?? []
    const excludedIds = new Set(
      allAuthUsers.filter((u) => isTestEmail(u.email ?? '')).map((u) => u.id)
    )
    const authUsers = allAuthUsers.filter((u) => !excludedIds.has(u.id))
    const emailById = new Map<string, string>()
    for (const u of authUsers) emailById.set(u.id, u.email ?? '')

    // ── profiles (plan, credits, stripe customer) ────────────────────────
    const planById = new Map<string, string>()
    const hasStripeById = new Map<string, boolean>()
    const creditsById = new Map<string, number>()
    try {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, plan, stripe_customer_id, video_credits')
      for (const p of (profs ?? []) as Array<{ id: string; plan: string | null; stripe_customer_id: string | null; video_credits: number | null }>) {
        if (excludedIds.has(p.id)) continue // #417 — skip test/founder accounts
        planById.set(p.id, (p.plan ?? 'free').toLowerCase())
        hasStripeById.set(p.id, !!p.stripe_customer_id)
        creditsById.set(p.id, p.video_credits ?? 0)
      }
    } catch (e) {
      console.warn('[admin/overview] profiles query failed:', e)
    }

    // ── videos (totals + first video per user for the activation funnel) ──
    // Push #433 — also aggregate per-user credit spend (Joseph: "quero saber
    // quais vídeos essas pessoas estão fazendo e como o crédito tá sendo
    // gasto"). quality_mode + credits_used live on the videos row.
    let videosTotal = 0
    let videos7d = 0
    const firstVideoByUser = new Map<string, string>() // Push #426
    type VideoLite = { title: string; engine: string; credits: number; at: string | null }
    type Spend = { videosCount: number; creditsSpent: number; fast: number; ai: number; kling: number; other: number; recent: VideoLite[] }
    const spendByUser = new Map<string, Spend>()
    const engineLabel = (q: string | null): 'fast' | 'ai' | 'kling' | 'other' => {
      if (q === 'fast') return 'fast'
      if (q === 'cinematic_ai' || q === 'basic_ai') return 'ai'
      if (q === 'cinematic_kling') return 'kling'
      return 'other' // legacy null/basic/pro rows
    }
    try {
      // #417 — count client-side so test/founder videos are excluded.
      const { data: vids } = await admin
        .from('videos')
        .select('user_id, created_at, title, topic, quality_mode, credits_used')
      for (const v of (vids ?? []) as Array<{
        user_id: string | null
        created_at: string | null
        title: string | null
        topic: string | null
        quality_mode: string | null
        credits_used: number | null
      }>) {
        if (v.user_id && excludedIds.has(v.user_id)) continue
        videosTotal += 1
        if ((v.created_at ?? '') >= since7d) videos7d += 1
        if (v.user_id && v.created_at) {
          const prev = firstVideoByUser.get(v.user_id)
          if (!prev || v.created_at < prev) firstVideoByUser.set(v.user_id, v.created_at)
        }
        if (v.user_id) {
          const s = spendByUser.get(v.user_id) ?? {
            videosCount: 0, creditsSpent: 0, fast: 0, ai: 0, kling: 0, other: 0, recent: [],
          }
          const eng = engineLabel(v.quality_mode)
          s.videosCount += 1
          s.creditsSpent += v.credits_used ?? 0
          s[eng] += 1
          // First non-empty line of title/topic, trimmed for the panel.
          const rawTitle = (v.title || v.topic || '').split('\n').find((l) => l.trim()) ?? ''
          s.recent.push({
            title: rawTitle.replace(/^HOOK:?\s*/i, '').slice(0, 90) || '(untitled)',
            engine: eng,
            credits: v.credits_used ?? 0,
            at: v.created_at,
          })
          spendByUser.set(v.user_id, s)
        }
      }
      // Keep only the 5 most recent videos per user in the payload.
      for (const s of spendByUser.values()) {
        s.recent.sort((a, b) => ((a.at ?? '') < (b.at ?? '') ? 1 : -1))
        s.recent = s.recent.slice(0, 5)
      }
    } catch (e) {
      console.warn('[admin/overview] videos count failed:', e)
    }

    // ── Activation funnel (Push #426) ─────────────────────────────────────
    // Cohort view per signup day (last 14 days): how many signed up, how many
    // of THOSE ever generated a video, how many of those are now paying.
    // Answers "is the green gift banner working?" at a glance.
    const funnel: Array<{ date: string; signups: number; activated: number; paying: number }> = []
    {
      const byDay = new Map<string, { signups: number; activated: number; paying: number }>()
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * dayMs).toISOString().slice(0, 10)
        byDay.set(d, { signups: 0, activated: 0, paying: 0 })
      }
      for (const u of authUsers) {
        const day = (u.created_at ?? '').slice(0, 10)
        const bucket = byDay.get(day)
        if (!bucket) continue
        bucket.signups += 1
        if (firstVideoByUser.has(u.id)) bucket.activated += 1
        if (PAID_PLANS.has(planById.get(u.id) ?? 'free')) bucket.paying += 1
      }
      for (const [date, b] of byDay) funnel.push({ date, ...b })
    }
    const activatedTotal = authUsers.filter((u) => firstVideoByUser.has(u.id)).length

    // ── KPIs ─────────────────────────────────────────────────────────────
    const totalUsers = authUsers.length
    const newUsers7d = authUsers.filter((u) => (u.created_at ?? '') >= since7d).length
    const logins24h = authUsers.filter(
      (u) => ((u as { last_sign_in_at?: string | null }).last_sign_in_at ?? '') >= since24h
    ).length

    let payingByPlan: Record<string, number> = {}
    let mrrUsd = 0
    for (const [, plan] of planById) {
      if (PAID_PLANS.has(plan)) {
        const key = plan.replace('_trial', '')
        payingByPlan[key] = (payingByPlan[key] ?? 0) + 1
        mrrUsd += PLAN_PRICE_USD[plan] ?? 0
      }
    }
    const payingTotal = Object.values(payingByPlan).reduce((a, b) => a + b, 0)

    // ── Subscribers (Push #418 — paying customers and their plan) ────────
    const subscribers = authUsers
      .filter((u) => PAID_PLANS.has(planById.get(u.id) ?? 'free'))
      .map((u) => ({
        email: u.email ?? '',
        plan: planById.get(u.id) ?? 'free',
        credits: creditsById.get(u.id) ?? 0,
        signed_up_at: u.created_at ?? null,
        last_sign_in_at: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      }))
      .sort((a, b) => ((a.signed_up_at ?? '') < (b.signed_up_at ?? '') ? 1 : -1))

    // ── Recent logins (top 20 by last_sign_in_at) ────────────────────────
    const logins = authUsers
      .filter((u) => !!(u as { last_sign_in_at?: string | null }).last_sign_in_at)
      .sort((a, b) => {
        const la = (a as { last_sign_in_at?: string }).last_sign_in_at ?? ''
        const lb = (b as { last_sign_in_at?: string }).last_sign_in_at ?? ''
        return la < lb ? 1 : la > lb ? -1 : 0
      })
      .slice(0, 20)
      .map((u) => {
        // Push #433 — credit X-ray per login: current balance, what they
        // spent and on which engine, plus their 5 most recent videos.
        const s = spendByUser.get(u.id)
        return {
          email: u.email ?? '',
          last_sign_in_at: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
          plan: planById.get(u.id) ?? 'free',
          signed_up_at: u.created_at ?? null,
          credits: creditsById.get(u.id) ?? 0,
          videosCount: s?.videosCount ?? 0,
          creditsSpent: s?.creditsSpent ?? 0,
          engines: { fast: s?.fast ?? 0, ai: s?.ai ?? 0, kling: s?.kling ?? 0, other: s?.other ?? 0 },
          videos: s?.recent ?? [],
        }
      })

    // ── Purchase intent ──────────────────────────────────────────────────
    // Source 1: checkout_abandoned table (started a Stripe checkout that expired)
    type IntentRow = {
      email: string
      kind: 'abandoned_checkout' | 'warm_lead'
      tier: string | null
      amount: string | null
      at: string | null
    }
    const intent: IntentRow[] = []
    const intentEmails = new Set<string>()
    try {
      const { data: aband } = await admin
        .from('checkout_abandoned')
        .select('user_id, tier, currency, amount_total, expired_at')
        .order('expired_at', { ascending: false })
        .limit(30)
      for (const r of (aband ?? []) as Array<{
        user_id: string | null
        tier: string | null
        currency: string | null
        amount_total: number | null
        expired_at: string | null
      }>) {
        const em = r.user_id ? emailById.get(r.user_id) ?? '' : ''
        if (!em) continue
        // skip if they ended up paying
        const plan = r.user_id ? planById.get(r.user_id) ?? 'free' : 'free'
        if (PAID_PLANS.has(plan)) continue
        intent.push({
          email: em,
          kind: 'abandoned_checkout',
          tier: r.tier,
          amount:
            typeof r.amount_total === 'number' && r.currency
              ? `${(r.amount_total / 100).toFixed(2)} ${r.currency.toUpperCase()}`
              : null,
          at: r.expired_at,
        })
        intentEmails.add(em)
      }
    } catch (e) {
      console.warn('[admin/overview] checkout_abandoned query failed:', e)
    }

    // Source 2: warm leads — Stripe customer created but never paid
    for (const u of authUsers) {
      const plan = planById.get(u.id) ?? 'free'
      if (PAID_PLANS.has(plan)) continue
      if (!hasStripeById.get(u.id)) continue
      const em = u.email ?? ''
      if (!em || intentEmails.has(em)) continue
      intent.push({ email: em, kind: 'warm_lead', tier: null, amount: null, at: u.created_at ?? null })
      intentEmails.add(em)
    }
    intent.sort((a, b) => ((a.at ?? '') < (b.at ?? '') ? 1 : -1))

    return NextResponse.json({
      kpis: {
        totalUsers,
        newUsers7d,
        logins24h,
        payingTotal,
        payingByPlan,
        mrrUsd: Math.round(mrrUsd * 100) / 100,
        videosTotal,
        videos7d,
        purchaseIntent: intent.length,
        // Push #426 — overall activation: users who ever generated ≥1 video
        activatedTotal,
        activationRate: totalUsers > 0 ? Math.round((activatedTotal / totalUsers) * 100) : 0,
      },
      logins,
      intent: intent.slice(0, 30),
      subscribers,
      funnel, // Push #426 — 14-day signup cohort funnel
    })
  } catch (err) {
    console.error('[admin/overview] unexpected:', err)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}
