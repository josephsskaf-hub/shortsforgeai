import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

async function DashboardContent() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
