import type { Metadata } from 'next'

// Push #107 — dedicated Google Ads landing page. Stays out of the
// (dashboard) route group so it inherits zero shell: no Sidebar, no
// DashboardShell, no header/footer chrome from the marketing pages.
// This empty layout is intentional — it documents the isolation and
// guards against any future top-level wrapper being added globally.
export const metadata: Metadata = {
  title: 'Kineo — The Smart AI Tool That Turns Any Idea Into a Viral Short',
  description:
    'AI writes the script, finds footage, adds captions & music. Ready in 60 seconds. 30 free credits on signup, no credit card.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
