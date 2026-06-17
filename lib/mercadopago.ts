// Mercado Pago integration (Brazilian payments: Pix, boleto, BR cards in BRL).
// Runs ALONGSIDE Stripe — Brazilians pay here in Real, everyone else keeps
// Stripe in USD. Uses the REST API directly (no SDK dependency).
//
// Env: MP_ACCESS_TOKEN (server-side secret, from the user's Mercado Pago account).
//
// Flow: checkout route creates a Checkout Pro "preference" -> redirect the buyer
// to init_point -> they pay (Pix/card/boleto) -> Mercado Pago calls our webhook
// -> we verify the payment is approved and grant the credits.

const MP_API = 'https://api.mercadopago.com'

// One-time credit packs in BRL (Pix). Credits = Fast Shorts. Server-side source
// of truth — the webhook resolves credits from the pack id, never from the
// client, so the amount can't be tampered with. Régua aprovada: R$50 = 25 Shorts
// (20% mais barato/crédito que o pack em dólar).
export const MP_PACKS: Record<string, { credits: number; brl: number; title: string }> = {
  br50: { credits: 25, brl: 50, title: 'ShortsForgeAI — 25 Shorts (Pix)' },
  br90: { credits: 50, brl: 90, title: 'ShortsForgeAI — 50 Shorts (Pix)' },
}

export function mpConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN
}

/** Create a Checkout Pro preference and return its init_point (the payment URL). */
export async function createMpPreference(args: {
  pack: keyof typeof MP_PACKS
  userId: string
  payerEmail?: string
  appUrl: string
}): Promise<{ initPoint: string } | { error: string }> {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) return { error: 'Mercado Pago não configurado (MP_ACCESS_TOKEN ausente).' }
  const pack = MP_PACKS[args.pack]
  if (!pack) return { error: 'Pacote inválido.' }

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          title: pack.title,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: pack.brl,
        }],
        // userId:pack — the webhook resolves the credit amount from MP_PACKS[pack]
        // (never trusts a client-sent number).
        external_reference: `${args.userId}:${args.pack}`,
        ...(args.payerEmail ? { payer: { email: args.payerEmail } } : {}),
        back_urls: {
          success: `${args.appUrl}/checkout/success?provider=mercadopago`,
          failure: `${args.appUrl}/pricing?mp=failed`,
          pending: `${args.appUrl}/checkout/success?provider=mercadopago&pending=1`,
        },
        auto_return: 'approved',
        notification_url: `${args.appUrl}/api/mercadopago/webhook`,
        statement_descriptor: 'SHORTSFORGEAI',
      }),
    })
    const data = await res.json().catch(() => ({})) as { init_point?: string }
    if (!res.ok || !data?.init_point) {
      return { error: `MP preference falhou: ${res.status} ${JSON.stringify(data).slice(0, 300)}` }
    }
    return { initPoint: data.init_point }
  } catch (err) {
    return { error: `MP preference erro: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** Fetch a payment by id to verify status + read the external_reference. */
export async function getMpPayment(paymentId: string): Promise<{
  status: string
  externalReference: string | null
  amount: number | null
} | null> {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null) as {
      status?: string
      external_reference?: string
      transaction_amount?: number
    } | null
    if (!data) return null
    return {
      status: data.status ?? 'unknown',
      externalReference: data.external_reference ?? null,
      amount: typeof data.transaction_amount === 'number' ? data.transaction_amount : null,
    }
  } catch {
    return null
  }
}
