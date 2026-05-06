import Stripe from 'stripe'

// Use STRIPE_SECRET_KEY at runtime (not build time).
// Route handlers already guard with `if (!process.env.STRIPE_SECRET_KEY)` before calling stripe methods,
// so passing an empty string here is safe — stripe will never actually be called without the key.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
})
