'use client'

// Affiliate self-serve page. Fetches /api/affiliate/me and renders one of four
// states: not-an-affiliate (apply CTA), pending, active (link + KPIs + recent
// commissions), or suspended. Dark premium styling to match /referral and
// /admin/funnel. Amounts arrive in CENTS and are divided by 100 for display.

import { useEffect, useState } from 'react'

interface Commission {
  created_at: string | null
  type: string | null
  amount_gross: number
  commission_amount: number
  currency: string | null
  status: string | null
}

interface AffiliateMe {
  isAffiliate: boolean
  affiliate?: {
    code: string
    status: string
    commission_rate: number
    coupon_code: string | null
  }
  link?: string
  stats?: { clicks: number; signups: number; paid: number }
  earnings?: { pending: number; approved: number; paid: number; total: number }
  recent?: Commission[]
}

const CYAN = '#22D3EE'
const TEXT = '#F1F5F9'
const MUTED = '#94A3B8'
const GREEN = '#a78bfa'
const CARD = '#121214'
const BORDER = '1px solid rgba(255,255,255,0.08)'

function dollars(cents: number, currency = 'usd'): string {
  const sym = currency && currency.toLowerCase() !== 'usd' ? '' : '$'
  const amount = (cents / 100).toFixed(2)
  return sym ? `${sym}${amount}` : `${amount} ${currency?.toUpperCase()}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
  approved: { bg: 'rgba(167,139,250,0.14)', color: GREEN },
  paid: { bg: 'rgba(34,211,238,0.14)', color: CYAN },
  clawed_back: { bg: 'rgba(239,68,68,0.14)', color: '#ef4444' },
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase()
  const style = STATUS_BADGE[s] ?? { bg: 'rgba(148,163,184,0.14)', color: MUTED }
  return (
    <span
      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color }}
    >
      {status ?? '—'}
    </span>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: CARD, border: BORDER }}>
      <div className="text-[10px] font-black uppercase tracking-[.14em] mb-2" style={{ color: accent ?? MUTED }}>
        {label}
      </div>
      <div className="font-black" style={{ fontSize: '1.6rem', lineHeight: 1.1, color: accent ?? TEXT }}>
        {value}
      </div>
    </div>
  )
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/affiliate/me', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as AffiliateMe
        setData(json)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function apply() {
    setApplying(true)
    try {
      await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      await load()
    } catch {
      /* silent */
    } finally {
      setApplying(false)
    }
  }

  function copyLink() {
    if (!data?.link) return
    try {
      navigator.clipboard.writeText(data.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const wrap = 'px-4 sm:px-6 py-7 pb-28 md:pb-20 max-w-3xl mx-auto'

  if (loading) {
    return (
      <div className={wrap}>
        <div className="rounded-2xl" style={{ background: CARD, border: BORDER, height: 180 }} />
      </div>
    )
  }

  // ── Not an affiliate → hero + Apply ──────────────────────────────────────
  if (!data || !data.isAffiliate) {
    return (
      <div className={wrap}>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: CARD, border: '1px solid rgba(34,211,238,.28)', boxShadow: '0 0 40px rgba(34,211,238,.08)' }}
        >
          <div className="text-5xl mb-4">🤝</div>
          <h1 className="font-black tracking-tight mb-3" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: TEXT }}>
            Become an affiliate —{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #22D3EE 0%, #8B5CF6 60%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              earn 40% recurring
            </span>{' '}
            on everyone you bring
          </h1>
          <p className="text-sm mb-6 mx-auto" style={{ color: MUTED, maxWidth: 460, lineHeight: 1.6 }}>
            Share your link, send people to ShortsForgeAI, and earn 40% of every payment they make — for
            as long as they stay subscribed.
          </p>
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="rounded-xl px-7 py-3 text-sm font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #22D3EE, #7C3AED)',
              boxShadow: '0 4px 18px rgba(34,211,238,.35)',
              border: 'none',
              cursor: applying ? 'default' : 'pointer',
              opacity: applying ? 0.7 : 1,
            }}
          >
            {applying ? 'Applying…' : 'Apply to become an affiliate'}
          </button>
        </div>
      </div>
    )
  }

  const a = data.affiliate!
  const status = (a.status ?? '').toLowerCase()

  // ── Pending ──────────────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <div className={wrap}>
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: BORDER }}>
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.5rem', color: TEXT }}>
            Application received — pending approval.
          </h1>
          <p className="text-sm mx-auto" style={{ color: MUTED, maxWidth: 420, lineHeight: 1.6 }}>
            We&apos;re reviewing your application. You&apos;ll get your share link and dashboard here as soon
            as you&apos;re approved.
          </p>
        </div>
      </div>
    )
  }

  // ── Suspended ────────────────────────────────────────────────────────────
  if (status === 'suspended') {
    return (
      <div className={wrap}>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: CARD, border: '1px solid rgba(239,68,68,.35)' }}
        >
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.5rem', color: TEXT }}>
            Your affiliate account is suspended.
          </h1>
          <p className="text-sm mx-auto" style={{ color: MUTED, maxWidth: 420, lineHeight: 1.6 }}>
            Your link is paused and no new commissions are being tracked. Reach out to support if you
            think this is a mistake.
          </p>
        </div>
      </div>
    )
  }

  // ── Active ───────────────────────────────────────────────────────────────
  const stats = data.stats ?? { clicks: 0, signups: 0, paid: 0 }
  const earnings = data.earnings ?? { pending: 0, approved: 0, paid: 0, total: 0 }
  const recent = data.recent ?? []
  const ratePct = `${Math.round((a.commission_rate ?? 0) * 100)}%`

  return (
    <div className={wrap}>
      <header className="mb-6">
        <div className="font-black uppercase tracking-[.18em] mb-2" style={{ fontSize: '0.62rem', color: CYAN }}>
          Affiliate
        </div>
        <h1 className="font-black tracking-tight mb-1" style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', color: TEXT }}>
          Your affiliate dashboard
        </h1>
        <p className="text-sm" style={{ color: MUTED }}>
          Earning <span style={{ color: GREEN, fontWeight: 800 }}>{ratePct}</span> recurring on everyone you
          refer.
        </p>
      </header>

      {/* Share link */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ background: CARD, border: '1px solid rgba(34,211,238,.28)', boxShadow: '0 0 30px rgba(34,211,238,.08)' }}
      >
        <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: MUTED }}>
          Your share link
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={data.link ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-xl px-3 py-2.5 text-xs"
            style={{
              background: 'rgba(13,13,28,.85)',
              border: '1px solid rgba(34,211,238,.3)',
              color: TEXT,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={copyLink}
            className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #22D3EE, #7C3AED)',
              boxShadow: '0 4px 18px rgba(34,211,238,.35)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
        {a.coupon_code ? (
          <div className="text-xs mt-3" style={{ color: MUTED }}>
            Coupon code:{' '}
            <span className="font-black px-2 py-0.5 rounded" style={{ background: 'rgba(34,211,238,.12)', color: CYAN }}>
              {a.coupon_code}
            </span>
          </div>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Clicks" value={stats.clicks.toLocaleString('en-US')} accent={CYAN} />
        <Kpi label="Signups" value={stats.signups.toLocaleString('en-US')} accent="#a78bfa" />
        <Kpi label="Paid customers" value={stats.paid.toLocaleString('en-US')} accent={GREEN} />
        <Kpi label="Pending $" value={dollars(earnings.pending)} accent="#fbbf24" />
        <Kpi label="Approved $" value={dollars(earnings.approved)} accent={GREEN} />
        <Kpi label="Total earned" value={dollars(earnings.total)} accent={CYAN} />
      </div>

      {/* Recent commissions */}
      <section>
        <h2
          className="font-black tracking-tight mb-3"
          style={{ fontSize: '0.85rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Recent commissions
        </h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: CARD, border: BORDER }}>
          <table className="w-full text-left text-xs" style={{ minWidth: 520 }}>
            <thead>
              <tr style={{ color: MUTED }}>
                <th className="px-3 py-2 font-bold">Date</th>
                <th className="px-3 py-2 font-bold">Type</th>
                <th className="px-3 py-2 font-bold">Gross</th>
                <th className="px-3 py-2 font-bold">Commission</th>
                <th className="px-3 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c, i) => (
                <tr key={(c.created_at ?? '') + i} style={{ borderTop: BORDER, color: TEXT }}>
                  <td className="px-3 py-2" style={{ color: MUTED }}>{fmtDate(c.created_at)}</td>
                  <td className="px-3 py-2">{c.type ?? '—'}</td>
                  <td className="px-3 py-2">{dollars(c.amount_gross, c.currency ?? 'usd')}</td>
                  <td className="px-3 py-2 font-black" style={{ color: GREEN }}>
                    {dollars(c.commission_amount, c.currency ?? 'usd')}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center" style={{ color: MUTED }}>
                    No commissions yet — share your link to start earning.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
