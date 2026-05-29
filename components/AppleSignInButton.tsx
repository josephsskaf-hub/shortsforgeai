'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  redirectTo?: string
  onError?: (message: string) => void
  label?: string
}

// Sign in with Apple. Mirrors GoogleSignInButton but for the 'apple' provider.
// NOTE: requires the Apple provider to be configured in Supabase (Service ID +
// Key) AND an active Apple Developer account ($99/yr). Until then a click will
// surface a provider-not-enabled error via onError.
export default function AppleSignInButton({ redirectTo, onError, label }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const callback = `${origin}/auth/callback${
        redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
      }`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: callback },
      })

      if (error) {
        onError?.(error.message)
        setLoading(false)
      }
      // On success the browser navigates away to Apple; no need to reset loading.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed.'
      onError?.(msg)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-xl py-3 px-4 font-bold text-sm transition-all flex items-center justify-center gap-3"
      style={{
        background: '#000000',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.12)',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = '#1a1a1a'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#000000'
      }}
    >
      <svg width="16" height="18" viewBox="0 0 14 17" fill="currentColor" aria-hidden="true">
        <path d="M11.6 9.04c-.02-1.82 1.49-2.69 1.56-2.73-.85-1.24-2.17-1.41-2.64-1.43-1.12-.11-2.19.66-2.76.66-.57 0-1.45-.64-2.38-.62-1.22.02-2.35.71-2.98 1.8-1.27 2.2-.32 5.46.91 7.25.6.88 1.32 1.86 2.26 1.83.91-.04 1.25-.59 2.35-.59 1.09 0 1.4.59 2.36.57.97-.02 1.59-.9 2.19-1.78.69-1.02.97-2.01.99-2.06-.02-.01-1.9-.73-1.92-2.9zM9.86 3.66c.5-.61.84-1.45.75-2.29-.72.03-1.6.48-2.12 1.08-.46.53-.87 1.39-.76 2.21.8.06 1.62-.41 2.13-1z" />
      </svg>
      <span>{loading ? 'Connecting…' : label ?? 'Sign in with Apple'}</span>
    </button>
  )
}
