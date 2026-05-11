import { createClient } from '@/lib/supabase/server'
import PricingClient from './PricingClient'

export default async function PricingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: { is_pro?: boolean; generations_used?: number; stripe_customer_id?: string | null } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('is_pro, generations_used, stripe_customer_id')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <PricingClient
      isPro={profile?.is_pro ?? false}
      generationsUsed={profile?.generations_used ?? 0}
      hasStripeCustomer={!!profile?.stripe_customer_id}
      userId={user?.id ?? ''}
    />
  )
}
