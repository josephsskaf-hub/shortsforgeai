// Push #115 — top-level /admin dashboard.
//
// This lives at the app-router root (NOT under the (dashboard) group)
// so it gets no Sidebar / DashboardShell chrome — a focused page just
// for the owner. The existing (dashboard)/admin/* pages are different
// drill-downs (users list, metrics, funnel) and stay as-is.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'josephsskaf@gmail.com'

interface RecentUser {
  id: string
  email: string | null
  is_pro: boolean | null
  created_at: string
  video_credits?: number | null
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default async function AdminPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    redirect('/generate')
  }

  // Aggregate counts. head:true + count:'exact' returns only the count,
  // not the rows — cheap enough to run four in parallel.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const [totalUsersRes, paidUsersRes, totalVideosRes, videosTodayRes] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_pro', true),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayIso),
    ])

  const totalUsers = totalUsersRes.count ?? 0
  const paidUsers = paidUsersRes.count ?? 0
  const totalVideos = totalVideosRes.count ?? 0
  const videosToday = videosTodayRes.count ?? 0
  const freeUsers = Math.max(0, totalUsers - paidUsers)
  const conversionRate =
    totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : '0.0'

  // Recent signups. Try with `video_credits` first; if the column
  // doesn't exist on this env, retry without it and skip the column
  // in the table — keeps the page rendering on schemas that haven't
  // shipped the migration yet.
  let recentUsers: RecentUser[] = []
  let hasCredits = true
  {
    const withCredits = await supabase
      .from('profiles')
      .select('id, email, is_pro, video_credits, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    if (withCredits.error) {
      hasCredits = false
      const fallback = await supabase
        .from('profiles')
        .select('id, email, is_pro, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      recentUsers = (fallback.data ?? []) as RecentUser[]
    } else {
      recentUsers = (withCredits.data ?? []) as RecentUser[]
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        color: '#F5F7FF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '24px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: '#22D3EE',
                marginBottom: 6,
              }}
            >
              Owner
            </div>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Admin Dashboard
            </h1>
          </div>
          <Link
            href="/generate"
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              color: '#F5F7FF',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ← Back to app
          </Link>
        </div>

        {/* Metric cards */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <MetricCard
            label="Total users"
            value={totalUsers.toLocaleString()}
            accent="#22D3EE"
          />
          <MetricCard
            label="Paid users"
            value={paidUsers.toLocaleString()}
            sub={`${conversionRate}% of total`}
            accent="#34D399"
          />
          <MetricCard
            label="Videos generated"
            value={totalVideos.toLocaleString()}
            accent="#A78BFA"
          />
          <MetricCard
            label="Videos today"
            value={videosToday.toLocaleString()}
            accent="#FBBF24"
          />
        </section>

        {/* Quick stats strip */}
        <section
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 28,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 18,
            fontSize: '0.85rem',
            color: '#94A3B8',
          }}
        >
          <span>
            Free users:{' '}
            <strong style={{ color: '#F5F7FF' }}>{freeUsers.toLocaleString()}</strong>
          </span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>
            Conversion:{' '}
            <strong style={{ color: '#34D399' }}>{conversionRate}%</strong>
          </span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>
            Free → Paid:{' '}
            <strong style={{ color: '#F5F7FF' }}>
              {freeUsers.toLocaleString()} → {paidUsers.toLocaleString()}
            </strong>
          </span>
        </section>

        {/* Recent signups */}
        <section
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255,255,255,.06)',
            }}
          >
            <div
              style={{
                fontSize: '0.92rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: '#F5F7FF',
              }}
            >
              Recent signups
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>
              Last {recentUsers.length} user{recentUsers.length === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                minWidth: hasCredits ? 560 : 460,
              }}
            >
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                  <Th>Email</Th>
                  <Th>Plan</Th>
                  {hasCredits && <Th>Credits</Th>}
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={hasCredits ? 4 : 3}
                      style={{
                        padding: '24px 18px',
                        textAlign: 'center',
                        color: '#94A3B8',
                      }}
                    >
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}
                    >
                      <Td>
                        <span style={{ color: '#F5F7FF' }}>
                          {u.email ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        <PlanBadge isPro={!!u.is_pro} />
                      </Td>
                      {hasCredits && (
                        <Td>
                          <span style={{ color: '#F5F7FF', fontVariantNumeric: 'tabular-nums' }}>
                            {u.video_credits ?? 0}
                          </span>
                        </Td>
                      )}
                      <Td>
                        <span style={{ color: '#94A3B8' }}>
                          {formatDate(u.created_at)}
                        </span>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 14,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 3,
          height: '100%',
          background: accent,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          fontSize: '0.62rem',
          fontWeight: 900,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.85rem',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: '#F5F7FF',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 4,
            fontSize: '0.78rem',
            color: '#94A3B8',
            fontWeight: 600,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function PlanBadge({ isPro }: { isPro: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: '0.62rem',
        fontWeight: 900,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        background: isPro ? 'rgba(52,211,153,.10)' : 'rgba(148,163,184,.10)',
        border: `1px solid ${isPro ? 'rgba(52,211,153,.32)' : 'rgba(148,163,184,.24)'}`,
        color: isPro ? '#34d399' : '#94A3B8',
      }}
    >
      {isPro ? '★ Pro' : 'Free'}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 18px',
        fontSize: '0.65rem',
        fontWeight: 900,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: '#94A3B8',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>{children}</td>
  )
}
