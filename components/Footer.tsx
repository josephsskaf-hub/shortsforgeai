// Push #116 — global footer for public marketing surfaces (/, /start,
// /pricing, /login, /signup, /terms, /privacy, /not-found). Stays out
// of (dashboard)/* so signed-in surfaces don't pick up duplicated
// chrome — the sidebar there already carries the legal pointers.

import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,.06)',
        padding: '20px 16px 24px',
        marginTop: 24,
        textAlign: 'center',
        background: 'transparent',
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        © 2026 ShortsForgeAI · All rights reserved
      </div>
      <div
        style={{
          marginTop: 6,
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 14px',
        }}
      >
        <Link
          href="/terms"
          style={{ color: '#94A3B8', textDecoration: 'none' }}
        >
          Terms of Service
        </Link>
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <Link
          href="/privacy"
          style={{ color: '#94A3B8', textDecoration: 'none' }}
        >
          Privacy Policy
        </Link>
        <span aria-hidden style={{ opacity: 0.4 }}>
          ·
        </span>
        <a
          href="mailto:support@shortsforgeai.com"
          style={{ color: '#94A3B8', textDecoration: 'none' }}
        >
          Contact
        </a>
      </div>
    </footer>
  )
}
