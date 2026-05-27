// Push #303 — Viral Now: dedicated page
import { createClient } from '@/lib/supabase/server'
import ViralNowClient from './ViralNowClient'

export const metadata = { title: 'Viral Now — ShortsForgeAI' }

export default async function ViralNowPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <ViralNowClient isLoggedIn={!!user} />
}
