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
          background: '#1d1d1f',
          border: '1px solid #2a2a2d',
          boxShadow: '0 0 80px rgba(0,0,0,.5)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid #2a2a2d',
            color: '#86868b',
          }}
        >
          ✕
        </button>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
          style={{
            background: '#161618',
            border: '1px solid #2a2a2d',
          }}
        >
          ⚡
        </div>

        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
          style={{
            background: 'rgba(41,151,255,.12)',
            border: '1px solid rgba(41,151,255,.25)',
            color: '#2997ff',
          }}
        >
          🔒 Free Limit Reached
        </div>

        <h2
          className="text-2xl font-black mb-2 tracking-tight"
          style={{ color: '#f5f5f7' }}
        >
          You&apos;ve used all your{' '}
          <span className="grad-text">free renders</span>
        </h2>
        <p className="text-sm mb-7" style={{ color: '#86868b' }}>
          Activate a plan to keep your pipeline running — from $11.90/mo.
        </p>

        {/* Features */}
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{
            background: '#161618',
            border: '1px solid #2a2a2d',
          }}
        >
          {[
            '⚡ 50–100 Fast Mode renders / month',
            '🎬 AI script + voiceover pipeline',
            '🔤 Auto-captions engine',
            '📥 Watermark-free MP4 output',
            '📊 Generation history & analytics',
            '🚀 Priority render queue',
          ].map((f) => (
            <div
              key={f}
              className="flex items-center gap-2 py-1.5 text-sm"
              style={{ color: '#f5f5f7' }}
            >
              <span style={{ color: '#2997ff', fontSize: '0.8rem' }}>✓</span>
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/pricing')}
          className="w-full rounded-xl py-4 font-black text-base mb-3 transition-all"
          style={{
            background: '#f5f5f7',
            color: '#000',
            boxShadow: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#fff'
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#f5f5f7'
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          Activate Plan →
        </button>

        <button
          onClick={() => router.push('/pricing')}
          className="w-full text-sm font-medium transition-colors"
          style={{ color: '#86868b', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          View pricing details →
        </button>
      </div>
    </div>
  )
}
