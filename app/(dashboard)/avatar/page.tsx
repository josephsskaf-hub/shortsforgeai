// Avatar Studio (12/06) — dedicated, focused environment for AI Avatar videos.
// Split-screen: lean controls on the left, live phone preview + render status
// on the right. Photo (Fabric/OmniHuman) and Video (lipsync) sources.
import { createClient } from '@/lib/supabase/server'
import AvatarStudioClient from './AvatarStudioClient'

export const metadata = { title: 'AI Avatar Studio — Kineo' }

export default async function AvatarStudioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <AvatarStudioClient isLoggedIn={!!user} />
}
