import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro, generations_used')
    .eq('id', user.id)
    .single()

  const { count: totalGenerations } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <DashboardClient
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      totalGenerations={totalGenerations ?? 0}
    />
  )
}
