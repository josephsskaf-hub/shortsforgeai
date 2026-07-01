'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import MobileNav from '@/components/MobileNav'
import AvatarLaunchBanner from '@/components/AvatarLaunchBanner'
import { usePathname } from 'next/navigation'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
  isPro: boolean
  generationsUsed: number
  isLoggedIn: boolean
}

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Creator Hub',
  '/create': 'Create Video',
  '/generate': 'Generate New Short',
  '/my-videos': 'My Videos',
  '/viral-now': 'Viral Now',
  '/avatar': 'AI Avatar Studio',
  '/animate': 'Animate a Photo',
  '/examples': 'Examples',
  '/history': 'My Videos',
  '/pricing': 'Pricing',
  '/templates': 'Viral Templates',
  '/account': 'Account',
  '/video': 'Video Studio',
  '/channel': 'Channel Builder',
  '/admin/metrics': 'Admin · Metrics',
  '/thumbnail-generator': 'AI Thumbnail Generator',
}

export default function DashboardShell({
  children,
  userEmail,
  isPro,
  generationsUsed,
  isLoggedIn,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'Dashboard'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Glow orbs */}
      <div
        className="fixed rounded-full pointer-events-none"
        style={{ width: 600, height: 600, background: '#2997ff', top: -200, right: -150, opacity: 0.07, filter: 'blur(120px)', zIndex: 0 }}
      />
      <div
        className="fixed rounded-full pointer-events-none"
        style={{ width: 500, height: 500, background: '#2997ff', bottom: -150, left: 300, opacity: 0.05, filter: 'blur(110px)', zIndex: 0 }}
      />

      {/* Desktop sidebar spacer — must match Sidebar width (248px) */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 248 }} />

      {/* Desktop sidebar (always open).
          Push #052 — wrapped in `hidden md:block` so the fixed 248px aside
          no longer overlays mobile content. The mobile-toggle path below
          inside `md:hidden` is the only one that renders on small screens. */}
      <div className="hidden md:block">
        <Sidebar
          userEmail={userEmail}
          isPro={isPro}
          generationsUsed={generationsUsed}
          isLoggedIn={isLoggedIn}
          isOpen={true}
          onClose={() => {}}
        />
      </div>

      {/* Mobile sidebar overlay (toggle) */}
      {sidebarOpen && (
        <div className="md:hidden">
          <Sidebar
            userEmail={userEmail}
            isPro={isPro}
            generationsUsed={generationsUsed}
            isLoggedIn={isLoggedIn}
            isOpen={true}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
        <TopBar
          title={title}
          isPro={isPro}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        {/* AI Avatar launch banner — dismissible, links to /generate?avatar=1 */}
        <AvatarLaunchBanner />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        <MobileNav />
      </div>
    </div>
  )
}
