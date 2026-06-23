'use client'

// AI Avatar mini-demo (feature/ai-avatar, Nível 2) — a self-contained, looping
// "photo → speaking" visual used across all entry points (generate panel, home
// hero, dashboard banner) so the feature SHOWS what it does, not just describes
// it. Pure CSS/SVG: no hosted asset, no network, lightweight on high-traffic
// pages, never breaks. `size` controls the circular face diameter in px.
interface AvatarDemoLoopProps {
  size?: number
  className?: string
}

export default function AvatarDemoLoop({ size = 56, className }: AvatarDemoLoopProps) {
  const bars = [0, 1, 2, 3, 4]
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {/* Face circle with a soft "talking" pulse ring */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <span className="sfa-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%' }} />
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          style={{ position: 'relative', borderRadius: '50%', display: 'block' }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sfaFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="32" fill="url(#sfaFace)" opacity="0.18" />
          {/* head */}
          <circle cx="32" cy="25" r="11" fill="#c4b5fd" />
          {/* shoulders */}
          <path d="M14 56c0-10 8-16 18-16s18 6 18 16z" fill="#c4b5fd" />
          {/* animated mouth (talking) */}
          <rect className="sfa-mouth" x="28" y="28" width="8" height="2.4" rx="1.2" fill="#6D28D9" />
        </svg>
      </div>

      {/* Animated voice bars = "speaking" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: size * 0.5 }}>
        {bars.map((b) => (
          <span
            key={b}
            className="sfa-bar"
            style={{
              width: 3,
              borderRadius: 3,
              background: 'linear-gradient(180deg,#c4b5fd,#14b8a6)',
              animationDelay: `${b * 0.12}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .sfa-ring {
          border: 2px solid rgba(16, 185, 129, 0.55);
          animation: sfaPulse 1.8s ease-out infinite;
        }
        @keyframes sfaPulse {
          0% { transform: scale(1); opacity: 0.7; }
          70% { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        .sfa-mouth {
          transform-origin: 32px 29px;
          animation: sfaTalk 0.5s ease-in-out infinite;
        }
        @keyframes sfaTalk {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(2.6); }
        }
        .sfa-bar {
          height: 30%;
          animation: sfaBars 0.9s ease-in-out infinite;
        }
        @keyframes sfaBars {
          0%, 100% { height: 22%; opacity: 0.6; }
          50% { height: 95%; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sfa-ring, .sfa-mouth, .sfa-bar { animation: none; }
          .sfa-bar { height: 60%; }
        }
      `}</style>
    </div>
  )
}
