// Push #053 — AI video library page.
// Server component: pulls the current user's rows from `public.videos`
// (RLS-enforced, owner-only SELECT — see migrations/004_videos_history.sql)
// and hands them to MyVideosClient. The legacy /history page still
// renders "Shorts Packs" but the sidebar no longer points to it.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyVideosClient, { type VideoRow } from './MyVideosClient'

export const dynamic = 'force-dynamic'

type RawRow = Record<string, unknown>

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
function coerceStatus(v: unknown): VideoRow['status'] {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s === 'completed' || s === 'processing' || s === 'failed' || s === 'cancelled') return s
  return 'processing'
}
function deriveTitle(row: RawRow): string {
  const title = strOrNull(row.title)
  if (title) return title.slice(0, 120)
  const topic = strOrNull(row.topic)
  if (topic) return topic.slice(0, 120)
  const prompt = strOrNull(row.prompt)
  if (prompt) return prompt.slice(0, 120)
  const script = strOrNull(row.script)
  if (script) return script.slice(0, 110) + '…'
  return 'Untitled Short'
}
function toRow(r: RawRow): VideoRow {
  return {
    id: String(r.id ?? ''),
    title: deriveTitle(r),
    status: coerceStatus(r.status),
    // final_video_url is the staging column; video_url is the legacy fallback.
    // Both go through the user-facing download/open buttons in the client.
    video_url: strOrNull(r.final_video_url) ?? strOrNull(r.video_url),
    thumbnail_url: strOrNull(r.thumbnail_url) ?? strOrNull(r.thumb_url),
    duration: numOrNull(r.duration) ?? numOrNull(r.duration_seconds),
    platform: strOrNull(r.platform) ?? 'YouTube Shorts',
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
  }
}

export default async function MyVideosPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/my-videos')

  // Same defensive column-narrowing as /api/videos so this page never
  // 500s if a column doesn't exist in this staging DB.
  const wideColumns =
    'id,status,video_url,final_video_url,title,topic,prompt,script,duration,duration_seconds,quality,platform,thumbnail_url,thumb_url,render_id,created_at'
  const narrowColumns = 'id,status,final_video_url,title,created_at'

  async function runSelect(columns: string) {
    return supabase
      .from('videos')
      .select(columns)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(60)
  }

  let query = await runSelect(wideColumns)
  if (query.error && /column .* does not exist|42703/.test(query.error.message ?? '')) {
    query = await runSelect(narrowColumns)
  }

  const rows: RawRow[] = !query.error && Array.isArray(query.data)
    ? (query.data as unknown as RawRow[])
    : []

  const videos: VideoRow[] = rows.map(toRow)

  return <MyVideosClient videos={videos} />
}
