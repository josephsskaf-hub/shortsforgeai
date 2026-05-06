import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    // Guard: fail fast if Stripe is not configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'Payment service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[stripe/checkout] Auth error:', authError.message)
      return NextResponse.json({ error: 'Authentication failed. Please sign in again.' }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to upgrade.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id, is_pro')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[stripe/checkout] Profile fetch error:', profileError.message, profileError.code)
    }

    if (profile?.is_pro) {
      return NextResponse.json({ error: 'You already have an active Pro subscription.' }, { status: 400 })
    }

    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
    if (!priceId) {
      console.error('[stripe/checkout] NEXT_PUBLIC_STRIPE_PRICE_ID is not configured')
      return NextResponse.json({ error: 'Payment configuration error. Please contact support.' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.vercel.app'

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: profile?.email ?? user.email ?? '',
          metadata: { supabase_user_id: user.id },
        })
        customerId = customer.id

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)

        if (updateError) {
          console.error('[stripe/checkout] Failed to persist customer ID:', updateError.message)
        }
      } catch (customerErr: any) {
        console.error('[stripe/checkout] Failed to create Stripe customer:', customerErr?.message ?? customerErr)
        return NextResponse.json({ error: 'Failed to set up payment. Please try again.' }, { status: 500 })
      }
    }

    let session
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/dashboard?upgraded=true`,
        cancel_url: `${appUrl}/pricing?cancelled=true`,
        metadata: { supabase_user_id: user.id },
      })
    } catch (sessionErr: any) {
      console.error('[stripe/checkout] Session creation error:', sessionErr?.message ?? sessionErr)
      return NextResponse.json(
        { error: `Payment session failed: ${sessionErr?.message ?? 'Please try again'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[stripe/checkout] Unexpected error:', error?.message ?? error)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
