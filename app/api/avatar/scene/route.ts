// AI Avatar — "Scene" generation route.
// POST { imageUrl (our storage face URL), prompt (scene description) }.
// Flow: FLUX.1 Kontext edits the face photo into the described scene (same
// face, new outfit/background) → we re-host the result on our avatars bucket
// (the avatar pipeline only accepts our storage URLs) → return that URL, which
// the client then feeds to /api/generate-avatar as the source image to animate.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSceneImage } from '@/lib/avatar/scene'
import { uploadAvatarPhoto } from '@/lib/avatar/storage'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'Image engine is not configured.' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Storage backend is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { imageUrl?: string; prompt?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    // Source must be OUR storage URL (uploaded via /api/avatar/upload) — never
    // an arbitrary external URL (no SSRF / hot-linking surface).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const storagePrefix = `${supabaseUrl}/storage/v1/object/public/avatars/`
    const imageUrl = (body.imageUrl ?? '').trim()
    const prompt = (body.prompt ?? '').trim()
    if (!imageUrl.startsWith(storagePrefix)) {
      return NextResponse.json({ error: 'Please upload your photo first.' }, { status: 400 })
    }
    if (prompt.length < 3) {
      return NextResponse.json({ error: 'Describe the scene first (at least a few words).' }, { status: 400 })
    }
    if (prompt.length > 600) {
      return NextResponse.json({ error: 'Scene description is too long — keep it under 600 characters.' }, { status: 400 })
    }

    // Lock the identity + steer toward a source that OmniHuman can animate well:
    // photoreal, front-facing, head + upper body clearly visible.
    const fullPrompt =
      `${prompt}. Keep the exact same person and the same face, unchanged facial features. ` +
      `Photorealistic, sharp, front-facing, head and upper body clearly visible, natural lighting.`

    let falUrl: string
    try {
      falUrl = await generateSceneImage({ imageUrl, prompt: fullPrompt })
    } catch (err) {
      console.error('[avatar/scene] generation failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json(
        { error: 'Could not build the scene. Try again or simplify the description.' },
        { status: 502 },
      )
    }

    // Re-host on our bucket so the avatar pipeline accepts it as a source.
    let storageUrl: string
    try {
      const res = await fetch(falUrl)
      if (!res.ok) throw new Error(`fetch scene image failed: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      storageUrl = await uploadAvatarPhoto(user.id, buf, 'image/jpeg')
    } catch (err) {
      console.error('[avatar/scene] re-host failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json(
        { error: 'Scene was built but could not be saved. Please try again.' },
        { status: 502 },
      )
    }

    console.log(`[avatar/scene] scene built user=${user.id.slice(0, 8)} -> ${storageUrl}`)
    return NextResponse.json({ url: storageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[avatar/scene] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
