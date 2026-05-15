'use client'

import { useRouter } from 'next/navigation'

interface UpgradeModalProps {
  onClose: () => void
  generationsUsed: number
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  const router = useRouter()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.88)', backdropFilter: 'blur(20px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 animate-fade-in text-center relative"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(59, 130, 246,.25)',
          boxShadow: '0 0 80px rgba(59, 130, 246,.18)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
          }}
        >
          ✕
        </button>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246,.2), rgba(37, 99, 235,.15))',
            border: '1px solid rgba(59, 130, 246,.3)',
          }}
        >
          ⚡
        </div>

        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
          style={{
            background: 'rgba(245,158,11,.12)',
            border: '1px solid rgba(245,158,11,.25)',
            color: '#22D3EE',
          }}
        >
          🔒 Free Limit Reached
        </div>

        <h2
          className="text-2xl font-black mb-2 tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          You&apos;ve used all your{' '}
          <span className="grad-text">free generations</span>
        </h2>
        <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
          Get more videos with a one-time credit pack. No subscription needed.
        </p>

        {/* Features */}
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{
            background: 'rgba(59, 130, 246,.05)',
            border: '1px solid rgba(59, 130, 246,.12)',
          }}
        >
          {[
            '⚡ Up to 350 credits / month',
            '🎯 All trending niches',
            '📋 Full copy-paste scripts',
            '🎬 AI video prompts',
            '📊 Generation history',
            '🔥 Priority support',
          ].map((f) => (
            <div
              key={f}
              className="flex items-center gap-2 py-1.5 text-sm"
              style={{ color: 'var(--text2)' }}
            >
              <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/pricing')}
          className="w-full rounded-xl py-4 font-black text-base text-white mb-3 transition-all"
          style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #22D3EE 100%)',
            boxShadow: '0 4px 28px rgba(59, 130, 246,.45)',
            animation: 'btn-pulse 2.8s ease-in-out infinite',
            cursor: 'pointer',
          }}
        >
          Launch offer — 50% off first month →
        </button>

        <button
          onClick={() => router.push('/pricing')}
          className="w-full text-sm font-medium transition-colors"
          style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          View pricing details →
        </button>
      </div>
    </div>
  )
}
