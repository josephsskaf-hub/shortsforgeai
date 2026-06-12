'use client'

// Push #066 — Admin Users List (client).
// Fetches /api/admin/users on mount and polls every 30 s.
// Renders four headline metric cards + a searchable, scrollable table.
// Sort defaults to newest first (server already orders that way).
// Search filters by email/name client-side.

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

const POLL_MS = 30_000

interface AdminUserRow {
  id: string
  email: string
  name: string | null
  created_at: string
  credits: number | null
  videos_count: number
  last_video_at: string | null
  plan: string | null
  checkout_abandoned: boolean
}

interface Props {
  viewerEmail?: string
  denied?: boolean
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-US')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function UsersClient({ viewerEmail, denied }: Props) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick the "X s ago" clock every second
  useEffect(() => {
    clockRef.current = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000))
      }
    }, 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [lastUpdated])

  // Initial load + 30 s polling
  useEffect(() => {
    if (denied) return

    async function fetchUsers(isInitial: boolean) {
      if (isInitial) setLoading(true)
      else setRefreshing(true)
      try {
        const r = await fetch('/api/admin/users', { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (Array.isArray(json.users)) {
          setUsers(json.users)
          setLastUpdated(new Date())
          setSecondsAgo(0)
        } else {
          setUsers([])
        }
      } catch (e) {
        console.error('[admin/users] fetch failed:', e)
        if (isInitial) setError('Failed to load users.')
        // on poll failure just keep stale data
      } finally {
        if (isInitial) setLoading(false)
        else setRefreshing(false)
      }
    }

    fetchUsers(true)
    timerRef.current = setInterval(() => fetchUsers(false), POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [denied])

  const stats = useMemo(() => {
    if (!users) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTs = today.getTime()
    let newToday = 0
    let withVideos = 0
    let totalVideos = 0
    // Push #253 — plan breakdown + credit health
    let pro = 0
    let basic = 0
    let free = 0
    let paidNoCredits = 0 // paid users with 0 or null credits (flag for credit issues)
    for (const u of users) {
      const t = u.created_at ? new Date(u.created_at).getTime() : 0
      if (t >= todayTs) newToday++
      if (u.videos_count > 0) withVideos++
      totalVideos += u.videos_count
      const p = (u.plan ?? '').toLowerCase()
      if (p === 'pro') pro++
      else if (p === 'basic') basic++
      else free++
      // Flag paid users whose credits are 0 or null (likely an issue)
      if ((p === 'pro' || p === 'basic') && (u.credits === null || u.credits <= 0)) {
        paidNoCredits++
      }
    }
    // Push #274 — count abandoned checkouts
    let checkoutAbandoned = 0
    for (const u of users) {
      if (u.checkout_abandoned) checkoutAbandoned++
    }
    return {
      total: users.length,
      newToday,
      withVideos,
      totalVideos,
      pro,
      basic,
      free,
      paidNoCredits,
      checkoutAbandoned,
    }
  }, [users])

  const filtered = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, query])

  if (denied) {
    return (
      <div className="px-4 sm:px-6 py-10 pb-20 max-w-3xl mx-auto">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Admin access required.
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Please sign in with an authorized account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-6xl mx-auto">
      <header className="mb-6">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: '#6ee7b7' }}
        >
          Admin · Staging
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="font-black tracking-tight mb-1"
              style={{ fontSize: '1.6rem', color: 'var(--text)' }}
            >
              Users
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live from auth.users + public.videos on staging Supabase. Signed in
              as {viewerEmail}.
            </p>
          </div>
          <RefreshIndicator refreshing={refreshing} secondsAgo={secondsAgo} lastUpdated={lastUpdated} />
        </div>

        <AdminNav active="users" />
      </header>

      {/* Push #253 — row 1: traffic stats */}
      <section className="mb-3">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          <MetricCard label="Total users"           value={stats?.total ?? null}       hint="auth.users" />
          <MetricCard label="New today"             value={stats?.newToday ?? null}     hint="signed up since 00:00 local" />
          <MetricCard label="Users with videos"     value={stats?.withVideos ?? null}   hint="videos_count > 0" />
          <MetricCard label="Total videos"          value={stats?.totalVideos ?? null}  hint="sum across all users" />
        </div>
      </section>

      {/* Push #253 — row 2: plan breakdown + credit health */}
      <section className="mb-6">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          <MetricCard label="Pro subscribers"   value={stats?.pro   ?? null} hint="plan = pro"   accent="#34d399" />
          <MetricCard label="Basic subscribers" value={stats?.basic ?? null} hint="plan = basic" accent="#34d399" />
          <MetricCard label="Free users"        value={stats?.free  ?? null} hint="no paid plan" accent="#94a3b8" />
          <MetricCard
            label="Paid · 0 credits ⚠️"
            value={stats?.paidNoCredits ?? null}
            hint="pro/basic with no credits"
            accent={stats?.paidNoCredits ? '#f87171' : '#34d399'}
          />
          <MetricCard
            label="Checkout abandonado 🔥"
            value={stats?.checkoutAbandoned ?? null}
            hint="Stripe customer criado, sem plano pago"
            accent={stats?.checkoutAbandoned ? '#fb923c' : '#94a3b8'}
          />
        </div>
      </section>

      {/* Push #274 — Checkout abandoned spotlight table */}
      {users && users.filter(u => u.checkout_abandoned).length > 0 && (
        <section className="mb-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: '#fb923c' }}>
            🔥 Checkout Abandonado — leads quentes
          </h2>
          <p className="text-[11px] mb-3" style={{ color: 'var(--muted)' }}>
            Esses usuários criaram um customer no Stripe mas não finalizaram o pagamento. São os mais próximos de converter.
          </p>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--card)', border: '1px solid rgba(251,146,60,0.3)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(11,17,32,0.5)' }}>
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>Joined</Th>
                  <Th align="right">Videos made</Th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(u => u.checkout_abandoned)
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                  .map(u => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td mono>{u.email || '—'}</Td>
                      <Td>{u.name || '—'}</Td>
                      <Td>{fmtDate(u.created_at)}</Td>
                      <Td align="right">{fmt(u.videos_count)}</Td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Push #255 — Paid subscribers spotlight table */}
      {users && users.filter(u => {
        const p = (u.plan ?? '').toLowerCase()
        return p === 'pro' || p === 'basic'
      }).length > 0 && (
        <section className="mb-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>
            Paid Subscribers
          </h2>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(11,17,32,0.5)' }}>
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>Plan</Th>
                  <Th align="right">Credits left</Th>
                  <Th align="right">Videos made</Th>
                  <Th>Joined</Th>
                  <Th>Last video</Th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(u => {
                    const p = (u.plan ?? '').toLowerCase()
                    return p === 'pro' || p === 'basic'
                  })
                  .sort((a, b) => {
                    // Pro first, then by join date
                    const ap = (a.plan ?? '').toLowerCase()
                    const bp = (b.plan ?? '').toLowerCase()
                    if (ap !== bp) return ap === 'pro' ? -1 : 1
                    return a.created_at < b.created_at ? 1 : -1
                  })
                  .map(u => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td mono>{u.email || '—'}</Td>
                      <Td>{u.name || '—'}</Td>
                      <Td><PlanBadge plan={u.plan} credits={u.credits} /></Td>
                      <Td align="right">
                        <span style={{
                          fontWeight: 700,
                          color: u.credits === null ? '#94a3b8'
                            : u.credits <= 0 ? '#f87171'
                            : u.credits <= 5 ? '#fbbf24'
                            : '#34d399',
                          fontSize: '0.95rem',
                        }}>
                          {u.credits === null ? '—' : u.credits}
                        </span>
                      </Td>
                      <Td align="right">{fmt(u.videos_count)}</Td>
                      <Td>{fmtDate(u.created_at)}</Td>
                      <Td>{fmtDate(u.last_video_at)}</Td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section
        className="rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or name…"
            className="rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            style={{
              background: 'rgba(11,17,32,0.85)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {users ? `${filtered.length} / ${users.length}` : ''}
          </div>
        </div>

        {loading && !users && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Loading users…
          </div>
        )}

        {error && !loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {!loading && !error && users && filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
            No users found.
          </div>
        )}

        {!error && users && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(11,17,32,0.4)' }}>
                  <Th>Email</Th>
                  <Th>Name</Th>
                  <Th>Joined</Th>
                  <Th align="right">Credits</Th>
                  <Th align="right">Videos</Th>
                  <Th align="center">Used Credit</Th>
                  <Th>Last Video</Th>
                  <Th>Plan</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <Td mono>{u.email || '—'}</Td>
                    <Td>{u.name || '—'}</Td>
                    <Td>{fmtDate(u.created_at)}</Td>
                    <Td align="right">{fmt(u.credits)}</Td>
                    <Td align="right">{fmt(u.videos_count)}</Td>
                    <Td align="center">{u.videos_count >= 1 ? '✅ Yes' : '❌ No'}</Td>
                    <Td>{fmtDate(u.last_video_at)}</Td>
                    <Td><PlanBadge plan={u.plan} credits={u.credits} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function RefreshIndicator({
  refreshing,
  secondsAgo,
  lastUpdated,
}: {
  refreshing: boolean
  secondsAgo: number
  lastUpdated: Date | null
}) {
  if (!lastUpdated) return null
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: 'var(--muted)' }}
    >
      {refreshing ? (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#22D3EE',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'rgba(52,211,153,0.7)',
          }}
        />
      )}
      {refreshing ? 'Refreshing…' : `Updated ${secondsAgo}s ago`}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number | null
  hint?: string
  accent?: string
}) {
  const isAvailable = value !== null && value !== undefined
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(11,17,32,0.85)',
        border: `1px solid ${accent ? `${accent}33` : 'var(--border)'}`,
      }}
    >
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: accent ?? 'var(--muted)' }}
      >
        {label}
      </div>
      <div
        className="font-black"
        style={{
          fontSize: '1.7rem',
          lineHeight: 1.1,
          color: isAvailable ? (accent ?? 'var(--text)') : 'var(--muted2)',
        }}
      >
        {isAvailable ? fmt(value) : '—'}
      </div>
      {hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

// Push #253 — colored plan badge for the table
function PlanBadge({ plan, credits }: { plan: string | null; credits: number | null }) {
  const p = (plan ?? '').toLowerCase()
  if (p === 'pro') {
    const hasCredits = credits !== null && credits > 0
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: 'rgba(52,211,153,.12)', color: '#34d399', border: '1px solid rgba(52,211,153,.3)' }}
        >
          Pro
        </span>
        {!hasCredits && (
          <span title="0 credits — check webhook" style={{ color: '#f87171', fontSize: 12 }}>⚠️</span>
        )}
      </span>
    )
  }
  if (p === 'basic') {
    const hasCredits = credits !== null && credits > 0
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: 'rgba(52,211,153,.12)', color: '#34d399', border: '1px solid rgba(52,211,153,.3)' }}
        >
          Basic
        </span>
        {!hasCredits && (
          <span title="0 credits — check webhook" style={{ color: '#f87171', fontSize: 12 }}>⚠️</span>
        )}
      </span>
    )
  }
  return <span style={{ color: 'var(--muted)', fontSize: 12 }}>Free</span>
}

