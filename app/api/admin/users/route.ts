// Push #065 — Admin Users List API.
// Server-only endpoint that joins auth.users (via service role) with
// public.videos and public.profiles to produce a sanitised list of
// users for the /admin/users page. Returns ONLY safe fields — no
// password hashes, no refresh tokens, no provider identity payloads.
// Gated to the two admin emails; everyone else gets a 403.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

interface AdminUserRow {
  id: string
  email: string
  name: string | null
  created_at: string
  credits: number | null
  videos_count: number
  last_video_at: string | null
  plan: string | null
  // Push #274 — true when a Stripe customer record was created but the user
  // never completed checkout (plan is still free/null). These are warm leads.
  checkout_abandoned: boolean
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
      return NextResponse.json(
        { error: 'Service role not configured', users: [] },
        { status: 500 }
      )
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // auth.users — service role required. listUsers caps at 1000/page;
    // 500 keeps the payload manageable while covering staging today.
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
      perPage: 500,
    })
    if (authErr) {
      console.error('[admin/users] auth.listUsers error:', authErr.message)
      return NextResponse.json(
        { error: 'Failed to list users', users: [] },
        { status: 500 }
      )
    }
    const authUsers = authData?.users ?? []

    // Per-user video aggregates. Single round-trip — we collapse client-side.
    const videoCounts = new Map<string, number>()
    const lastVideoAt = new Map<string, string>()
    try {
      const { data: vids, error: vErr } = await admin
        .from('videos')
        .select('user_id, created_at')
      if (!vErr && Array.isArray(vids)) {
        for (const row of vids as Array<{ user_id: string | null; created_at: string | null }>) {
          if (!row.user_id) continue
          videoCounts.set(row.user_id, (videoCounts.get(row.user_id) ?? 0) + 1)
          const prev = lastVideoAt.get(row.user_id)
          if (row.created_at && (!prev || row.created_at > prev)) {
            lastVideoAt.set(row.user_id, row.created_at)
          }
        }
      }
    } catch (e) {
      // videos table missing — leave maps empty
      console.warn('[admin/users] videos query failed:', e)
    }

    // Profile metadata (credits + plan + stripe_customer_id). Probe gracefully.
    const credits = new Map<string, number | null>()
    const plans = new Map<string, string | null>()
    const hasStripeCustomer = new Map<string, boolean>()
    try {
      const { data: profs, error: pErr } = await admin
        .from('profiles')
        .select('id, video_credits, plan, is_pro, stripe_customer_id')
      if (!pErr && Array.isArray(profs)) {
        for (const row of profs as Array<{
          id: string
          video_credits: number | null
          plan: string | null
          is_pro: boolean | null
          stripe_customer_id: string | null
        }>) {
          if (typeof row.video_credits === 'number') credits.set(row.id, row.video_credits)
          else credits.set(row.id, null)
          const planLabel = row.plan ?? (row.is_pro ? 'pro' : null)
          plans.set(row.id, planLabel)
          hasStripeCustomer.set(row.id, !!row.stripe_customer_id)
        }
      } else if (pErr) {
        // Retry without optional columns if they're missing
        const { data: profsBasic } = await admin
          .from('profiles')
          .select('id, is_pro')
        if (Array.isArray(profsBasic)) {
          for (const row of profsBasic as Array<{ id: string; is_pro: boolean | null }>) {
            credits.set(row.id, null)
            plans.set(row.id, row.is_pro ? 'pro' : null)
          }
        }
      }
    } catch (e) {
      console.warn('[admin/users] profiles query failed:', e)
    }

    // Whitelist the fields we return. No tokens, no hashes, no raw provider
    // data — only what the admin table needs.
    const users: AdminUserRow[] = authUsers.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>
      const rawMeta = ((u as unknown as { raw_user_meta_data?: Record<string, unknown> })
        .raw_user_meta_data ?? {}) as Record<string, unknown>
      const name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        (typeof rawMeta.full_name === 'string' && rawMeta.full_name) ||
        (typeof rawMeta.name === 'string' && rawMeta.name) ||
        null
      return {
        id: u.id,
        email: u.email ?? '',
        name: name || null,
        created_at: u.created_at ?? '',
        credits: credits.has(u.id) ? credits.get(u.id) ?? null : null,
        videos_count: videoCounts.get(u.id) ?? 0,
        last_video_at: lastVideoAt.get(u.id) ?? null,
        plan: plans.get(u.id) ?? null,
        // checkout_abandoned = has Stripe customer but no paid plan
        checkout_abandoned: (() => {
          const hasCx = hasStripeCustomer.get(u.id) ?? false
          const p = (plans.get(u.id) ?? '').toLowerCase()
          const isPaid = p === 'pro' || p === 'basic'
          return hasCx && !isPaid
        })(),
      }
    })

    // Newest first by created_at.
    users.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[admin/users] unexpected:', err)
    return NextResponse.json(
      { error: 'Failed to load users', users: [] },
      { status: 500 }
    )
  }
}
