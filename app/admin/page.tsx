// Push #164 — fix /admin auth: redirect unauthenticated → /login?next=/admin,
// expand ADMIN_EMAILS to include all variants, show denied card for non-admins.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'josephskaf@hotmail.com',
  'joseph-test@shortsforgeai.com',
])

const BASIC_PRICE = 4.9
const PRO_PRICE = 9.9

interface RecentUser {
  id: string
  email: string | null
  is_pro: boolean | null
  plan: string | null
  video_credits?: number | null
  cinematic_tokens?: number | null
  created_at: string
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }
  if (!ADMIN_EMAILS.has((user.email ?? '').toLowerCase())) {
    return (
      <main style={{
        minHeight: '100vh', background: '#07080F',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
          borderRadius: 16, padding: '32px 40px', textAlign: 'center', maxWidth: 380,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F87171', marginBottom: 8 }}>
            Access denied
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
            {user.email} is not authorised to view this page.
          </div>
          <Link href="/generate" style={{
            display: 'inline-block', marginTop: 20,
            padding: '10px 20px', borderRadius: 10,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
            color: '#CBD5E1', fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none',
          }}>
            ← Back to app
          </Link>
        </div>
      </main>
    )
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekIso = weekStart.toISOString()

  // Service-role client — needed to count from auth.users (anon key cannot access it)
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const [
    authUsersRes,
    paidUsersRes,
    basicUsersRes,
    proUsersRes,
    totalVideosRes,
    videosTodayRes,
    newUsersWeekRes,
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'basic'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekIso),
  ])

  const totalUsers = authUsersRes.data?.users?.length ?? 0
  const paidUsers = paidUsersRes.count ?? 0
  const basicUsers = basicUsersRes.count ?? 0
  const proUsers = proUsersRes.count ?? 0
  const totalVideos = totalVideosRes.count ?? 0
  const videosToday = videosTodayRes.count ?? 0
  const newUsersWeek = newUsersWeekRes.count ?? 0
  const freeUsers = Math.max(0, totalUsers - paidUsers)
  const conversionRate = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : '0.0'
  const mrr = basicUsers * BASIC_PRICE + proUsers * PRO_PRICE

  // Recent users — try with all columns first
  let recentUsers: RecentUser[] = []
  let hasCinematic = true
  {
    const full = await supabase
      .from('profiles')
      .select('id, email, is_pro, plan, video_credits, cinematic_tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(15)
    if (full.error) {
      hasCinematic = false
      const fallback = await supabase
        .from('profiles')
        .select('id, email, is_pro, plan, video_credits, created_at')
        .order('created_at', { ascending: false })
        .limit(15)
      recentUsers = (fallback.data ?? []) as RecentUser[]
    } else {
      recentUsers = (full.data ?? []) as RecentUser[]
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#07080F',
      color: '#F0F4FF',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '28px 20px 80px',
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
          flexWrap: 'wrap', marginBottom: 32,
        }}>
          <div>
            <div style={{
              fontSize: '0.6rem', fontWeight: 900, letterSpacing: '.18em',
              textTransform: 'uppercase', color: '#22D3EE', marginBottom: 6,
            }}>
              Owner Dashboard
            </div>
            <h1 style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900,
              letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1,
            }}>
              ShortsForgeAI Admin
            </h1>
            <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#64748B' }}>
              Last refreshed: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <Link href="/generate" style={{
            padding: '10px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.09)',
            color: '#CBD5E1', fontSize: '0.82rem', fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            ← Back to app
          </Link>
        </div>

        {/* Nav to other admin pages */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28,
        }}>
          {[
            { href: '/admin', label: '📊 Overview', active: true },
            { href: '/admin/users', label: '👥 Users', active: false },
            { href: '/admin/metrics', label: '📈 Metrics', active: false },
            { href: '/admin/funnel', label: '🔻 Funnel', active: false },
          ].map(({ href, label, active }) => (
            <Link key={href} href={href} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
              textDecoration: 'none',
              background: active ? 'rgba(34,211,238,.12)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${active ? 'rgba(34,211,238,.3)' : 'rgba(255,255,255,.07)'}`,
              color: active ? '#22D3EE' : '#94A3B8',
            }}>
              {label}
            </Link>
          ))}
        </div>

        {/* MRR hero */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,.08) 0%, rgba(167,139,250,.08) 100%)',
          border: '1px solid rgba(34,211,238,.18)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: '0.6rem', fontWeight: 900, letterSpacing: '.16em',
              textTransform: 'uppercase', color: '#22D3EE', marginBottom: 8,
            }}>
              Estimated MRR
            </div>
            <div style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900,
              letterSpacing: '-0.03em', color: '#F0F4FF',
              fontVariantNumeric: 'tabular-nums',
            }}>
              ${mrr.toFixed(2)}
            </div>
            <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#64748B' }}>
              {basicUsers} Basic × ${BASIC_PRICE} + {proUsers} Pro × ${PRO_PRICE}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <MiniStat label="Annual run rate" value={`$${(mrr * 12).toFixed(0)}`} color="#22D3EE" />
            <MiniStat label="Avg revenue/user" value={paidUsers > 0 ? `$${(mrr / paidUsers).toFixed(2)}` : '—'} color="#A78BFA" />
            <MiniStat label="New this week" value={`+${newUsersWeek}`} color="#34D399" />
          </div>
        </div>

        {/* Metric cards */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <MetricCard label="Total users" value={totalUsers.toLocaleString()} accent="#22D3EE" />
          <MetricCard
            label="Paid users"
            value={paidUsers.toLocaleString()}
            sub={`${conversionRate}% conversion`}
            accent="#34D399"
          />
          <MetricCard label="Free users" value={freeUsers.toLocaleString()} accent="#64748B" />
          <MetricCard label="Videos generated" value={totalVideos.toLocaleString()} accent="#A78BFA" />
          <MetricCard label="Videos today" value={videosToday.toLocaleString()} accent="#FBBF24" />
        </section>

        {/* Plan breakdown */}
        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12, marginBottom: 28,
        }}>
          <PlanCard
            label="Basic plan"
            count={basicUsers}
            price={BASIC_PRICE}
            color="#60A5FA"
            pct={paidUsers > 0 ? Math.round((basicUsers / paidUsers) * 100) : 0}
          />
          <PlanCard
            label="Pro plan"
            count={proUsers}
            price={PRO_PRICE}
            color="#F59E0B"
            pct={paidUsers > 0 ? Math.round((proUsers / paidUsers) * 100) : 0}
          />
          <div style={{
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{
              fontSize: '0.6rem', fontWeight: 900, letterSpacing: '.14em',
              textTransform: 'uppercase', color: '#64748B', marginBottom: 10,
            }}>
              Free users
            </div>
            <div style={{
              fontSize: '1.7rem', fontWeight: 900, color: '#F0F4FF',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {freeUsers.toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#64748B' }}>
              {totalUsers > 0 ? Math.round((freeUsers / totalUsers) * 100) : 0}% of all users
            </div>
            <div style={{
              marginTop: 10, height: 4, borderRadius: 4,
              background: 'rgba(255,255,255,.06)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${totalUsers > 0 ? Math.round((freeUsers / totalUsers) * 100) : 0}%`,
                background: '#475569',
              }} />
            </div>
          </div>
        </section>

        {/* Recent signups */}
        <section style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F0F4FF' }}>
                Recent signups
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                Last {recentUsers.length} users
              </div>
            </div>
            <Link href="/admin/users" style={{
              fontSize: '0.75rem', color: '#22D3EE', textDecoration: 'none', fontWeight: 700,
            }}>
              View all →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: '0.83rem',
              minWidth: hasCinematic ? 620 : 520,
            }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                  <Th>Email</Th>
                  <Th>Plan</Th>
                  <Th>Credits</Th>
                  {hasCinematic && <Th>🎬</Th>}
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={hasCinematic ? 5 : 4} style={{
                      padding: '28px 20px', textAlign: 'center', color: '#64748B',
                    }}>
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
                      <Td>
                        <span style={{ color: '#F0F4FF' }}>{u.email ?? '—'}</span>
                      </Td>
                      <Td>
                        <PlanBadge plan={u.plan} isPro={!!u.is_pro} />
                      </Td>
                      <Td>
                        <span style={{ color: '#F0F4FF', fontVariantNumeric: 'tabular-nums' }}>
                          {u.video_credits ?? 0}
                        </span>
                      </Td>
                      {hasCinematic && (
                        <Td>
                          <span style={{ color: u.cinematic_tokens ? '#F59E0B' : '#374151', fontVariantNumeric: 'tabular-nums' }}>
                            {u.cinematic_tokens ?? 0}
                          </span>
                        </Td>
                      )}
                      <Td>
                        <span style={{ color: '#64748B' }}>{formatDate(u.created_at)}</span>
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

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 14, padding: '16px 18px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0,
        width: 3, height: '100%',
        background: accent, opacity: 0.75,
      }} />
      <div style={{
        fontSize: '0.6rem', fontWeight: 900, letterSpacing: '.14em',
        textTransform: 'uppercase', color: '#64748B', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.02em',
        color: '#F0F4FF', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function PlanCard({ label, count, price, color, pct }: {
  label: string; count: number; price: number; color: string; pct: number
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: `1px solid ${color}22`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{
        fontSize: '0.6rem', fontWeight: 900, letterSpacing: '.14em',
        textTransform: 'uppercase', color, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.7rem', fontWeight: 900, color: '#F0F4FF',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {count.toLocaleString()}
      </div>
      <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#64748B' }}>
        ${(count * price).toFixed(2)}/mo · {pct}% of paid
      </div>
      <div style={{
        marginTop: 10, height: 4, borderRadius: 4,
        background: 'rgba(255,255,255,.06)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`, background: color,
        }} />
      </div>
    </div>
  )
}

function PlanBadge({ plan, isPro }: { plan: string | null; isPro: boolean }) {
  const label = plan === 'pro' ? '★ Pro' : plan === 'basic' ? 'Basic' : isPro ? '★ Pro' : 'Free'
  const color = plan === 'pro' || isPro ? '#F59E0B' : plan === 'basic' ? '#60A5FA' : '#475569'
  const bg = plan === 'pro' || isPro
    ? 'rgba(245,158,11,.1)'
    : plan === 'basic'
    ? 'rgba(96,165,250,.1)'
    : 'rgba(71,85,105,.15)'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      fontSize: '0.62rem', fontWeight: 900, letterSpacing: '.08em',
      textTransform: 'uppercase', background: bg,
      border: `1px solid ${color}44`, color,
    }}>
      {label}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 20px',
      fontSize: '0.62rem', fontWeight: 900, letterSpacing: '.12em',
      textTransform: 'uppercase', color: '#64748B',
    }}>
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>{children}</td>
}
