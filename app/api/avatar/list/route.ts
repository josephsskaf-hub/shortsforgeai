// Face-app wave 1 (12/06) — avatar library list.
// GET → the signed-in user's saved (face-checked) avatar photos, newest first.
// Used by <AvatarUpload/> to offer one-click reuse without a fresh upload.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listUserAvatars } from '@/lib/avatar/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    const avatars = await listUserAvatars(user.id, 6)
    return NextResponse.json({ avatars })
  } catch (err) {
    console.error('[avatar/list] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ avatars: [] })
  }
}
