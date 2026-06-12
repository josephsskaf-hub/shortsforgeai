// AI Avatar (feature/ai-avatar) — face photo upload.
// POST multipart/form-data: `file` (JPG/PNG ≤ 8MB) + `rights` ("true").
//
// Protection rules implemented here:
//   • Image-rights term — the request MUST carry rights=true (the UI checkbox
//     "I confirm I have the right to use this person's image"). Hard 400 without it.
//   • Face validation — gpt-4o-mini vision checks a human face is clearly
//     visible. Fails CLOSED on a negative answer, fails OPEN if the vision
//     call itself errors (an OpenAI hiccup must not block a legit upload;
//     VEED would reject a faceless photo downstream anyway).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import { uploadAvatarPhoto, saveAvatarToLibrary } from '@/lib/avatar/storage'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png'])

/** Best-effort face check. Returns null when the check itself failed (fail-open). */
async function faceVisible(buffer: Buffer, mime: string): Promise<boolean | null> {
  try {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Is there exactly one clearly visible, front-facing human face in this photo, suitable for lip-sync animation? ' +
                  'Answer ONLY valid JSON: {"face_visible": true|false, "reason": "<short>"}',
              },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 60,
        temperature: 0,
        response_format: { type: 'json_object' },
      },
      { timeout: 20000, maxRetries: 0 },
    )
    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw) as { face_visible?: unknown; reason?: unknown }
    console.log('[avatar/upload] face check:', raw.slice(0, 200))
    return parsed.face_visible === true
  } catch (err) {
    console.warn('[avatar/upload] face check errored — failing open:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 })
    }

    // Image-rights term — hard requirement (protection rule).
    if ((form.get('rights') ?? '').toString() !== 'true') {
      return NextResponse.json(
        { error: 'Please confirm you have the right to use this image.' },
        { status: 400 },
      )
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A JPG or PNG photo is required.' }, { status: 400 })
    }
    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_TYPES.has(mime)) {
      return NextResponse.json({ error: 'Only JPG and PNG photos are supported.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Photo is too large — max 8 MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 })
    }

    // Face validation — reject only on a confident "no face".
    const visible = await faceVisible(buffer, mime)
    if (visible === false) {
      return NextResponse.json(
        { error: 'We could not detect a clear, front-facing face in this photo. Please use a sharp photo with one visible face.' },
        { status: 422 },
      )
    }

    const url = await uploadAvatarPhoto(user.id, buffer, mime as 'image/jpeg' | 'image/png')

    // Face-app wave 1 — avatar library. Two best-effort writes, neither may
    // fail the upload: (1) profiles.avatar_face_url = the "last approved face"
    // consumed by /api/credits for the one-click reuse chip; (2) a row in
    // public.user_avatars = the full library (multi-face picker, /api/avatar/list).
    try {
      await supabase.from('profiles').update({ avatar_face_url: url }).eq('id', user.id)
    } catch (err) {
      console.warn('[avatar/upload] could not save avatar_face_url (non-blocking):', err instanceof Error ? err.message : String(err))
    }
    await saveAvatarToLibrary(user.id, url)

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[avatar/upload] unexpected error:', msg)
    return NextResponse.json({ error: 'Photo upload failed. Please try again.' }, { status: 500 })
  }
}
