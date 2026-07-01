'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Push #134 — 4 clean nav items matching top navbar (no Home, no dropdown).
const NAV_ITEMS = [
  { href: '/generate',            icon: '⚡', label: 'Generator', exact: false },
  { href: '/viral-now',           icon: '🔥', label: 'Viral Now', exact: false },
  { href: '/history',             icon: '🎞️', label: 'My Videos', exact: false },
  // Push #444 — Invite & Earn (referral loop). Mirrors the Sidebar link.
  { href: '/referral',            icon: '🎁', label: 'Invite',    exact: false },
  { href: '/pricing',             icon: '💎', label: 'Pricing',   exact: false },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: '#000',
        borderTop: '1px solid #2a2a2d',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
      }}
    >
      <div className="flex items-stretch" style={{ height: 62 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
              style={{
                textDecoration: 'none',
                background: active ? 'rgba(41,151,255,0.08)' : 'transparent',
              }}
            >
              {/* Active top indicator */}
              {active && (
                <span
                  className="absolute top-0"
                  style={{
                    left: '20%',
                    right: '20%',
                    height: 2,
                    background: '#2997ff',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 8px rgba(41,151,255,0.5)',
                  }}
                />
              )}

              {/* Icon */}
              <span
                style={{
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  filter: active
                    ? 'drop-shadow(0 0 8px rgba(41,151,255,0.7))'
                    : 'none',
                  transition: 'filter 0.18s ease',
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  transitionProperty: 'filter, transform',
                  transitionDuration: '0.18s',
                }}
              >
                {item.icon}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  color: active ? '#2997ff' : '#86868b',
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
