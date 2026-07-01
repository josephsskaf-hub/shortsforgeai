// Animate (13/06) — image-to-video: bring a real photo to life.
import { createClient } from '@/lib/supabase/server'
import AnimateClient from './AnimateClient'

export const metadata = { title: 'Animate a Photo — Kineo' }

export default async function AnimatePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <AnimateClient isLoggedIn={!!user} />
}
