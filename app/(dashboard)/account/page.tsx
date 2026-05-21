import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountClient from './AccountClient'

export default async function AccountPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro, generations_used, email, stripe_customer_id, created_at')
    .eq('id', user.id)
    .single()

  return (
    <AccountClient
      email={profile?.email ?? user.email ?? ''}
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      createdAt={profile?.created_at ?? null}
    />
  )
}
