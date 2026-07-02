// AUTO-REFUND (TAAFT reviewer feedback) — when a render FAILS after credits
// were debited, give them back automatically instead of routing the user to
// support. All refunds go through the refund_render_credits SQL function
// (SECURITY DEFINER, service_role-only), which claims the credit_debits row
// with a conditional UPDATE (WHERE refunded_at IS NULL ... RETURNING) — the
// same race-safe pattern as referral qualify — so a render can NEVER be
// refunded twice, no matter how many polls/tabs/crons race.
//
// Ledger key conventions (credit_debits.render_id):
//   <creatomate-id>        — main pipeline (compose/status, debit on SUCCESS)
//   animate-<falRequestId> — Animate feature (upfront debit)
//   legacy-<creatomate-id> — legacy /api/render path (upfront debit)
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[refund] service-role env missing — refunds disabled')
    return null
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Refund whatever was debited for this render (video OR avatar credits —
 * the ledger row's `kind` decides which balance gets the credits back).
 * Idempotent: returns the amount refunded, or 0 when there is no debit for
 * this render or it was already refunded. Never throws.
 */
export async function refundRenderCredits(renderId: string): Promise<number> {
  const id = (renderId ?? '').trim()
  if (!id) return 0
  const db = adminClient()
  if (!db) return 0
  try {
    const { data, error } = await db.rpc('refund_render_credits', { p_render: id })
    if (error) {
      console.error(`[refund] RPC error render=${id}:`, error.message)
      return 0
    }
    const amount = typeof data === 'number' ? data : 0
    if (amount > 0) {
      console.log(`[refund] auto-refunded ${amount} credits for render=${id}`)
    }
    return amount
  } catch (e) {
    console.error(`[refund] threw render=${id}:`, e instanceof Error ? e.message : String(e))
    return 0
  }
}

/**
 * Daily sweep (called from an existing daily cron — Vercel Hobby silently
 * rejects deploys when crons exceed the plan limits, so we piggyback instead
 * of adding an entry to vercel.json): find `video` debits older than 2h that
 * never produced a `videos` row (a SUCCESS row always carries render_id — the
 * #357 hard guarantee) and refund them.
 *
 * Excluded on purpose:
 *   animate-% — Animate clips never persist to `videos`, so "no videos row"
 *               is their NORMAL success state; sweeping them would refund
 *               successful clips. Their failures are refunded live by
 *               /api/avatar-status instead.
 *   legacy-%  — same reason: the legacy /api/render path never persists to
 *               `videos`. Its failures are refunded live by /api/render/[id].
 */
export async function sweepStuckRenderDebits(): Promise<{
  scanned: number
  refunded: number
  creditsReturned: number
}> {
  const result = { scanned: 0, refunded: 0, creditsReturned: 0 }
  const db = adminClient()
  if (!db) return result

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: debits, error } = await db
    .from('credit_debits')
    .select('render_id, amount')
    .eq('kind', 'video')
    .is('refunded_at', null)
    .lt('created_at', cutoff)
    .not('render_id', 'like', 'animate-%')
    .not('render_id', 'like', 'legacy-%')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[refund/sweep] debit query failed:', error.message)
    return result
  }
  const candidates = debits ?? []
  result.scanned = candidates.length
  if (candidates.length === 0) return result

  // A completed render ALWAYS has a videos row keyed by render_id (#357).
  const { data: vids, error: vidErr } = await db
    .from('videos')
    .select('render_id')
    .in('render_id', candidates.map((d) => d.render_id))
  if (vidErr) {
    // Fail CLOSED: if we can't confirm which renders completed, refund nothing.
    console.error('[refund/sweep] videos lookup failed — skipping sweep:', vidErr.message)
    return result
  }
  const completed = new Set((vids ?? []).map((v) => v.render_id as string))

  for (const d of candidates) {
    if (completed.has(d.render_id as string)) continue
    const amount = await refundRenderCredits(d.render_id as string)
    if (amount > 0) {
      result.refunded += 1
      result.creditsReturned += amount
    }
  }
  if (result.refunded > 0) {
    console.log(
      `[refund/sweep] refunded ${result.refunded} stuck render(s), ${result.creditsReturned} credits returned`
    )
  }
  return result
}
