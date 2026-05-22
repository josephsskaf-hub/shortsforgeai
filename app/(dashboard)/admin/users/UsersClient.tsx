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
    for (const u of users) {
      const t = u.created_at ? new Date(u.created_at).getTime() : 0
      if (t >= todayTs) newToday++
      if (u.videos_count > 0) withVideos++
      totalVideos += u.videos_count
    }
    return {
      total: users.length,
      newToday,
      withVideos,
      totalVideos,
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
          style={{ fontSize: '0.62rem', color: '#93c5fd' }}
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

      <section className="mb-6">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          <MetricCard
            label="Total users"
            value={stats?.total ?? null}
            hint="auth.users"
          />
          <MetricCard
            label="New today"
            value={stats?.newToday ?? null}
            hint="signed up since 00:00 local"
          />
          <MetricCard
            label="Users with videos"
            value={stats?.withVideos ?? null}
            hint="videos_count > 0"
          />
          <MetricCard
            label="Total videos generated"
            value={stats?.totalVideos ?? null}
            hint="sum across all users"
          />
        </div>
      </section>

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
                    <Td>{fmtDate(u.last_video_at)}</Td>
                    <Td>{u.plan || '—'}</Td>
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
}: {
  label: string
  value: number | null
  hint?: string
}) {
  const isAvailable = value !== null && value !== undefined
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(11,17,32,0.85)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </div>
      <div
        className="font-black"
        style={{
          fontSize: '1.7rem',
          lineHeight: 1.1,
          color: isAvailable ? 'var(--text)' : 'var(--muted2)',
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

function AdminNav({ active }: { active: 'metrics' | 'funnel' | 'users' }) {
  const tabs: Array<{ key: 'metrics' | 'funnel' | 'users'; label: string; href: string }> = [
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
              background: isActive ? 'rgba(37, 99, 235,.18)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${isActive ? 'rgba(37, 99, 235,.45)' : 'var(--border)'}`,
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
  align?: 'left' | 'right'
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
  align?: 'left' | 'right'
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
