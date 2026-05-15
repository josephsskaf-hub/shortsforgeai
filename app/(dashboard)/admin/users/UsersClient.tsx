'use client'

// Push #065 — Admin Users List (client).
// Fetches /api/admin/users on mount and renders four headline metric
// cards + a searchable, scrollable table. Sort defaults to newest first
// (server already orders that way). Search filters by email/name client-side.

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (denied) return
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/users', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        const json = await r.json()
        if (cancelled) return
        if (Array.isArray(json.users)) {
          setUsers(json.users)
        } else {
          setUsers([])
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[admin/users] fetch failed:', e)
        setError('Failed to load users.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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
              background: 'rgba(15,15,30,0.85)',
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
                <tr style={{ background: 'rgba(15,15,30,0.4)' }}>
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
        background: 'rgba(15,15,30,0.85)',
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
