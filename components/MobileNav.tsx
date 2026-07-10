'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Push #134 — 4 clean nav items matching top navbar (no Home, no dropdown).
// KINEO-NAV-REDESIGN-2026-07-10 — emoji icons replaced with the same refined
// line-icon set the Sidebar uses (17px, 1.7 stroke, currentColor) so mobile
// matches the professional desktop nav.
const NAV_ITEMS: { href: string; icon: JSX.Element; label: string; exact: boolean }[] = [
  {
    href: '/generate',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="5" width="14" height="14" rx="3" />
        <path d="M16.5 10.5 21.5 7v10l-5-3.5" />
      </svg>
    ),
    label: 'Generator',
    exact: false,
  },
  {
    href: '/viral-now',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c1 3-3 5-3 8.5a3.5 3.5 0 0 0 7 0c0-1-.4-2-1-2.8.2 2-1 2.6-1 1.3 0-2.5-1-5.5-2-7Z" />
        <path d="M8 14.5A6.5 6.5 0 1 0 18.5 14" />
      </svg>
    ),
    label: 'Viral Now',
    exact: false,
  },
  {
    href: '/history',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9h18M8 4v5M16 4v5" />
      </svg>
    ),
    label: 'My Videos',
    exact: false,
  },
  {
    href: '/referral',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="8" width="17" height="4.5" rx="1.5" />
        <path d="M5 12.5V19a1.8 1.8 0 0 0 1.8 1.8h10.4A1.8 1.8 0 0 0 19 19v-6.5M12 8v12.8M12 8c-1.8 0-3.5-1-3.5-2.6S10.4 3 12 5c1.6-2 3.5-1.2 3.5.4S13.8 8 12 8Z" />
      </svg>
    ),
    label: 'Invite',
    exact: false,
  },
  {
    href: '/pricing',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3.5h12l3.5 5.5L12 21 2.5 9 6 3.5Z" />
        <path d="M2.5 9h19M9 9l3 12M15 9l-3 12" />
      </svg>
    ),
    label: 'Pricing',
    exact: false,
  },
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

              {/* Icon — line icon tinted by state (KINEO-NAV-REDESIGN). */}
              <span
                aria-hidden="true"
                style={{
                  lineHeight: 1,
                  display: 'flex',
                  color: active ? '#2997ff' : '#86868b',
                  transform: active ? 'scale(1.06)' : 'scale(1)',
                  transition: 'color 0.18s ease, transform 0.18s ease',
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
