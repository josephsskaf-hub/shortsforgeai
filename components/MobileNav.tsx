'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Push #134 — 4 clean nav items matching top navbar (no Home, no dropdown).
const NAV_ITEMS = [
  { href: '/generate',            icon: '⚡', label: 'Generator', exact: false },
  { href: '/thumbnail-generator', icon: '🖼️', label: 'Thumbnail', exact: false },
  { href: '/viral-now',            icon: '🔥', label: 'Viral Now', exact: false },
  { href: '/pricing',             icon: '💎', label: 'Pricing',   exact: false },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: '#0B1020',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
      }}
    >
      <div className="flex items-stretch" style={{ height: 58 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
              style={{ textDecoration: 'none' }}
            >
              {/* Active top bar */}
              {active && (
                <span
                  className="absolute top-0"
                  style={{
                    left: '22%',
                    right: '22%',
                    height: 2,
                    background: 'linear-gradient(90deg, #22D3EE, #3B82F6)',
                    borderRadius: '0 0 4px 4px',
                  }}
                />
              )}

              {/* Icon */}
              <span
                style={{
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  filter: active
                    ? 'drop-shadow(0 0 7px rgba(34,211,238,0.65))'
                    : 'none',
                  transition: 'filter 0.18s ease',
                }}
              >
                {item.icon}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: active ? '#22D3EE' : '#94A3B8',
                  transition: 'color 0.18s ease',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
