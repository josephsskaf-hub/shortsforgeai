'use client'

// Admin — affiliates management. Fetches /api/admin/affiliates; a 403 renders a
// centered "Not authorized". Otherwise a responsive table with status badges,
// per-row Approve / Suspend-Activate toggles, an inline commission-rate editor
// (entered as a PERCENT, POSTed as the fraction), and a coupon-code input.
// Header has a CSV export link + a link back to /admin/funnel. Dark premium UI.

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Affiliate {
  id: string
  name: string | null
  email: string | null
  code: string
  status: string | null
  commission_rate: number | null
  coupon_code: string | null
  clicks: number
  signups: number
  paid: number
  owed: number
}

const CYAN = '#22D3EE'
const TEXT = '#F1F5F9'
const MUTED = '#94A3B8'
const GREEN = '#34d399'
const CARD = '#051D15'
const BORDER = '1px solid rgba(255,255,255,0.08)'
const PAGE_BG = '#020D0A'

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
  active: { bg: 'rgba(52,211,153,0.14)', color: GREEN },
  suspended: { bg: 'rgba(239,68,68,0.14)', color: '#ef4444' },
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Local drafts for the inline rate (%) and coupon inputs, keyed by affiliate id.
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({})
  const [couponDraft, setCouponDraft] = useState<Record<string, string>>({})

  async function load() {
    try {
      const res = await fetch('/api/admin/affiliates', { cache: 'no-store' })
      if (res.status === 403) {
        setDenied(true)
        return
      }
      if (res.ok) {
        const json = await res.json()
        const list = (json.affiliates ?? []) as Affiliate[]
        setAffiliates(list)
        // Seed drafts from server values.
        const rd: Record<string, string> = {}
        const cd: Record<string, string> = {}
        for (const a of list) {
          rd[a.id] = a.commission_rate != null ? String(Math.round(a.commission_rate * 100)) : ''
          cd[a.id] = a.coupon_code ?? ''
        }
        setRateDraft(rd)
        setCouponDraft(cd)
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

  async function post(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      await fetch(`/api/admin/affiliates/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await load()
    } catch {
      /* silent */
    } finally {
      setBusyId(null)
    }
  }

  function saveRate(id: string) {
    const raw = rateDraft[id]
    const pct = parseFloat(raw)
    if (Number.isNaN(pct)) return
    post(id, { commission_rate: pct / 100 })
  }

  function saveCoupon(id: string) {
    post(id, { coupon_code: couponDraft[id] ?? '' })
  }

  if (denied) {
    return (
      <div style={{ background: PAGE_BG, minHeight: '100vh' }}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="rounded-2xl p-10" style={{ background: CARD, border: BORDER }}>
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-black" style={{ color: TEXT }}>Not authorized</h1>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>Admin only.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: PAGE_BG, minHeight: '100vh' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 pb-24">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[.16em]" style={{ color: CYAN }}>
              Admin
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: TEXT }}>
              Affiliates
            </h1>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              {affiliates ? `${affiliates.length} affiliate${affiliates.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <nav className="flex gap-2 text-[12px] font-bold">
            <a
              href="/api/admin/affiliates/export"
              className="rounded-lg px-2.5 py-1.5"
              style={{ background: 'rgba(34,211,238,.12)', color: CYAN, border: '1px solid rgba(34,211,238,.3)' }}
            >
              Export commissions CSV
            </a>
            <Link
              href="/admin/funnel"
              className="rounded-lg px-2.5 py-1.5"
              style={{ background: 'rgba(255,255,255,.05)', color: MUTED, border: BORDER }}
            >
              ← Funnel
            </Link>
          </nav>
        </div>

        {loading && !affiliates ? (
          <div className="rounded-2xl" style={{ background: CARD, border: BORDER, height: 200 }} />
        ) : (
          <div className="rounded-2xl overflow-x-auto" style={{ background: CARD, border: BORDER }}>
            <table className="w-full text-left text-xs" style={{ minWidth: 920 }}>
              <thead>
                <tr style={{ color: MUTED }}>
                  <th className="px-3 py-3 font-bold">Affiliate</th>
                  <th className="px-3 py-3 font-bold">Code</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Rate %</th>
                  <th className="px-3 py-3 font-bold">Clicks</th>
                  <th className="px-3 py-3 font-bold">Signups</th>
                  <th className="px-3 py-3 font-bold">Paid</th>
                  <th className="px-3 py-3 font-bold">Owed</th>
                  <th className="px-3 py-3 font-bold">Coupon</th>
                  <th className="px-3 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(affiliates ?? []).map((a) => {
                  const status = (a.status ?? '').toLowerCase()
                  const busy = busyId === a.id
                  return (
                    <tr key={a.id} style={{ borderTop: BORDER, color: TEXT }}>
                      {/* Name / email */}
                      <td className="px-3 py-3" style={{ maxWidth: 220 }}>
                        <div className="font-bold truncate" style={{ color: TEXT }}>{a.name || '—'}</div>
                        <div className="truncate" style={{ color: MUTED }}>{a.email || '—'}</div>
                      </td>
                      {/* Code */}
                      <td className="px-3 py-3">
                        <span className="font-black px-2 py-0.5 rounded" style={{ background: 'rgba(34,211,238,.12)', color: CYAN }}>
                          {a.code}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                      {/* Rate editor */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={rateDraft[a.id] ?? ''}
                            onChange={(e) => setRateDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                            className="w-14 rounded-md px-2 py-1 text-xs"
                            style={{ background: 'rgba(13,13,28,.85)', border: BORDER, color: TEXT, outline: 'none' }}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveRate(a.id)}
                            className="rounded-md px-2 py-1 text-[11px] font-bold"
                            style={{ background: 'rgba(34,211,238,.12)', color: CYAN, border: '1px solid rgba(34,211,238,.3)', cursor: busy ? 'default' : 'pointer' }}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                      {/* Counts */}
                      <td className="px-3 py-3" style={{ color: MUTED }}>{a.clicks.toLocaleString('en-US')}</td>
                      <td className="px-3 py-3" style={{ color: MUTED }}>{a.signups.toLocaleString('en-US')}</td>
                      <td className="px-3 py-3" style={{ color: a.paid > 0 ? GREEN : MUTED }}>{a.paid.toLocaleString('en-US')}</td>
                      {/* Owed */}
                      <td className="px-3 py-3 font-black" style={{ color: a.owed > 0 ? '#fbbf24' : MUTED }}>{dollars(a.owed)}</td>
                      {/* Coupon editor */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={couponDraft[a.id] ?? ''}
                            placeholder="—"
                            onChange={(e) => setCouponDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                            className="w-24 rounded-md px-2 py-1 text-xs"
                            style={{ background: 'rgba(13,13,28,.85)', border: BORDER, color: TEXT, outline: 'none' }}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveCoupon(a.id)}
                            className="rounded-md px-2 py-1 text-[11px] font-bold"
                            style={{ background: 'rgba(255,255,255,.05)', color: MUTED, border: BORDER, cursor: busy ? 'default' : 'pointer' }}
                          >
                            Set
                          </button>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {status === 'pending' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => post(a.id, { action: 'approve' })}
                              className="rounded-md px-2.5 py-1 text-[11px] font-black"
                              style={{ background: 'rgba(52,211,153,.14)', color: GREEN, border: '1px solid rgba(52,211,153,.35)', cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Approve
                            </button>
                          ) : null}
                          {status === 'suspended' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => post(a.id, { action: 'activate' })}
                              className="rounded-md px-2.5 py-1 text-[11px] font-black"
                              style={{ background: 'rgba(52,211,153,.14)', color: GREEN, border: '1px solid rgba(52,211,153,.35)', cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => post(a.id, { action: 'suspend' })}
                              className="rounded-md px-2.5 py-1 text-[11px] font-black"
                              style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)', cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {affiliates && affiliates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center" style={{ color: MUTED }}>
                      No affiliates yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
