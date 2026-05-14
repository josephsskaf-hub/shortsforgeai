'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Push #053 — primary entry points on mobile. "My Videos" replaces the
// old "History" item so the bottom bar lines up with the desktop sidebar
// (the legacy /history Shorts Packs view is still reachable directly).
// Push #060 — Examples added between My Videos and Credits. Five tabs fit
// on iPhone widths without crowding the labels.
const NAV_ITEMS = [
  { href: '/',           icon: '🏠', label: 'Home',      exact: true  },
  { href: '/generate',   icon: '⚡', label: 'Generate',  exact: false },
  { href: '/my-videos',  icon: '📼', label: 'My Videos', exact: false },
  { href: '/examples',   icon: '✨', label: 'Examples',  exact: false },
  { href: '/pricing',    icon: '💎', label: 'Credits',   exact: false },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(8,8,16,0.97) 0%, rgba(6,6,12,0.99) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
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
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
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
                    ? 'drop-shadow(0 0 7px rgba(129,140,248,0.65))'
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
                  color: active ? '#a5b4fc' : 'rgba(100,116,139,0.85)',
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
