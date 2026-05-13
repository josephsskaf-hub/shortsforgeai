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
  // Prefer `topic` (push #028 + flow), fall back to `prompt` (legacy),
  // then to `script` (truncated), then to a generic label so the card
  // is never empty.
  const topic = strOrNull(row.topic)
  if (topic) return topic.slice(0, 90)
  const prompt = strOrNull(row.prompt)
  if (prompt) return prompt.slice(0, 90)
  const script = strOrNull(row.script)
  if (script) return script.slice(0, 80) + '…'
  return 'Untitled Short'
}

function toListItem(row: RawRow): VideoListItem {
  return {
    id: String(row.id ?? ''),
    title: deriveTitle(row),
    status: coerceStatus(row.status),
    video_url: strOrNull(row.video_url) ?? strOrNull(row.final_video_url),
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

    // Try a generous column list first; if Supabase complains about an
    // unknown column we retry with the minimum set we know exists in every
    // deployed environment.
    const wideColumns =
      'id,status,video_url,topic,prompt,script,duration,duration_seconds,platform,thumbnail_url,thumb_url,final_video_url,created_at'
    const narrowColumns = 'id,status,video_url,topic,script,created_at'

    let rows: RawRow[] = []
    let query = await supabase
      .from('videos')
      .select(wideColumns)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6)

    if (query.error && /column .* does not exist|42703/.test(query.error.message ?? '')) {
      query = await supabase
        .from('videos')
        .select(narrowColumns)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)
    }

    if (query.error) {
      // Table may not exist yet in this staging DB — treat as empty rather
      // than 500ing so the UI shows the empty-state card.
      console.warn('[videos GET] supabase error:', query.error.message)
      return NextResponse.json({ videos: [] })
    }

    rows = Array.isArray(query.data) ? (query.data as RawRow[]) : []
    return NextResponse.json({ videos: rows.map(toListItem) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[videos GET] unexpected error:', msg)
    return NextResponse.json({ videos: [] })
  }
}
