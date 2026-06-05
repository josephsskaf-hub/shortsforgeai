import { createClient } from '@/lib/supabase/server'
import DashboardShell from './DashboardShell'
// Push #423 — mobile users see a one-tap "Install app" banner (Android)
// or the Add-to-Home-Screen hint (iOS). Dashboard only, so the public
// landing/ads funnel stays distraction-free.
import InstallAppBanner from '@/components/InstallAppBanner'
// Push #427 — push-notification opt-in ("know when your video is ready")
import EnablePushBanner from '@/components/EnablePushBanner'

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
      <InstallAppBanner />
      <EnablePushBanner />
    </DashboardShell>
  )
}
