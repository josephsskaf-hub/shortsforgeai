'use client'

// Push #060 — Conversion Metrics Dashboard (client).
// Pure presentation. The page server component does all queries and hands
// us a flat object; we render a dark card grid with one number per card and
// graceful fallbacks for unavailable metrics ("Not tracked yet" /
// "Not available").

export interface MetricsData {
  totalUsers: number | null
  newUsersToday: number | null
  totalCompleted: number | null
  videosToday: number | null
  failedVideos: number | null
  successRate: number | null
  eventsAvailable: boolean
  pricingViews: number | null
  checkoutBasicClicks: number | null
  checkoutProClicks: number | null
  generateStarted: number | null
  generateCompleted: number | null
  generateFailed: number | null
}

interface Props {
  metrics?: MetricsData
  viewerEmail?: string
  denied?: boolean
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-US')
}

export default function MetricsClient({ metrics, viewerEmail, denied }: Props) {
  if (denied || !metrics) {
    return (
      <div className="px-4 sm:px-6 py-10 pb-20 max-w-3xl mx-auto">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Access denied.
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            This page is only available to staging admins.
          </p>
        </div>
      </div>
    )
  }

  const userCards: Card[] = [
    {
      label: 'Total users',
      value: metrics.totalUsers,
      hint:
        metrics.totalUsers === null
          ? 'Service role not configured'
          : 'auth.users count',
    },
    {
      label: 'New users today',
      value: metrics.newUsersToday,
      hint:
        metrics.newUsersToday === null
          ? 'Service role not configured'
          : 'since 00:00 UTC',
    },
  ]

  const videoCards: Card[] = [
    {
      label: 'Completed videos',
      value: metrics.totalCompleted,
      hint: 'status = completed',
    },
    {
      label: 'Videos today',
      value: metrics.videosToday,
      hint: 'created since 00:00 UTC',
    },
    {
      label: 'Failed generations',
      value: metrics.failedVideos,
      hint: metrics.failedVideos === null ? 'status column not available' : 'status = failed',
    },
    {
      label: 'Generation success rate',
      value:
        metrics.successRate === null ? null : `${metrics.successRate}%`,
      hint:
        metrics.successRate === null
          ? 'Need both completed + failed counts'
          : 'completed / (completed + failed)',
    },
  ]

  const eventCards: Card[] = [
    { label: 'Pricing views', value: metrics.pricingViews, eventName: 'pricing_view' },
    { label: 'Checkout · Basic clicks', value: metrics.checkoutBasicClicks, eventName: 'checkout_basic_click' },
    { label: 'Checkout · Pro clicks', value: metrics.checkoutProClicks, eventName: 'checkout_pro_click' },
    { label: 'Generate started', value: metrics.generateStarted, eventName: 'generate_started' },
    { label: 'Generate completed', value: metrics.generateCompleted, eventName: 'generate_completed' },
    { label: 'Generate failed', value: metrics.generateFailed, eventName: 'generate_failed' },
  ]

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      <header className="mb-6">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: '#93c5fd' }}
        >
          Admin · Staging
        </div>
        <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
          Conversion Metrics
        </h1>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Live counts from the staging Supabase project. Signed in as {viewerEmail}.
        </p>
      </header>

      <Section title="Users">
        <Grid>
          {userCards.map((c) => (
            <MetricCard key={c.label} card={c} />
          ))}
        </Grid>
      </Section>

      <Section title="Videos">
        <Grid>
          {videoCards.map((c) => (
            <MetricCard key={c.label} card={c} />
          ))}
        </Grid>
      </Section>

      <Section
        title="Funnel events"
        subtitle={
          metrics.eventsAvailable
            ? 'Tracked via public.events (event name + created_at).'
            : 'public.events table not present in this database.'
        }
      >
        <Grid>
          {eventCards.map((c) => (
            <MetricCard
              key={c.label}
              card={{
                ...c,
                value: metrics.eventsAvailable ? c.value : null,
                hint: metrics.eventsAvailable
                  ? c.eventName
                  : 'Not tracked yet',
              }}
            />
          ))}
        </Grid>
      </Section>
    </div>
  )
}

interface Card {
  label: string
  value: number | string | null
  hint?: string
  eventName?: string
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <div className="mb-3">
        <h2
          className="font-black tracking-tight mb-0.5"
          style={{ fontSize: '0.95rem', color: 'var(--text)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      {children}
    </div>
  )
}

function MetricCard({ card }: { card: Card }) {
  const isString = typeof card.value === 'string'
  const isAvailable = card.value !== null && card.value !== undefined
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
        {card.label}
      </div>
      <div
        className="font-black"
        style={{
          fontSize: '1.7rem',
          lineHeight: 1.1,
          color: isAvailable ? 'var(--text)' : 'var(--muted2)',
        }}
      >
        {isAvailable ? (isString ? (card.value as string) : fmt(card.value as number)) : '—'}
      </div>
      {card.hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
          {card.hint}
        </p>
      )}
    </div>
  )
}
