import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PricingClient from './PricingClient'

export default async function PricingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro, generations_used, stripe_customer_id')
    .eq('id', user.id)
    .single()

  return (
    <PricingClient
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      userId={user.id}
    />
  )
}
