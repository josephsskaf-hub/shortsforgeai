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
  selected?: boolean
}

export default function NicheCard({
  id,
  emoji,
  name,
  description,
  tags,
  onGenerate,
  loading,
  disabled = false,
  selected = false,
}: NicheCardProps) {
  return (
    <div
      className="rounded-2xl p-6 cursor-pointer transition-all duration-200 relative overflow-hidden group"
      style={{
        background: selected ? 'rgba(99,102,241,.13)' : 'rgba(15,15,30,0.6)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: selected ? '1.5px solid rgba(99,102,241,.65)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: selected ? '0 0 0 1px rgba(99,102,241,.25) inset, 0 8px 36px rgba(99,102,241,.22)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (selected) return
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,.45)'
        el.style.transform = 'scale(1.02) translateY(-2px)'
        el.style.boxShadow = '0 12px 40px rgba(99,102,241,.18)'
      }}
      onMouseLeave={(e) => {
        if (selected) return
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.transform = 'scale(1) translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Selected glow overlay */}
      {selected && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06) 70%)', zIndex: 0 }}
        />
      )}

      {/* Hover gradient overlay */}
      {!selected && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.08), transparent 70%)' }}
        />
      )}

      {/* Top row */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{
            background: selected
              ? 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(124,58,237,.18))'
              : 'linear-gradient(135deg, rgba(99,102,241,.14), rgba(124,58,237,.09))',
            border: selected ? '1px solid rgba(99,102,241,.4)' : '1px solid rgba(99,102,241,.18)',
          }}
        >
          {emoji}
        </div>
        {selected ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(99,102,241,.18)', border: '1px solid rgba(99,102,241,.35)' }}
          >
            <span className="text-xs font-black" style={{ color: 'var(--indigo-light)', fontSize: '0.6rem' }}>✓ Selected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: '#10b981', boxShadow: '0 0 7px rgba(16,185,129,.55)' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>Live</span>
          </div>
        )}
      </div>

      {/* Name & description */}
      <h3 className="font-bold mb-1.5 tracking-tight relative z-10" style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
        {name}
      </h3>
      <p className="text-xs leading-relaxed mb-3 relative z-10" style={{ color: 'var(--muted)' }}>
        {description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4 relative z-10">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{
              background: selected ? 'rgba(99,102,241,.15)' : 'rgba(99,102,241,.09)',
              border: selected ? '1px solid rgba(99,102,241,.28)' : '1px solid rgba(99,102,241,.14)',
              color: 'var(--indigo-light)',
              fontSize: '0.58rem',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={() => !loading && onGenerate(id)}
        disabled={loading}
        className="w-full rounded-[13px] px-4 py-4 text-sm font-black text-white relative z-10 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
        style={{
          background:
            disabled || loading
              ? 'rgba(99,102,241,.3)'
              : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
          boxShadow: disabled || loading ? 'none' : selected ? '0 6px 28px rgba(99,102,241,.45)' : '0 4px 22px rgba(99,102,241,.28)',
          animation: disabled || loading ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          letterSpacing: '-0.01em',
          border: 'none',
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
        ) : disabled ? (
          <>🔒 Upgrade to Generate</>
        ) : (
          <>⚡ Generate 5 Viral Shorts</>
        )}
      </button>
    </div>
  )
}
