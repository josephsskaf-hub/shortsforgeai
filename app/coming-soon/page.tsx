'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    // UI-only — no backend wired up yet. Store locally so a refresh keeps the
    // thank-you state on the same device.
    try {
      localStorage.setItem('sf_coming_soon_email', email.trim())
    } catch {
      // ignore — private mode etc.
    }
    setSubmitted(true)
  }

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--bg, #0A0A0B)',
        color: 'var(--text, #f5f5fa)',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      {/* Background glows */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          background: 'radial-gradient(circle, rgba(5,150,105,0.18), transparent 65%)',
          top: -300,
          right: -200,
          filter: 'blur(120px)',
          borderRadius: '50%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(5, 150, 105,0.16), transparent 65%)',
          bottom: -240,
          left: -160,
          filter: 'blur(100px)',
          borderRadius: '50%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <section
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 560,
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <Link
          href="/coming-soon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            marginBottom: 36,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7C3AED, #7C3AED)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 0 28px rgba(16, 185, 129,.55)',
            }}
          >
            ⚡
          </span>
          <span
            style={{
              fontWeight: 900,
              fontSize: '1.15rem',
              background: 'linear-gradient(135deg, #8B5CF6, #22D3EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            ShortsForgeAI
          </span>
        </Link>

        {/* Status pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(5,150,105,0.12)',
            border: '1px solid rgba(5,150,105,0.32)',
            marginBottom: 22,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#a78bfa',
              boxShadow: '0 0 10px rgba(167,139,250,0.7)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.05em' }}>
            EM BREVE · COMING SOON
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 6vw, 3.4rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
            margin: '0 auto 16px',
            maxWidth: 520,
          }}
        >
          Estamos preparando algo{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #22D3EE, #22D3EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            incrível
          </span>
          .
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 440,
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          Em breve você poderá gerar Shorts virais com IA em um clique. Deixe seu email e avisamos
          assim que lançar.
        </p>

        {/* Email form / thank-you */}
        {!submitted ? (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '14px 22px',
                borderRadius: 12,
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#fff',
                background: 'linear-gradient(135deg, #7C3AED, #7C3AED)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(16, 185, 129,.4)',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              Avisar quando lançar
            </button>
          </form>
        ) : (
          <div
            style={{
              maxWidth: 480,
              margin: '0 auto',
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.32)',
              color: '#c4b5fd',
              fontWeight: 700,
              fontSize: '0.92rem',
            }}
          >
            ✓ Obrigado! Vamos te avisar em <span style={{ color: '#fff' }}>{email}</span>.
          </div>
        )}

        <p style={{ marginTop: 22, fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
          Sem spam. Apenas o lançamento.
        </p>

        {/* Sign-in link for existing users / team */}
        <div style={{ marginTop: 42, fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
          Já tem uma conta?{' '}
          <Link
            href="/login"
            style={{ color: '#c4b5fd', textDecoration: 'none', fontWeight: 700 }}
          >
            Entrar
          </Link>
        </div>
      </section>

      <footer
        style={{
          position: 'absolute',
          bottom: 18,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 1,
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.32)',
        }}
      >
        © 2026 ShortsForgeAI · v3.0
      </footer>
    </main>
  )
}
