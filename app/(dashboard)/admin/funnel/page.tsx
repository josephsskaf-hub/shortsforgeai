// Push #061 — Conversion Funnel Dashboard.
// Server-rendered counts pulled from public.events via the staging
// Supabase project (service role when available, falling back to the
// cookie-scoped client). Gated to the two admin emails — anyone else
// gets a plain "Access denied" card. The page never crashes if the
// public.events table is missing — every metric just shows as 0.

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import FunnelClient, { type FunnelData } from './FunnelClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

// Each metric is the sum of one or more event names. Legacy push-#060
// names are aliased onto the new push-#061 names so the dashboard keeps
// reporting accurate totals through the rollout.
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

export default async function AdminFunnelPage() {
  const cookieClient = createClient()
  const {
    data: { user },
  } = await cookieClient.auth.getUser()

  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !ADMIN_EMAILS.has(email)) {
    return <FunnelClient denied />
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const serviceClient: SupabaseClient | null =
    supabaseUrl && serviceKey
      ? createServiceClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  // Probe events table availability. If it's missing we still render the
  // funnel with all-zero counts and a banner explaining the situation.
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

  // Zero out everything if the table isn't present.
  const counts: Record<string, number> = {}
  for (const k of Object.keys(EVENT_ALIASES)) {
    counts[k] = eventsAvailable ? await metricCount(probeClient, k) : 0
  }

  const data: FunnelData = {
    eventsAvailable,
    counts: counts as FunnelData['counts'],
  }

  return <FunnelClient data={data} viewerEmail={email} />
}
