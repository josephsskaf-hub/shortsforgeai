'use client'

// Push #162 — floating "back to top" button. The dashboard scrolls its
// <main> element (not the window), so this listens to a passed-in scroll
// container ref. It fades in once the user is more than ~600px down and
// smooth-scrolls back to the top on click.

import { useEffect, useState, type RefObject } from 'react'

export default function ScrollToTop({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement>
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > 600)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  function handleClick() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      title="Back to top"
      style={{
        position: 'fixed',
        right: 18,
        // Sit above the mobile bottom nav (58px tall) on small screens.
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        zIndex: 40,
        width: 44,
        height: 44,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 8px 26px rgba(34,211,238,.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 19V5M5 12l7-7 7 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
