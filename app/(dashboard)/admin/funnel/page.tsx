// The live API is the single source of truth for this page. Keeping a second
// SSR implementation here previously flashed profile flags as paid users
// before Stripe-verified data loaded.

import { createClient } from '@/lib/supabase/server'
import FunnelClient from './FunnelClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

export default async function AdminFunnelPage() {
  const cookieClient = createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''

  if (!user || !ADMIN_EMAILS.has(email)) {
    return <FunnelClient denied />
  }

  return <FunnelClient viewerEmail={email} />
}
