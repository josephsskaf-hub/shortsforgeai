'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackCheckoutAuthStep, type AuthSurface } from '@/lib/authAnalytics'

type Props = {
  redirectTo?: string
  onError?: (message: string) => void
  label?: string
  analyticsSurface?: AuthSurface
}

export default function GoogleSignInButton({ redirectTo, onError, label, analyticsSurface }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    if (redirectTo && analyticsSurface) {
      trackCheckoutAuthStep('method_selected', analyticsSurface, redirectTo, 'google')
    }
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      const callback = `${origin}/auth/callback${
        redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
      }`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback },
      })

      if (error) {
        onError?.(error.message)
        setLoading(false)
      }
      // On success the browser navigates away to Google; no need to reset loading.
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google sign-in failed.'
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
        background: '#FFFFFF',
        color: '#1F2937',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = '#F9FAFB'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#FFFFFF'
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.209 1.125-.8431 2.0782-1.7973 2.7164v2.2581h2.9087c1.7018-1.5668 2.685-3.874 2.685-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.8595-3.0477.8595-2.3441 0-4.3282-1.5832-5.0359-3.7104H.957v2.3318C2.4382 15.9831 5.4818 18 9 18z"
          fill="#34A853"
        />
        <path
          d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.957C.3477 6.1731 0 7.5477 0 9c0 1.4523.3477 2.8269.957 4.0418L3.9641 10.71z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3459l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.957 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
          fill="#EA4335"
        />
      </svg>
      <span>{loading ? 'Connecting…' : label ?? 'Continue with Google'}</span>
    </button>
  )
}
