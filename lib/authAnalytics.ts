import { trackEvent } from '@/lib/analytics'
import { normalizeInternalRedirect } from '@/lib/authRedirect'

export type AuthSurface = 'login_page' | 'signup_page' | 'auth_modal'
export type AuthMethod = 'email' | 'google' | 'apple'
export type CheckoutAuthStep =
  | 'page_view'
  | 'method_selected'
  | 'confirmation_required'
  | 'completed'

function checkoutIntentMetadata(destination: string): Record<string, unknown> | null {
  const internal = normalizeInternalRedirect(destination)
  if (!internal) return null

  const parsed = new URL(internal, 'https://kineo.local')
  const checkoutPath = /^\/api\/(?:stripe|paypal|mercadopago)\/checkout$/
  if (!checkoutPath.test(parsed.pathname)) return null

  const tier = parsed.searchParams.get('tier')
  const billing = parsed.searchParams.get('billing')
  const returnTo = parsed.searchParams.get('return')

  return {
    provider: parsed.pathname.split('/')[2] ?? 'unknown',
    tier: tier && /^(?:starter|basic|creator|studio|pro)$/.test(tier) ? tier : null,
    billing: billing && /^(?:monthly|annual)$/.test(billing) ? billing : null,
    intro: parsed.searchParams.get('intro') === '1',
    return_to: returnTo ? returnTo.slice(0, 32) : null,
  }
}

/** Track the checkout auth wall without collecting email, prompt or password. */
export function trackCheckoutAuthStep(
  step: CheckoutAuthStep,
  surface: AuthSurface,
  destination: string,
  method?: AuthMethod
): void {
  if (typeof window === 'undefined') return
  const intent = checkoutIntentMetadata(destination)
  if (!intent) return

  // React effects can run twice in development and users can double-click.
  // Keep one funnel transition per full browser navigation and method.
  const navigationId = Math.round(performance.timeOrigin).toString(36)
  const marker = `kineo_checkout_auth:${navigationId}:${surface}:${step}:${method ?? 'none'}`
  try {
    if (sessionStorage.getItem(marker)) return
    sessionStorage.setItem(marker, '1')
  } catch {
    // Storage may be disabled; analytics must never interrupt authentication.
  }

  const eventName = step === 'page_view'
    ? 'checkout_auth_page_view'
    : `checkout_auth_${step}`

  void trackEvent(eventName, {
    ...intent,
    surface,
    ...(method ? { method } : {}),
  })
}
