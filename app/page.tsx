import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import KineoLanding from './KineoLanding'

export const metadata: Metadata = {
  alternates: { canonical: 'https://www.usekineo.com/' },
}

// Push #066 — homepage auth hydration fix.
//
// The landing page lives outside the (dashboard) route group, so it does
// not inherit the dashboard layout's server-side auth check. Before this
// change the page was a "use client" component that only learned about
// the user via supabase.auth.getUser() on mount — meaning the Sidebar
// rendered with isLoggedIn=false on first paint and would stick on
// "Guest User — Not signed in" whenever the browser-client call didn't
// resolve cleanly (cold cache after middleware refresh, etc.), even
// though /generate would show the same user as signed in.
//
// This wrapper reads the session from cookies via the server Supabase
// client and forwards the resolved user/email/is_pro into the client
// component as initial state, mirroring app/(dashboard)/layout.tsx.

export default async function HomePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let email = ''
  let isPro = false
  if (user) {
    email = user.email ?? ''
    const { data } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .single()
    isPro = data?.is_pro ?? false
  }

  return (
    <KineoLanding
      initialUser={user ? { id: user.id } : null}
      initialEmail={email}
      initialIsPro={isPro}
    />
  )
}
