// Push #065 — Admin Users List page.
// Server component: just the admin gate. All data fetching happens in
// the client component via /api/admin/users (which has the same gate).

import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

export default async function AdminUsersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !ADMIN_EMAILS.has(email)) {
    return <UsersClient denied />
  }

  return <UsersClient viewerEmail={email} />
}
