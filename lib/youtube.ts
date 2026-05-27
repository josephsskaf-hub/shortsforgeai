// lib/youtube.ts — Push #317
// YouTube Data API v3 + YouTube Analytics API helpers.
// Handles OAuth token exchange, refresh, video upload, and analytics fetch.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ─── OAuth ────────────────────────────────────────────────────────────────────

const YOUTUBE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'
const YOUTUBE_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2'

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

export interface YouTubeTokens {
  access_token: string
  refresh_token: string
  expires_at: number // unix ms
  scope: string
}

// ─── Build the Google OAuth URL ───────────────────────────────────────────────

export function buildYouTubeAuthUrl(state: string): string {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
  if (!clientId) throw new Error('YOUTUBE_CLIENT_ID not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force refresh_token on every auth
    state,
  })
  return `${YOUTUBE_AUTH_BASE}?${params.toString()}`
}

// ─── Exchange code for tokens ─────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokens> {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
  if (!clientId || !clientSecret) throw new Error('YouTube OAuth credentials not configured')

  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? YOUTUBE_SCOPES,
  }
}

// ─── Refresh access token ─────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('YouTube OAuth credentials not configured')

  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Google only sends refresh_token on first auth
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? YOUTUBE_SCOPES,
  }
}

// ─── Get a valid access token (auto-refresh) ──────────────────────────────────

export async function getValidAccessToken(tokens: YouTubeTokens): Promise<{
  accessToken: string
  updatedTokens: YouTubeTokens | null // non-null if we refreshed
}> {
  const BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry
  if (Date.now() < tokens.expires_at - BUFFER_MS) {
    return { accessToken: tokens.access_token, updatedTokens: null }
  }
  const refreshed = await refreshAccessToken(tokens.refresh_token)
  return { accessToken: refreshed.access_token, updatedTokens: refreshed }
}

// ─── Store / retrieve tokens from Supabase ────────────────────────────────────

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createSupabaseClient(url, key)
}

export async function saveYouTubeTokens(userId: string, tokens: YouTubeTokens): Promise<void> {
  const sb = serviceSupabase()
  const { error } = await sb
    .from('profiles')
    .update({ youtube_tokens: tokens })
    .eq('id', userId)
  if (error) throw new Error(`Failed to save YouTube tokens: ${error.message}`)
}

export async function loadYouTubeTokens(userId: string): Promise<YouTubeTokens | null> {
  const sb = serviceSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('youtube_tokens')
    .eq('id', userId)
    .single()
  if (error || !data?.youtube_tokens) return null
  return data.youtube_tokens as YouTubeTokens
}

export async function disconnectYouTube(userId: string): Promise<void> {
  const sb = serviceSupabase()
  await sb.from('profiles').update({ youtube_tokens: null }).eq('id', userId)
}

// ─── Video upload ─────────────────────────────────────────────────────────────

export interface UploadOptions {
  videoUrl: string       // public URL of the mp4 to upload
  title: string
  description: string
  tags: string[]
  privacyStatus?: 'public' | 'private' | 'unlisted'
  madeForKids?: boolean
}

export interface UploadResult {
  videoId: string
  youtubeUrl: string
}

// Downloads the mp4 from videoUrl, then uploads to YouTube via resumable upload.
export async function uploadVideoToYouTube(
  accessToken: string,
  opts: UploadOptions,
): Promise<UploadResult> {
  const { videoUrl, title, description, tags, privacyStatus = 'public', madeForKids = false } = opts

  // Step 1 — Download the mp4 into memory
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`)
  const videoBuffer = await videoRes.arrayBuffer()
  const contentLength = videoBuffer.byteLength

  // Step 2 — Initiate resumable upload session
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 5000),
      tags: tags.slice(0, 500),
      categoryId: '22', // People & Blogs — good for Shorts content
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: madeForKids,
    },
  }

  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(contentLength),
      },
      body: JSON.stringify(metadata),
    },
  )

  if (!initRes.ok) {
    const err = await initRes.text()
    throw new Error(`YouTube upload init failed: ${initRes.status} ${err}`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) throw new Error('YouTube upload: no Location header in response')

  // Step 3 — Upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(contentLength),
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok && uploadRes.status !== 308) {
    const err = await uploadRes.text()
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${err}`)
  }

  const result = await uploadRes.json()
  const videoId = result.id as string
  if (!videoId) throw new Error('YouTube upload: no video ID in response')

  return {
    videoId,
    youtubeUrl: `https://www.youtube.com/shorts/${videoId}`,
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface ChannelStats {
  subscriberCount: number
  viewCount: number
  videoCount: number
  channelTitle: string
  channelId: string
  thumbnailUrl: string | null
}

export interface VideoAnalytic {
  videoId: string
  title: string
  views: number
  likes: number
  comments: number
  averageViewDuration: number // seconds
  impressionsCtr: number // click-through rate %
  publishedAt: string
  thumbnailUrl: string | null
}

export async function fetchChannelStats(accessToken: string): Promise<ChannelStats> {
  const res = await fetch(
    `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(`Channel fetch failed: ${res.status}`)
  const data = await res.json()
  const ch = data.items?.[0]
  if (!ch) throw new Error('No YouTube channel found for this account')
  return {
    channelId: ch.id,
    channelTitle: ch.snippet?.title ?? 'My Channel',
    subscriberCount: Number(ch.statistics?.subscriberCount ?? 0),
    viewCount: Number(ch.statistics?.viewCount ?? 0),
    videoCount: Number(ch.statistics?.videoCount ?? 0),
    thumbnailUrl: ch.snippet?.thumbnails?.default?.url ?? null,
  }
}

export async function fetchRecentVideoAnalytics(
  accessToken: string,
  maxResults = 10,
): Promise<VideoAnalytic[]> {
  // Get recent uploads
  const searchRes = await fetch(
    `${YOUTUBE_API_BASE}/search?part=snippet&forMine=true&type=video&order=date&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!searchRes.ok) throw new Error(`Video search failed: ${searchRes.status}`)
  const searchData = await searchRes.json()
  const items = searchData.items ?? []
  if (items.length === 0) return []

  const videoIds = items.map((v: { id: { videoId: string } }) => v.id.videoId).join(',')

  // Get statistics for all videos in one call
  const statsRes = await fetch(
    `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoIds}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!statsRes.ok) throw new Error(`Video stats fetch failed: ${statsRes.status}`)
  const statsData = await statsRes.json()

  return (statsData.items ?? []).map((v: {
    id: string
    snippet: { title: string; publishedAt: string; thumbnails?: { medium?: { url: string } } }
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
  }) => ({
    videoId: v.id,
    title: v.snippet?.title ?? 'Untitled',
    views: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    comments: Number(v.statistics?.commentCount ?? 0),
    averageViewDuration: 0, // requires Analytics API — fetched separately if needed
    impressionsCtr: 0,
    publishedAt: v.snippet?.publishedAt ?? '',
    thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? null,
  }))
}
