// Push #032 collapsed /dashboard into /generate so users land on the prompt
// box directly. Logged-in users get a server-side 307 to /generate; guests
// bounce to /login first. DashboardClient is no longer rendered for any
// user — the file stays in the tree only so any stale bookmarks resolve.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/generate')
  }
  redirect('/generate')
}
