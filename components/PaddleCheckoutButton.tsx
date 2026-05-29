'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { Paddle?: any } }

const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'sandbox'
const PADDLE_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ''

type Props = {
  priceId: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onError?: (msg: string) => void
}

// Paddle Billing overlay checkout. Loads Paddle.js once, initializes with the
// sandbox/live client token, and opens the overlay with the user_id as
// custom_data so the webhook can map the payment back to the Supabase user.
export default function PaddleCheckoutButton({ priceId, children, className, style, onError }: Props) {
  const supabase = createClient()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!PADDLE_TOKEN || !priceId) return
    if (window.Paddle) { setReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    s.async = true
    s.onload = () => {
      try {
        if (PADDLE_ENV !== 'production') window.Paddle.Environment.set('sandbox')
        window.Paddle.Initialize({ token: PADDLE_TOKEN })
        setReady(true)
      } catch (e) {
        onError?.(e instanceof Error ? e.message : 'Paddle init failed')
      }
    }
    s.onerror = () => onError?.('Failed to load Paddle.js')
    document.body.appendChild(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceId])

  async function open() {
    if (!window.Paddle) { onError?.('Paddle not ready'); return }
    const { data: { user } } = await supabase.auth.getUser()
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: user?.id ? { user_id: user.id } : undefined,
      customer: user?.email ? { email: user.email } : undefined,
      settings: { successUrl: `${window.location.origin}/pricing?paddle=success` },
    })
  }

  return (
    <button type="button" onClick={open} disabled={!ready || !PADDLE_TOKEN} className={className} style={style}>
      {children ?? 'Subscribe'}
    </button>
  )
}
