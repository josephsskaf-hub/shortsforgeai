import { createBrowserClient } from '@supabase/ssr'

// Tolerant of missing env at build time (e.g. static prerender of /login
// with NEXT_PUBLIC_SUPABASE_URL unset). At runtime on Vercel these are set,
// so the placeholder values are never actually used.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-anon-key'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  )
}
