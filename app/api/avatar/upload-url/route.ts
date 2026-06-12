// Avatar Studio (13/06) — direct-to-storage upload for SOURCE VIDEOS.
// Vercel caps request bodies at ~4.5MB, which made real source videos
// impossible through /api/avatar/upload. This route issues a SIGNED UPLOAD
// URL so the browser streams the file straight to Supabase Storage (up to
// the bucket's 40MB limit) — Vercel never touches the bytes.
//
// Security posture:
//   • auth required (the path is namespaced under the user's id)
//   • bucket-level allowedMimeTypes (mp4/mov/jpeg/png) + 40MB fileSizeLimit
//     are enforced by Supabase on the actual upload, not just here
//   • generate-avatar still only accepts OUR public-avatars URLs
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const EXT_BY_KIND: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Storage backend is not configured.' }, { status: 500 })
    }

    let body: { contentType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const contentType = (body.contentType ?? '').toLowerCase()
    const ext = EXT_BY_KIND[contentType]
    if (!ext) {
      return NextResponse.json({ error: 'Only MP4/MOV source videos use direct upload.' }, { status: 400 })
    }

    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const path = `${user.id}/source-video-${Date.now()}.${ext}`
    const { data, error } = await admin.storage.from('avatars').createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[avatar/upload-url] signed url error:', error?.message)
      return NextResponse.json({ error: 'Could not prepare the upload. Please try again.' }, { status: 502 })
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${path}`
    return NextResponse.json({ path: data.path, token: data.token, publicUrl })
  } catch (err) {
    console.error('[avatar/upload-url] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not prepare the upload.' }, { status: 500 })
  }
}
