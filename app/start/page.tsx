import { redirect } from 'next/navigation'

// Retire the stale campaign landing page without breaking old links.
// Every legacy /start visit now enters the activation-first signup flow.
export default function StartPage() {
  redirect('/signup?utm_source=start')
}
