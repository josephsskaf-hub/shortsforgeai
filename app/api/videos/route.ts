// Push #048 — Visual History endpoint.
// Returns the signed-in user's recent video generations from the `videos`
// table (the same table lib/generations.ts uses for the async pipeline).
// Read-only — never writes, never deducts credits.
//
// Defensively narrows the select column list: if a column (e.g. `duration`
// or `platform`) doesn't exist in this database, we retry with just the
// fields we know are present so the route never 500s in staging.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 10
// Reads cookies via supabase auth — mark explicitly dynamic so Next.js
// doesn't try to evaluate the route at build time.
export const dynamic = 'force-dynamic'

type RawRow = Record<string, unknown>

interface VideoListItem {
  id: string
  title: string
  status: 'completed' | 'processing' | 'failed' | 'cancelled'
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  platform: string
  created_at: string
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function coerceStatus(v: unknown): VideoListItem['status'] {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s === 'completed' || s === 'processing' || s === 'failed' || s === 'cancelled') {
    return s
  }
  // Unknown status — default to processing so the UI shows a neutral chip
  // instead of treating it as a successful video the user can play.
  return 'processing'
}

function deriveTitle(row: RawRow): string {
  // Push #052 — staging schema uses `title`. Prefer that. Fall back
  // through `topic` / `prompt` / `script` for legacy rows that may
  // still be in the table from older pipelines.
  const title = strOrNull(row.title)
  if (title) return title.slice(0, 90)
  const topic = strOrNull(row.topic)
  if (topic) return topic.slice(0, 90)
  const prompt = strOrNull(row.prompt)
  if (prompt) return prompt.slice(0, 90)
  const script = strOrNull(row.script)
  if (script) return script.slice(0, 80) + '…'
  return 'Untitled Short'
}

function toListItem(row: RawRow): VideoListItem {
  // Push #052 — staging schema column order: `final_video_url` is the
  // primary, `video_url` is legacy fallback.
  return {
    id: String(row.id ?? ''),
    title: deriveTitle(row),
    status: coerceStatus(row.status),
    video_url: strOrNull(row.final_video_url) ?? strOrNull(row.video_url),
    thumbnail_url: strOrNull(row.thumbnail_url) ?? strOrNull(row.thumb_url),
    duration: numOrNull(row.duration) ?? numOrNull(row.duration_seconds),
    platform:
      strOrNull(row.platform) ?? 'YouTube Shorts',
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    // Push #052 (QA fix A) — the staging `public.videos` table uses
    // `title` + `final_video_url` (not `topic` + `video_url` like the
    // legacy schema). The wide list now includes both naming conventions
    // and toListItem() prefers the staging one. If the wide select fails
    // because none of the optional columns exist, we retry with only
    // the universally-present columns.
    const wideColumns =
      'id,status,video_url,final_video_url,title,topic,prompt,script,duration,duration_seconds,quality,platform,thumbnail_url,thumb_url,render_id,created_at'
    // Bug fix — narrow fallback used to ask for `final_video_url` and
    // `title`, which do not exist on every environment (migration 004
    // baseline only adds `video_url` / `topic`). When those columns
    // were missing, both wide AND narrow selects failed → the route
    // silently returned an empty list. Narrow now uses only columns
    // guaranteed by migration 004 baseline so the read path is
    // universally safe.
    const narrowColumns = 'id,status,video_url,topic,created_at'

    // Helper: run the videos SELECT with whichever column list works.
    // We hoist user.id to a local so the inner function doesn't need
    // to re-narrow nullability, and cast through `unknown` because the
    // generic select() return type doesn't unify between the wide and
    // narrow column shapes.
    const userId = user.id
    async function runSelect(columns: string) {
      return supabase
        .from('videos')
        .select(columns)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6)
    }

    let query = await runSelect(wideColumns)

    if (query.error && /column .* does not exist|42703/.test(query.error.message ?? '')) {
      query = await runSelect(narrowColumns)
    }

    if (query.error) {
      // Table may not exist yet in this staging DB — treat as empty rather
      // than 500ing so the UI shows the empty-state card.
      console.warn('[videos GET] supabase error:', query.error.message)
      return NextResponse.json({ videos: [] })
    }

    const rows: RawRow[] = Array.isArray(query.data)
      ? (query.data as unknown as RawRow[])
      : []
    return NextResponse.json({ videos: rows.map(toListItem) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[videos GET] unexpected error:', msg)
    return NextResponse.json({ videos: [] })
  }
}
