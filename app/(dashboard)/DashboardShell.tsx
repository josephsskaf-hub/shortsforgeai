'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePathname } from 'next/navigation'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
  isPro: boolean
  generationsUsed: number
  isLoggedIn: boolean
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/history': 'History',
  '/pricing': 'Pricing',
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
        style={{
          width: 600,
          height: 600,
          background: 'var(--indigo)',
          top: -200,
          right: -150,
          opacity: 0.04,
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed rounded-full pointer-events-none"
        style={{
          width: 500,
          height: 500,
          background: 'var(--purple)',
          bottom: -150,
          left: 300,
          opacity: 0.035,
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      {/* Sidebar — always visible on md+, toggle on mobile */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 240 }} />
      <Sidebar
        userEmail={userEmail}
        isPro={isPro}
        generationsUsed={generationsUsed}
        isLoggedIn={isLoggedIn}
        isOpen={true}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <Sidebar
          userEmail={userEmail}
          isPro={isPro}
          generationsUsed={generationsUsed}
          isLoggedIn={isLoggedIn}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
        <TopBar
          title={title}
          isPro={isPro}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
