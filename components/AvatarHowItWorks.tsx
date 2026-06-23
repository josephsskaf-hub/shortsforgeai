'use client'

// AI Avatar "How it works" modal (feature/ai-avatar, Nível 3) — a 3-step visual
// explainer (Upload a photo → Type your script → Get a talking video) opened
// from the entry card / paywall. Removes the "I don't get what this does"
// hesitation before someone commits a photo or a purchase. Self-contained,
// reuses the shared AvatarDemoLoop for the payoff step.
import AvatarDemoLoop from '@/components/AvatarDemoLoop'

interface AvatarHowItWorksProps {
  open: boolean
  onClose: () => void
  /** CTA target — defaults to opening the avatar panel on /generate. */
  ctaHref?: string
}

const STEPS = [
  { icon: '📸', title: 'Upload a photo', desc: 'Yours or anyone’s (with permission). One sharp, front-facing face.' },
  { icon: '✍️', title: 'Type your script', desc: 'Your words. The AI writes, voices and times everything.' },
  { icon: '🎭', title: 'Get a talking video', desc: 'That person speaks your script — lip-synced in 720p, with b-roll, captions & music.' },
]

export default function AvatarHowItWorks({ open, onClose, ctaHref = '/generate?avatar=1' }: AvatarHowItWorksProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#0d0d1a', border: '1.5px solid rgba(139,92,246,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="text-lg font-black" style={{ color: '#a7f3d0' }}>🎭 How AI Avatar works</div>
          <button type="button" onClick={onClose} className="text-sm font-bold" style={{ color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="text-xs mb-5" style={{ color: 'var(--muted2)' }}>
          No camera, no mic, no editing — a real person speaking your script in about a minute.
        </div>

        <div className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black" style={{ background: 'rgba(139,92,246,0.2)', color: '#a7f3d0' }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: '#c4b5fd' }}>{s.icon} {s.title}</div>
                <div className="text-xs" style={{ color: 'var(--muted2)' }}>{s.desc}</div>
              </div>
              {i === STEPS.length - 1 && <AvatarDemoLoop size={40} />}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.18)', color: '#a7f3d0', border: '1px solid rgba(139,92,246,0.4)' }}>
            1 Avatar Credit · 720p
          </span>
          <a
            href={ctaHref}
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#14b8a6)', color: '#fff', textDecoration: 'none' }}
          >
            Add a face →
          </a>
        </div>
      </div>
    </div>
  )
}
