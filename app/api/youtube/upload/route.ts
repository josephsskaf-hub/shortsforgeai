// app/api/youtube/upload/route.ts — Push #317
// Uploads a rendered video (stored at a public URL) to the user's YouTube channel.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadYouTubeTokens,
  getValidAccessToken,
  saveYouTubeTokens,
  uploadVideoToYouTube,
} from '@/lib/youtube'

export const maxDuration = 60

interface UploadBody {
  videoUrl: string
  title?: string
  description?: string
  tags?: string[]
  privacyStatus?: 'public' | 'private' | 'unlisted'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const tokens = await loadYouTubeTokens(user.id)
    if (!tokens) {
      return NextResponse.json({ error: 'YouTube not connected. Please connect your channel first.' }, { status: 403 })
    }

    let body: UploadBody
    try {
      body = (await req.json()) as UploadBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (!body.videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required.' }, { status: 400 })
    }

    // Auto-refresh tokens if needed
    const { accessToken, updatedTokens } = await getValidAccessToken(tokens)
    if (updatedTokens) {
      await saveYouTubeTokens(user.id, updatedTokens)
    }

    console.log(`[youtube/upload] starting upload for user ${user.id.slice(0, 8)} url=${body.videoUrl.slice(0, 60)}`)

    const result = await uploadVideoToYouTube(accessToken, {
      videoUrl: body.videoUrl,
      title: body.title ?? 'My Short',
      description: body.description ?? '',
      tags: body.tags ?? [],
      privacyStatus: body.privacyStatus ?? 'public',
      madeForKids: false,
    })

    console.log(`[youtube/upload] success: videoId=${result.videoId}`)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[youtube/upload] error:', msg)
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 502 })
  }
}
