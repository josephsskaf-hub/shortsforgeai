// KINEO-USER-FOOTAGE-2026-07-10 — "My footage" API (Prioridade 2).
// GET    → the user's footage library
// POST   → { action:'upload-url', contentType, sizeBytes } → signed upload URL
//          (plan-gated + 500MB total quota, enforced SERVER-side — never
//          localStorage, the thumbnail-limit lesson)
//        → { action:'confirm', path, kind, sizeBytes } → row insert after the
//          browser PUTs the file straight to storage
// DELETE → ?id= removes row + storage object
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ensureFootageBucket,
  footageAdminClient,
  FOOTAGE_PUBLIC_PREFIX,
  FOOTAGE_QUOTA_PAID,
  listUserFootage,
  totalFootageBytes,
  USER_FOOTAGE_BUCKET,
} from '@/lib/userFootage'

export const dynamic = 'force-dynamic'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  // KINEO-OWN-VOICE — user voiceover uploads (P3 Level A).
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
}

const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial'])

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    const items = await listUserFootage(user.id)
    const used = items.reduce((s, i) => s + (i.size_bytes || 0), 0)
    return NextResponse.json({ items, used_bytes: used, quota_bytes: FOOTAGE_QUOTA_PAID })
  } catch (err) {
    console.error('[footage] GET failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not load your footage.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    let body: { action?: string; contentType?: string; sizeBytes?: number; path?: string; kind?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Plan gate — footage próprio é feature paga (free vê o cadeado).
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_paid, plan')
      .eq('id', user.id)
      .single()
    const isPaid = profile?.has_paid === true || PAID_PLANS.has((profile?.plan ?? '').toString())
    if (!isPaid) {
      return NextResponse.json(
        {
          error: 'Uploading your own footage is a paid feature — use YOUR clips and photos in every video. Upgrade to unlock it.',
          upsell: 'credits',
          upgrade: '/pricing',
        },
        { status: 402 },
      )
    }

    if (body.action === 'upload-url') {
      const contentType = (body.contentType ?? '').toString()
      const ext = EXT_BY_MIME[contentType]
      if (!ext) {
        return NextResponse.json({ error: 'Use JPG, PNG, MP4, MOV or WebM files.' }, { status: 400 })
      }
      const sizeBytes = Math.max(0, Number(body.sizeBytes) || 0)
      if (sizeBytes > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'Each file must be under 50 MB.' }, { status: 400 })
      }
      const used = await totalFootageBytes(user.id)
      if (used + sizeBytes > FOOTAGE_QUOTA_PAID) {
        const leftMb = Math.max(0, Math.floor((FOOTAGE_QUOTA_PAID - used) / (1024 * 1024)))
        return NextResponse.json(
          { error: `You have ${leftMb} MB left of your 500 MB footage storage — delete something to upload more.` },
          { status: 409 },
        )
      }

      const admin = footageAdminClient()
      await ensureFootageBucket(admin)
      const path = `${user.id}/clip-${Date.now()}.${ext}`
      const { data, error } = await admin.storage.from(USER_FOOTAGE_BUCKET).createSignedUploadUrl(path)
      if (error || !data) {
        console.error('[footage] signed url failed:', error?.message)
        return NextResponse.json({ error: 'Could not start the upload. Please try again.' }, { status: 502 })
      }
      return NextResponse.json({
        path,
        token: data.token,
        signedUrl: data.signedUrl,
        publicUrl: `${FOOTAGE_PUBLIC_PREFIX()}${path}`,
        kind: contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio' : 'image',
      })
    }

    if (body.action === 'confirm') {
      const path = (body.path ?? '').toString()
      // Path must be inside THIS user's folder (no cross-user confirms).
      if (!path.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Invalid upload path.' }, { status: 400 })
      }
      const kind = body.kind === 'image' ? 'image' : body.kind === 'audio' ? 'audio' : 'video'
      const sizeBytes = Math.max(0, Number(body.sizeBytes) || 0)
      const url = `${FOOTAGE_PUBLIC_PREFIX()}${path}`
      const admin = footageAdminClient()
      const { data, error } = await admin
        .from('user_footage')
        .insert({ user_id: user.id, url, kind, size_bytes: sizeBytes })
        .select('id, url, kind, size_bytes, created_at')
        .single()
      if (error || !data) {
        console.error('[footage] confirm insert failed:', error?.message)
        return NextResponse.json({ error: 'Could not register the upload.' }, { status: 500 })
      }
      console.log(`[footage] confirmed user=${user.id.slice(0, 8)} kind=${kind} bytes=${sizeBytes}`)
      return NextResponse.json({ item: data })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('[footage] POST failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

    const admin = footageAdminClient()
    const { data: row } = await admin
      .from('user_footage')
      .select('url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (row?.url) {
      const prefix = FOOTAGE_PUBLIC_PREFIX()
      const objectPath = (row.url as string).startsWith(prefix) ? (row.url as string).slice(prefix.length) : null
      if (objectPath) {
        const { error: rmErr } = await admin.storage.from(USER_FOOTAGE_BUCKET).remove([objectPath])
        if (rmErr) console.warn('[footage] storage remove failed (row still deleted):', rmErr.message)
      }
    }
    const { error } = await admin.from('user_footage').delete().eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[footage] DELETE failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
}
