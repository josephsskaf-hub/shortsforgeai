'use client'

// Static preview data keyed by niche id
const NICHE_PREVIEWS: Record<string, { hook: string; title: string; hashtags: string[] }> = {
  mideast: {
    hook: '"This secret about the Middle East was hidden for decades..."',
    title: 'The Hidden Truth About the Most Powerful Region in the World',
    hashtags: ['#middleeast', '#geopolitics', '#viral'],
  },
  money: {
    hook: '"This one money fact changed how I see wealth forever..."',
    title: 'The Hidden Truth About Wealth Nobody Tells You',
    hashtags: ['#money', '#wealth', '#mindset'],
  },
  mind: {
    hook: '"Scientists just discovered something that breaks our reality..."',
    title: 'Mind-Blowing Facts That Will Change How You See the World',
    hashtags: ['#mindblow', '#facts', '#education'],
  },
  dark: {
    hook: '"This secret was buried for 100 years..."',
    title: "The Mystery That Governments Don't Want You to Know",
    hashtags: ['#mystery', '#darkfacts', '#viral'],
  },
  motivation: {
    hook: '"He failed 27 times before becoming a billionaire..."',
    title: 'Why Failure Is the Only Path to True Success',
    hashtags: ['#motivation', '#success', '#mindset'],
  },
}

interface PreviewModalProps {
  niche: {
    id: string
    emoji: string
    name: string
    description: string
  }
  onConfirm: () => void
  onClose: () => void
}

export default function PreviewModal({ niche, onConfirm, onClose }: PreviewModalProps) {
  const preview = NICHE_PREVIEWS[niche.id] ?? {
    hook: '"This viral short is about to change your feed..."',
    title: `Top Viral ${niche.name} Script — Ready to Post`,
    hashtags: ['#viral', '#shorts', '#fyp'],
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.9)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-[22px] overflow-hidden animate-fade-in relative"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(99,102,241,.28)',
          boxShadow: '0 0 100px rgba(99,102,241,.18)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Header bar */}
        <div
          className="px-7 pt-7 pb-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.2), rgba(124,58,237,.14))',
                border: '1px solid rgba(99,102,241,.28)',
              }}
            >
              {niche.emoji}
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-0.5"
                style={{ color: 'var(--indigo-light)' }}
              >
                Ready to generate
              </div>
              <h2
                className="font-black tracking-tight"
                style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1.2 }}
              >
                {niche.name} Shorts
              </h2>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(16,185,129,.1)',
                border: '1px solid rgba(16,185,129,.2)',
                color: '#34d399',
              }}
            >
              ⚡ Generate Script in seconds
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(99,102,241,.1)',
                border: '1px solid rgba(99,102,241,.2)',
                color: 'var(--indigo-light)',
              }}
            >
              👥 1,200+ creators use this
            </div>
          </div>
        </div>

        {/* Preview card */}
        <div className="px-7 py-5">
          <p
            className="text-xs font-black uppercase tracking-widest mb-3"
            style={{ color: 'var(--muted)' }}
          >
            Preview — Script #1 of 5
          </p>

          <div
            className="rounded-[14px] p-4"
            style={{
              background: 'rgba(99,102,241,.05)',
              border: '1px solid rgba(99,102,241,.15)',
            }}
          >
            {/* Hook */}
            <div className="mb-3">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                🎣 Hook
              </span>
              <p
                className="mt-1.5 font-bold text-sm leading-snug"
                style={{
                  color: 'var(--text)',
                  fontStyle: 'italic',
                  borderLeft: '2px solid var(--indigo-light)',
                  paddingLeft: 10,
                }}
              >
                {preview.hook}
              </p>
            </div>

            {/* Title */}
            <div className="mb-3">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                🎬 Title
              </span>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--text2)' }}>
                {preview.title}
              </p>
            </div>

            {/* Hashtags */}
            <div>
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                # Hashtags
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {preview.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{
                      background: 'rgba(99,102,241,.1)',
                      border: '1px solid rgba(99,102,241,.2)',
                      color: 'var(--indigo-light)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p
            className="text-center text-xs mt-3 mb-1"
            style={{ color: 'var(--muted)', fontStyle: 'italic' }}
          >
            + 4 more scripts, video prompts, YouTube descriptions...
          </p>
        </div>

        {/* CTA footer */}
        <div
          className="px-7 pb-7"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}
        >
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black text-white mb-3 transition-all"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 6px 28px rgba(99,102,241,.45)',
              animation: 'btn-pulse 2.8s ease-in-out infinite',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ⚡ Generate 5 Shorts Now
          </button>
          <button
            onClick={onClose}
            className="w-full text-sm font-medium transition-colors"
            style={{
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}