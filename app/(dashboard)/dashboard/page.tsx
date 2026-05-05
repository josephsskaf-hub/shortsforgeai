import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No redirect — dashboard is now public. Auth is enforced at generate action.
  let profile = null
  let totalGenerations = 0

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('is_pro, generations_used')
      .eq('id', user.id)
      .single()
    profile = data

    const { count } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    totalGenerations = count ?? 0
  }

  return (
    <DashboardClient
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      totalGenerations={totalGenerations}
      isLoggedIn={!!user}
    />
  )
}
