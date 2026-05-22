// Push #066 — Admin Funnel API route.
// Returns the same data as /admin/funnel/page.tsx but as JSON, so the
// client component can poll every 30 s without a full page reload.
// Gated to the admin emails; everything else gets 403.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type { FunnelData } from '@/app/(dashboard)/admin/funnel/FunnelClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

const EVENT_ALIASES: Record<string, string[]> = {
  homepage_view: ['homepage_view'],
  generate_page_view: ['generate_page_view'],
  analyze_idea_clicked: ['analyze_idea_clicked'],
  video_generation_started: ['video_generation_started', 'generate_started'],
  video_generation_completed: ['video_generation_completed', 'generate_completed'],
  video_generation_failed: ['video_generation_failed', 'generate_failed'],
  pricing_view: ['pricing_view'],
  basic_checkout_clicked: ['basic_checkout_clicked', 'checkout_basic_click'],
  pro_checkout_clicked: ['pro_checkout_clicked', 'checkout_pro_click'],
  payment_success: ['payment_success'],
  checkout_cancelled: ['checkout_cancelled'],
}

async function countByName(
  supabase: SupabaseClient,
  name: string,
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('events')
      .select('id', { head: true, count: 'exact' })
      .eq('name', name)
    if (error) return null
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

async function metricCount(
  supabase: SupabaseClient,
  metricKey: keyof typeof EVENT_ALIASES,
): Promise<number> {
  const names = EVENT_ALIASES[metricKey] ?? [metricKey]
  let total = 0
  for (const n of names) {
    const c = await countByName(supabase, n)
    if (typeof c === 'number') total += c
  }
  return total
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
    const serviceClient: SupabaseClient | null =
      supabaseUrl && serviceKey
        ? createServiceClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null

    let eventsAvailable = true
    const probeClient: SupabaseClient = serviceClient ?? (cookieClient as unknown as SupabaseClient)
    try {
      const probe = await probeClient
        .from('events')
        .select('id', { head: true, count: 'exact' })
        .limit(1)
      if (probe.error) {
        const code = (probe.error as { code?: string }).code ?? ''
        if (code === '42P01' || /does not exist|relation/.test(probe.error.message ?? '')) {
          eventsAvailable = false
        }
      }
    } catch {
      eventsAvailable = false
    }

    const counts: Record<string, number> = {}
    for (const k of Object.keys(EVENT_ALIASES)) {
      counts[k] = eventsAvailable ? await metricCount(probeClient, k) : 0
    }

    const data: FunnelData = {
      eventsAvailable,
      counts: counts as FunnelData['counts'],
    }

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/funnel] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
