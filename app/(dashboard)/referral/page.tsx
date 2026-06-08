// Push #444 — Invite & Earn page. The referral card used to live inside the
// dead /dashboard page; this surfaces it on a real, reachable route. Auth +
// referral attribution are handled by the dashboard layout, so this page just
// renders a title and the client card.
import ReferralCard from '@/components/ReferralCard'

export const metadata = { title: 'Invite & Earn — ShortsForgeAI' }

export default function ReferralPage() {
  return (
    <div className="px-4 sm:px-6 py-7 pb-28 md:pb-20 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <header className="mb-7">
        <div
          className="font-black uppercase tracking-[.18em] mb-3 flex items-center gap-2"
          style={{ fontSize: '0.65rem', color: '#22D3EE' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          Referrals
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
        </div>

        <h1
          className="font-black tracking-tight mb-2"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', color: 'var(--text)', lineHeight: 1.08 }}
        >
          Invite &amp;{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 60%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Earn
          </span>
        </h1>

        <p className="text-sm" style={{ color: 'var(--muted2)', maxWidth: 520, lineHeight: 1.55 }}>
          Share your link — you and every friend each get free credits when they create their first
          video. No limit on how many friends you can invite.
        </p>
      </header>

      <ReferralCard />
    </div>
  )
}
