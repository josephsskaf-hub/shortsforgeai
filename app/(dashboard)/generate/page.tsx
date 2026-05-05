import { redirect } from 'next/navigation'

// /generate is an alias for /dashboard
export default function GeneratePage() {
  redirect('/dashboard')
}
