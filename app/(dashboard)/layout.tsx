import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro, generations_used, email')
    .eq('id', user.id)
    .single()

  return (
    <DashboardShell
      userEmail={profile?.email ?? user.email ?? ''}
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
    >
      {children}
    </DashboardShell>
  )
}
