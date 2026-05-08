'use client'

import { useEffect, useState } from 'react'

interface PricingClientProps {
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
}

const STARTER_FEATURES = [
  '10 créditos de vídeo',
  'Cada vídeo ~35 segundos',
  'MP4 pronto pra postar',
  'Válido por 12 meses',
  'Suporte por email',
]

const PRO_FEATURES = [
  '25 créditos de vídeo',
  'Tudo do Starter',
  'Prioridade na fila de render',
  'Acesso antecipado a novas niches',
  'Válido por 12 meses',
]

const FAQS = [
  {
    q: 'O crédito expira?',
    a: 'Os créditos comprados são válidos por 12 meses a partir da data da compra.',
  },
  {
    q: 'O que conta como 1 crédito?',
    a: 'Cada vídeo gerado pelo Autopilot consome 1 crédito — incluindo script, voz, visuais, legendas e renderização.',
  },
  {
    q: 'É assinatura?',
    a: 'Não. São pacotes de compra única. Sem cobrança recorrente, sem surpresa.',
  },
  {
    q: 'Posso pedir reembolso?',
    a: 'Sim, dentro de 7 dias da compra se nenhum crédito foi usado. Mande um email pra josephsskaf@gmail.com.',
  },
]

export default function PricingClient(props: PricingClientProps) {
  const { isPro } = props
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      })
      .catch(() => {
        if (!cancelled) setCredits(0)
      })
      .finally(() => {
        if (!cancelled) setCreditsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  async function handleBuy(pack: 'starter' | 'pro') {
    // One-time credit-pack checkout is not wired into Stripe yet.
    // Existing /api/stripe/checkout only supports subscription tiers (creator/pro),
    // so we show a soft "coming soon" toast rather than starting a wrong checkout.
    setPurchasing(pack)
    showToast('Em breve — pagamento por créditos chega logo.')
    setTimeout(() => setPurchasing(null), 600)
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data?.url) window.location.href = data.url
    } catch {
      // ignore
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
            boxShadow: '0 4px 24px rgba(99,102,241,.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center relative">
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700, height: 400,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,.12) 0%, transparent 70%)',
            top: -100, left: '50%', transform: 'translateX(-50%)',
          }}
        />
        <div className="relative z-10">
          <div className="font-black uppercase tracking-widest mb-2" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
            Compre créditos de vídeo
          </div>
          <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.9rem', color: 'var(--text)' }}>
            Pague só pelo que usar.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #818cf8, #c4b5fd, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Sem assinatura.
            </span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 480, margin: '0 auto' }}>
            Compra única. 1 crédito = 1 vídeo Short pronto pra postar.
          </p>
        </div>
      </div>

      {/* Current credits */}
      <div
        className="max-w-lg mx-auto mb-8 flex items-center gap-4 rounded-xl px-5 py-4"
        style={{
          background: 'rgba(99,102,241,.06)',
          border: '1px solid rgba(99,102,241,.18)',
        }}
      >
        <div className="text-2xl">⚡</div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            {creditsLoading ? 'Carregando saldo...' : `Você tem ${credits ?? 0} crédito${credits === 1 ? '' : 's'}`}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Cada Short consome 1 crédito.
          </p>
        </div>
        {isPro && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-lg px-3 py-2 text-xs font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border2)',
              color: 'var(--muted2)',
              cursor: portalLoading ? 'not-allowed' : 'pointer',
              opacity: portalLoading ? 0.6 : 1,
            }}
          >
            ⚙️ Billing
          </button>
        )}
      </div>

      {/* 2 packs */}
      <div
        className="grid max-w-3xl mx-auto gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {/* Starter */}
        <div
          className="rounded-[20px] p-7 transition-all flex flex-col"
          style={{
            background: 'rgba(15,15,30,0.85)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 30px rgba(99,102,241,.06)',
          }}
        >
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              Pack Starter
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-black" style={{ fontSize: '2.5rem', color: 'var(--text)', lineHeight: 1 }}>$9</span>
              <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>compra única</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>10 vídeos prontos pra postar.</p>
          </div>

          <div className="flex flex-col gap-2.5 mb-7 flex-1">
            {STARTER_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
                <span style={{ color: 'var(--text2)' }}>{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => handleBuy('starter')}
            disabled={purchasing === 'starter'}
            className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: '0 4px 22px rgba(99,102,241,.32)',
              border: 'none',
              cursor: purchasing === 'starter' ? 'wait' : 'pointer',
              opacity: purchasing === 'starter' ? 0.7 : 1,
            }}
          >
            {purchasing === 'starter' ? 'Carregando...' : 'Comprar 10 Créditos — $9'}
          </button>
        </div>

        {/* Pro — Most Popular */}
        <div
          className="rounded-[20px] p-7 relative overflow-hidden transition-all flex flex-col"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,.10), rgba(124,58,237,.06))',
            border: '2px solid rgba(99,102,241,.45)',
            boxShadow: '0 0 60px rgba(99,102,241,.2)',
          }}
        >
          <div
            className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', color: 'white' }}
          >
            Mais Popular
          </div>

          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--indigo-light)' }}>
              Pack Pro
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-black" style={{ fontSize: '2.5rem', color: 'var(--text)', lineHeight: 1 }}>$19</span>
              <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>compra única</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>25 vídeos — melhor custo por Short.</p>
          </div>

          <div className="flex flex-col gap-2.5 mb-7 flex-1">
            {PRO_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
                <span style={{ color: 'var(--text2)' }}>{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => handleBuy('pro')}
            disabled={purchasing === 'pro'}
            className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 4px 28px rgba(99,102,241,.45)',
              border: 'none',
              cursor: purchasing === 'pro' ? 'wait' : 'pointer',
              opacity: purchasing === 'pro' ? 0.7 : 1,
            }}
          >
            {purchasing === 'pro' ? 'Carregando...' : 'Comprar 25 Créditos — $19'}
          </button>
        </div>
      </div>

      <p className="max-w-3xl mx-auto text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
        Pagamento único. Sem assinatura. Reembolso em até 7 dias se não usar.
      </p>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12">
        <h2 className="font-black text-center mb-6 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          Perguntas Frequentes
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl px-5 py-4"
              style={{
                background: 'rgba(15,15,30,0.85)',
                border: '1px solid var(--border)',
                boxShadow: '0 0 30px rgba(139,92,246,.06)',
              }}
            >
              <p className="font-bold text-sm mb-1.5" style={{ color: 'var(--text)' }}>{faq.q}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
