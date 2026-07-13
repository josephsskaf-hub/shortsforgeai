// Push #116 — global footer for public marketing surfaces (/, /start,
// /pricing, /login, /signup, /terms, /privacy, /not-found). Stays out
// of (dashboard)/* so signed-in surfaces don't pick up duplicated
// chrome — the sidebar there already carries the legal pointers.
//
// ROBO5-UX-2026-06-28 — expanded into an accessible <nav> with internal
// links to the high-intent pages (pricing, the topic→Short landing, the
// cheapest-AI page, the free tools, an alternatives comparison, and the
// free-start CTA). Improves SEO crawl depth (one hop from every public
// page to every money page) and keyboard/screen-reader navigation. Pure
// server component — no 'use client', same default export, styling tokens
// kept inline to match the rest of the marketing chrome.

import Link from 'next/link'
// PROVA-SOCIAL-REAL-2026-07-02 — client badge with real DB counts; self-hides
// when the numbers are low or the stats API fails, so the footer stays honest.
import LiveStatsBadge from '@/components/LiveStatsBadge'

const linkStyle: React.CSSProperties = {
  color: '#86868b',
  textDecoration: 'none',
}

// Internal navigation grouped for crawl depth + human wayfinding.
const navGroups: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/youtube-shorts-from-topic', label: 'YouTube Shorts from a topic' },
      { href: '/cheapest-ai-shorts-maker', label: 'Cheapest AI Shorts maker' },
      { href: '/faceless-channel-ideas', label: 'Faceless channel ideas (2026)' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/start', label: 'Start free' },
    ],
  },
  {
    title: 'Free tools',
    links: [
      { href: '/free-script-generator', label: 'Free script generator' },
      { href: '/free-hook-generator', label: 'Free hook generator' },
    ],
  },
  {
    title: 'Compare',
    links: [
      // No /alternatives index exists (only a [competitor] dynamic route with
      // dynamicParams=false), so we deep-link the highest-intent comparison.
      { href: '/alternatives/opusclip', label: 'Kineo vs OpusClip' },
    ],
  },
]

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,.06)',
        padding: '32px 16px 28px',
        marginTop: 24,
        background: 'transparent',
        color: '#86868b',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {/* Brand + positioning tagline */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <Link
          href="/"
          style={{ ...linkStyle, color: '#FAFAFA', fontWeight: 800, fontSize: 15 }}
        >
          ⚡ Kineo
        </Link>
        <p style={{ margin: '6px auto 0', maxWidth: 460, color: '#86868b' }}>
          Turn one idea into a ready-to-post faceless YouTube Short — script,
          AI voiceover, footage &amp; captions in ~60s. First Short free, no card.
        </p>
      </div>

      {/* Internal navigation — improves crawl depth + accessibility */}
      <nav
        aria-label="Footer"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '28px 48px',
          maxWidth: 720,
          margin: '0 auto 24px',
          textAlign: 'left',
        }}
      >
        {navGroups.map((group) => (
          <div key={group.title}>
            <h2
              style={{
                margin: '0 0 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#71717A',
              }}
            >
              {group.title}
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.links.map((link) => (
                <li key={link.href} style={{ marginBottom: 7 }}>
                  <Link href={link.href} style={linkStyle}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Legal + contact (preserved) */}
      <div style={{ textAlign: 'center' }}>
        {/* Real live stats — renders nothing when unavailable/low */}
        <div style={{ marginBottom: 10 }}>
          <LiveStatsBadge />
        </div>
        <div style={{ fontWeight: 600 }}>
          © 2026 Kineo · All rights reserved
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
          <Link href="/terms" style={linkStyle}>
            Terms of Service
          </Link>
          <span aria-hidden style={{ opacity: 0.4 }}>
            ·
          </span>
          <Link href="/privacy" style={linkStyle}>
            Privacy Policy
          </Link>
          <span aria-hidden style={{ opacity: 0.4 }}>
            ·
          </span>
          <a href="mailto:support@usekineo.com" style={linkStyle}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}