function AdminNav({ active }: { active: 'metrics' | 'funnel' | 'users' | 'ceo' }) {
  const tabs: Array<{ key: 'metrics' | 'funnel' | 'users' | 'ceo'; label: string; href: string }> = [
    { key: 'ceo', label: 'CEO', href: '/admin/ceo' },
    { key: 'metrics', label: 'Metrics', href: '/admin/metrics' },
    { key: 'funnel', label: 'Funnel', href: '/admin/funnel' },
    { key: 'users', label: 'Users', href: '/admin/users' },
  ]
  return (
    <nav className="mt-4 flex items-center gap-2 flex-wrap">
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            className="text-xs font-bold rounded-lg px-3 py-1.5"
            style={{
              background: isActive ? 'rgba(5, 150, 105,.18)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${isActive ? 'rgba(5, 150, 105,.45)' : 'var(--border)'}`,
              color: isActive ? '#22D3EE' : 'var(--muted2)',
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      className="font-black uppercase tracking-widest"
      style={{
        fontSize: '0.62rem',
        color: 'var(--muted)',
        textAlign: align,
        padding: '10px 14px',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  mono,
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
  mono?: boolean
}) {
  return (
    <td
      style={{
        padding: '10px 14px',
        color: 'var(--text)',
        textAlign: align,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        fontSize: mono ? '0.82rem' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}
