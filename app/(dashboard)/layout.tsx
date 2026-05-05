import { createClient } from '@/lib/supabase/server'
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

  // No redirect — dashboard is public. Auth is enforced at the generate action.
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('is_pro, generations_used, email')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <DashboardShell
      userEmail={profile?.email ?? user?.email ?? ''}
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      isLoggedIn={!!user}
    >
      {children}
    </DashboardShell>
  )
}
