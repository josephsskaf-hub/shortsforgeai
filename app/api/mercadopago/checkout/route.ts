// Mercado Pago checkout — Brazilian one-time credit packs (Pix/boleto/BR card).
// GET /api/mercadopago/checkout?pack=br50 → creates a Checkout Pro preference
// and redirects the signed-in user to the Mercado Pago payment page.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMpPreference, mpConfigured, MP_PACKS } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.origin
  const redirectError = (msg: string) =>
    NextResponse.redirect(`${appUrl}/pricing?checkout_error=${encodeURIComponent(msg)}`)

  try {
    if (!mpConfigured()) {
      return redirectError('Pagamento via Pix ainda não está configurado. Tente o cartão.')
    }

    const packParam = (req.nextUrl.searchParams.get('pack') ?? 'br50') as keyof typeof MP_PACKS
    if (!MP_PACKS[packParam]) {
      return redirectError('Pacote inválido.')
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(`${appUrl}/signup?redirect=${encodeURIComponent('/pricing')}`)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const result = await createMpPreference({
      pack: packParam,
      userId: user.id,
      payerEmail: profile?.email ?? user.email ?? undefined,
      appUrl,
    })
    if ('error' in result) {
      console.error('[mercadopago/checkout]', result.error)
      return redirectError('Não foi possível abrir o pagamento. Tente novamente.')
    }
    return NextResponse.redirect(result.initPoint)
  } catch (err) {
    console.error('[mercadopago/checkout] unexpected:', err instanceof Error ? err.message : String(err))
    return redirectError('Algo deu errado. Tente novamente.')
  }
}
