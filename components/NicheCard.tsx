'use client'

interface NicheCardProps {
  id: string
  emoji: string
  name: string
  description: string
  tags: string[]
  pills: string[]
  onGenerate: (nicheId: string) => void
  loading: boolean
  disabled?: boolean
}

export default function NicheCard({
  id,
  emoji,
  name,
  description,
  tags,
  pills,
  onGenerate,
  loading,
  disabled = false,
}: NicheCardProps) {
  return (
    <div
      className="rounded-2xl p-5 cursor-pointer transition-all relative overflow-hidden group"
      style={{
        background: 'rgba(15,15,30,0.6)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,.5)'
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = '0 14px 40px rgba(99,102,241,.18)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Hover gradient overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,.07), transparent)',
        }}
      />

      {/* Top row */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,.14), rgba(124,58,237,.09))',
            border: '1px solid rgba(99,102,241,.18)',
          }}
        >
          {emoji}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full animate-pulse-dot"
            style={{ background: '#10b981', boxShadow: '0 0 7px rgba(16,185,129,.55)' }}
          />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: '#34d399' }}
          >
            Live
          </span>
        </div>
      </div>

      {/* Name & description */}
      <h3
        className="text-sm font-bold mb-1.5 tracking-tight relative z-10"
        style={{ color: 'var(--text)' }}
      >
        {name}
      </h3>
      <p
        className="text-xs leading-relaxed mb-3 relative z-10"
        style={{ color: 'var(--muted)' }}
      >
        {description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-2 relative z-10">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{
              background: 'rgba(99,102,241,.09)',
              border: '1px solid rgba(99,102,241,.14)',
              color: 'var(--indigo-light)',
              fontSize: '0.58rem',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1 mb-3 relative z-10">
        {pills.map((pill) => (
          <span
            key={pill}
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(124,58,237,.08)',
              border: '1px solid rgba(124,58,237,.2)',
              color: 'var(--purple-light)',
              fontSize: '0.54rem',
            }}
          >
            {pill}
          </span>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={() => !disabled && !loading && onGenerate(id)}
        disabled={disabled || loading}
        className="w-full rounded-[13px] px-4 py-3.5 text-sm font-black text-white relative z-10 flex items-center justify-center gap-2 transition-all"
        style={{
          background:
            disabled || loading
              ? 'rgba(99,102,241,.3)'
              : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
          boxShadow: disabled || loading ? 'none' : '0 4px 22px rgba(99,102,241,.28)',
          animation: disabled || loading ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          letterSpacing: '-0.01em',
        }}
      >
        {loading ? (
          <>
            <div
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ borderTopColor: 'white', animation: 'spin 0.65s linear infinite' }}
            />
            Generating...
          </>
        ) : (
          <>⚡ Generate 5 Viral Shorts Now</>
        )}
      </button>
    </div>
  )
}
