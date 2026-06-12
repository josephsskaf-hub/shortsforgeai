// Push #116 — branded 404 page. Replaces the default Next.js fallback
// so users who land on a stale link still see the product, not a bare
// system page.

import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0A0A0B',
        color: '#F5F7FF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px',
      }}
    >
      <div style={{ marginBottom: 56, marginTop: 8 }}>
        <Link
          href="/"
          style={{
            fontWeight: 900,
            fontSize: '1rem',
            letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, #10B981, #22D3EE)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textDecoration: 'none',
          }}
        >
          ⚡ ShortsForgeAI
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          maxWidth: 520,
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: '4.5rem',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #10B981, #22D3EE)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 16,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            margin: 0,
            marginBottom: 10,
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: '#94A3B8',
            lineHeight: 1.55,
            margin: 0,
            marginBottom: 28,
          }}
        >
          This page doesn&apos;t exist or was moved.
        </p>
        {/* Push #117 — CTAs stack on mobile (full-width) and sit
            side-by-side on sm+. Inline media query via a scoped style
            tag keeps the page server-renderable. */}
        <div className="nf-cta-row">
          <style>{`
            .nf-cta-row {
              display: flex;
              flex-direction: column;
              gap: 10px;
              width: 100%;
              max-width: 320px;
            }
            .nf-cta-row a {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 48px;
              padding: 12px 22px;
              border-radius: 12px;
              font-size: 0.95rem;
              font-weight: 800;
              text-decoration: none;
              box-sizing: border-box;
            }
            @media (min-width: 480px) {
              .nf-cta-row { flex-direction: row; max-width: none; }
            }
          `}</style>
          <Link
            href="/"
            style={{
              background: 'linear-gradient(135deg, #059669, #22D3EE)',
              color: '#FFFFFF',
              boxShadow: '0 8px 26px rgba(34,211,238,.35)',
            }}
          >
            ← Back to Home
          </Link>
          <Link
            href="/generate"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.10)',
              color: '#F5F7FF',
              fontWeight: 700,
            }}
          >
            Go to Generator
          </Link>
        </div>
      </div>
    </main>
  )
}
